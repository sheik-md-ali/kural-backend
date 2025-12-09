/**
 * Background Job Worker
 *
 * Handles heavy computations in the background to keep API responses fast.
 * Jobs include:
 * - Family aggregation precompute
 * - AC dashboard metrics precompute
 * - Cross-AC scans
 * - Report generation
 *
 * This worker can be run as a separate process or integrated with the main server.
 */

import mongoose from 'mongoose';
import { createRequire } from 'module';
import { MONGODB_URI } from '../config/index.js';
import { setCache, TTL, cacheKeys } from '../utils/cache.js';
import { getVoterModel, aggregateVoters, aggregateAllVoters } from '../utils/voterCollection.js';

// Create require for CommonJS modules
const require = createRequire(import.meta.url);
const logger = require('../utils/logger.cjs');

// Create child logger for background jobs
const jobLogger = logger.child({ component: 'BackgroundJob' });

// All AC IDs
const AC_IDS = [101, 102, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126];

// Job execution state
let isRunning = false;
let lastRunTime = null;

/**
 * Precompute family counts and metadata for all ACs
 */
export async function precomputeFamilyStats() {
  jobLogger.info('Starting family stats precompute');
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  for (const acId of AC_IDS) {
    try {
      const pipeline = [
        { $match: { familyId: { $exists: true, $nin: [null, ''] } } },
        {
          $group: {
            _id: '$familyId',
            memberCount: { $sum: 1 },
            boothno: { $first: '$boothno' }
          }
        },
        {
          $group: {
            _id: '$boothno',
            familyCount: { $sum: 1 },
            totalMembers: { $sum: '$memberCount' }
          }
        }
      ];

      const results = await aggregateVoters(acId, pipeline);

      // Cache per-booth stats
      for (const boothStats of results) {
        const cacheKey = `ac:${acId}:booth:${boothStats._id}:family:stats`;
        setCache(cacheKey, {
          familyCount: boothStats.familyCount,
          totalMembers: boothStats.totalMembers
        }, TTL.LONG);
      }

      // Cache total for AC
      const totalFamilies = results.reduce((sum, b) => sum + b.familyCount, 0);
      const totalMembers = results.reduce((sum, b) => sum + b.totalMembers, 0);

      setCache(`ac:${acId}:family:totalStats`, {
        totalFamilies,
        totalMembers,
        boothCount: results.length
      }, TTL.LONG);

      successCount++;
    } catch (err) {
      jobLogger.error({ acId, error: err.message }, 'Error precomputing AC family stats');
      errorCount++;
    }
  }

  const duration = Date.now() - startTime;
  jobLogger.info({ successCount, errorCount, durationMs: duration }, 'Family stats precompute complete');

  return { successCount, errorCount, duration };
}

/**
 * Precompute dashboard analytics for L0 view
 */
export async function precomputeL0Dashboard() {
  jobLogger.info('Starting L0 dashboard precompute');
  const startTime = Date.now();

  try {
    // Get voter counts per AC
    const voterCountsPipeline = [
      { $group: { _id: '$acId', count: { $sum: 1 } } }
    ];

    // Get surveyed counts per AC
    const surveyedCountsPipeline = [
      { $match: { surveyed: true } },
      { $group: { _id: '$acId', count: { $sum: 1 } } }
    ];

    // Execute aggregations
    const [voterCounts, surveyedCounts] = await Promise.all([
      aggregateAllVoters(voterCountsPipeline),
      aggregateAllVoters(surveyedCountsPipeline)
    ]);

    // Build AC performance data
    const acPerformance = AC_IDS.map(acId => {
      const voterData = voterCounts.find(v => v._id === acId) || { count: 0 };
      const surveyedData = surveyedCounts.find(s => s._id === acId) || { count: 0 };

      return {
        acId,
        totalVoters: voterData.count,
        surveyedVoters: surveyedData.count,
        surveyProgress: voterData.count > 0
          ? Math.round((surveyedData.count / voterData.count) * 100)
          : 0
      };
    });

    // Calculate totals
    const totals = {
      totalVoters: acPerformance.reduce((sum, ac) => sum + ac.totalVoters, 0),
      totalSurveyed: acPerformance.reduce((sum, ac) => sum + ac.surveyedVoters, 0),
      avgProgress: Math.round(
        acPerformance.reduce((sum, ac) => sum + ac.surveyProgress, 0) / AC_IDS.length
      )
    };

    // Cache the results
    setCache('L0:dashboard:precomputed', {
      acPerformance,
      totals,
      lastUpdated: new Date().toISOString()
    }, TTL.DASHBOARD_STATS);

    const duration = Date.now() - startTime;
    jobLogger.info({ durationMs: duration }, 'L0 dashboard precompute complete');

    return { success: true, duration };
  } catch (err) {
    jobLogger.error({ error: err.message }, 'L0 dashboard precompute error');
    return { success: false, error: err.message };
  }
}

/**
 * Precompute voter field discovery (schema analysis)
 */
export async function precomputeVoterFields() {
  jobLogger.info('Starting voter fields precompute');
  const startTime = Date.now();

  try {
    // Sample from multiple ACs for comprehensive field discovery
    const sampleACs = [111, 119, 101]; // ACs with most data
    const allFields = new Map();

    for (const acId of sampleACs) {
      try {
        const VoterModel = getVoterModel(acId);
        const samples = await VoterModel.find({}).limit(50).lean();

        for (const voter of samples) {
          for (const [key, value] of Object.entries(voter)) {
            if (key === '_id' || key === '__v') continue;

            if (!allFields.has(key)) {
              allFields.set(key, {
                name: key,
                type: typeof value,
                sampleValue: value,
                seenIn: [acId]
              });
            } else {
              const field = allFields.get(key);
              if (!field.seenIn.includes(acId)) {
                field.seenIn.push(acId);
              }
            }
          }
        }
      } catch (err) {
        // Skip AC if not accessible
      }
    }

    const fields = Array.from(allFields.values());

    // Cache the results
    setCache('global:voter:fields:precomputed', {
      fields,
      count: fields.length,
      lastUpdated: new Date().toISOString()
    }, TTL.LONG);

    const duration = Date.now() - startTime;
    jobLogger.info({ fieldCount: fields.length, durationMs: duration }, 'Voter fields precompute complete');

    return { success: true, fieldCount: fields.length, duration };
  } catch (err) {
    jobLogger.error({ error: err.message }, 'Voter fields precompute error');
    return { success: false, error: err.message };
  }
}

/**
 * Run all background jobs
 */
export async function runAllJobs() {
  if (isRunning) {
    jobLogger.warn('Jobs already running, skipping');
    return { skipped: true };
  }

  isRunning = true;
  const startTime = Date.now();
  jobLogger.info('Starting background job cycle');

  try {
    // Ensure database connection
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }

    // Run jobs in sequence to avoid overloading
    const results = {
      familyStats: await precomputeFamilyStats(),
      l0Dashboard: await precomputeL0Dashboard(),
      voterFields: await precomputeVoterFields()
    };

    const totalDuration = Date.now() - startTime;
    lastRunTime = new Date().toISOString();

    jobLogger.info({ totalDurationMs: totalDuration, results }, 'All background jobs complete');

    return { success: true, results, duration: totalDuration };
  } catch (err) {
    jobLogger.fatal({ error: err.message, stack: err.stack }, 'Fatal error in background jobs');
    return { success: false, error: err.message };
  } finally {
    isRunning = false;
  }
}

/**
 * Schedule periodic background jobs
 * @param {number} intervalMinutes - Interval between job runs
 */
export function scheduleJobs(intervalMinutes = 5) {
  jobLogger.info({ intervalMinutes }, 'Scheduling background jobs');

  // Run immediately on startup
  setTimeout(() => runAllJobs(), 10000); // Wait 10s for server to stabilize

  // Then run periodically
  setInterval(() => runAllJobs(), intervalMinutes * 60 * 1000);
}

/**
 * Get job status
 */
export function getJobStatus() {
  return {
    isRunning,
    lastRunTime
  };
}

export default {
  precomputeFamilyStats,
  precomputeL0Dashboard,
  precomputeVoterFields,
  runAllJobs,
  scheduleJobs,
  getJobStatus
};
