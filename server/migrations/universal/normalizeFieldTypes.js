/**
 * Universal Migration Script: Normalize Field Types
 *
 * This script normalizes field types across AC-sharded collections:
 * - Convert mixed string/number fields to consistent types
 * - Fix aci_id type (should be number)
 * - Fix mobile, doornumber types (should be string)
 *
 * IMPORTANT: This script does NOT execute automatically.
 * It must be run manually with proper backup procedures.
 *
 * Usage:
 *   DRY_RUN=true node server/migrations/universal/normalizeFieldTypes.js
 *   node server/migrations/universal/normalizeFieldTypes.js
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '../../config/database.js';
import { ALL_AC_IDS } from '../../utils/voterCollection.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.env.DRY_RUN !== 'false';
const BATCH_SIZE = 500;
const BACKUP_SUFFIX = '_typefix_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

// ============================================================================
// TYPE NORMALIZATION RULES
// ============================================================================

/**
 * Rules for each collection type
 * Format: { fieldName: { targetType: 'string'|'number', from: ['string', 'number'] } }
 */
const NORMALIZATION_RULES = {
  voters: {
    mobile: { targetType: 'string', description: 'Mobile number should be string' },
    doornumber: { targetType: 'string', description: 'Door number should be string' },
    aci_id: { targetType: 'number', description: 'AC ID should be number' }
  },
  surveyResponses: {
    aci_id: { targetType: 'number', description: 'AC ID should be number' },
    respondentAge: { targetType: 'number', description: 'Age should be number' }
  },
  mobileAppAnswers: {
    aci_id: { targetType: 'number', description: 'AC ID should be number' }
  },
  boothAgentActivities: {
    aci_id: { targetType: 'number', description: 'AC ID should be number' },
    timeSpentMinutes: { targetType: 'number', description: 'Time should be number' },
    surveyCount: { targetType: 'number', description: 'Count should be number' },
    voterInteractions: { targetType: 'number', description: 'Count should be number' }
  }
};

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Check if value needs type conversion
 */
function needsConversion(value, targetType) {
  if (value === null || value === undefined) return false;

  const currentType = typeof value;

  if (targetType === 'string' && currentType !== 'string') {
    return true;
  }

  if (targetType === 'number' && currentType !== 'number') {
    // Check if string can be converted to valid number
    if (currentType === 'string') {
      const num = Number(value);
      return !isNaN(num);
    }
    return false;
  }

  return false;
}

/**
 * Convert value to target type
 */
function convertValue(value, targetType) {
  if (targetType === 'string') {
    return String(value);
  }
  if (targetType === 'number') {
    return Number(value);
  }
  return value;
}

/**
 * Migrate a collection with type normalization
 */
async function migrateCollection(db, collectionName, rules) {
  // Check if collection exists
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    console.log(`  [${collectionName}] Collection does not exist, skipping`);
    return { analyzed: 0, needsFix: 0, fixed: 0 };
  }

  const collection = db.collection(collectionName);

  // Build query to find documents with wrong types
  const orConditions = [];
  for (const [field, rule] of Object.entries(rules)) {
    if (rule.targetType === 'string') {
      orConditions.push({ [field]: { $exists: true, $type: 'number' } });
    } else if (rule.targetType === 'number') {
      orConditions.push({ [field]: { $exists: true, $type: 'string' } });
    }
  }

  if (orConditions.length === 0) {
    return { analyzed: 0, needsFix: 0, fixed: 0 };
  }

  const query = { $or: orConditions };
  const needsFix = await collection.countDocuments(query);

  console.log(`  [${collectionName}] Found ${needsFix} documents with type issues`);

  // Show sample of issues in dry run
  if (DRY_RUN && needsFix > 0) {
    const sample = await collection.findOne(query);
    console.log(`    Sample document issues:`);
    for (const [field, rule] of Object.entries(rules)) {
      if (sample && sample[field] !== undefined) {
        const currentType = typeof sample[field];
        if (currentType !== rule.targetType) {
          console.log(`      ${field}: ${currentType} -> ${rule.targetType} (value: ${sample[field]})`);
        }
      }
    }
  }

  if (needsFix === 0 || DRY_RUN) {
    return { analyzed: needsFix, needsFix, fixed: 0 };
  }

  // Create backup
  const backupName = collectionName + BACKUP_SUFFIX;
  console.log(`  [${collectionName}] Creating backup: ${backupName}`);
  const docsToBackup = await collection.find(query).limit(10000).toArray();
  if (docsToBackup.length > 0) {
    await db.collection(backupName).insertMany(docsToBackup);
  }

  // Process in batches
  let fixed = 0;
  let cursor = collection.find(query).batchSize(BATCH_SIZE);

  const bulkOps = [];
  for await (const doc of cursor) {
    const updates = {};

    for (const [field, rule] of Object.entries(rules)) {
      if (doc[field] !== undefined && needsConversion(doc[field], rule.targetType)) {
        updates[field] = convertValue(doc[field], rule.targetType);
      }
    }

    if (Object.keys(updates).length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: updates }
        }
      });
    }

    if (bulkOps.length >= BATCH_SIZE) {
      const result = await collection.bulkWrite(bulkOps);
      fixed += result.modifiedCount;
      console.log(`  [${collectionName}] Processed batch: ${fixed}/${needsFix}`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    const result = await collection.bulkWrite(bulkOps);
    fixed += result.modifiedCount;
  }

  console.log(`  [${collectionName}] Type normalization complete: ${fixed} documents fixed`);
  return { analyzed: needsFix, needsFix, fixed };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Universal Migration: Normalize Field Types');
  console.log('='.repeat(80));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Target ACs: ${ALL_AC_IDS.join(', ')}`);
  console.log('='.repeat(80));

  console.log('\nNormalization Rules:');
  for (const [collectionType, rules] of Object.entries(NORMALIZATION_RULES)) {
    console.log(`  ${collectionType}:`);
    for (const [field, rule] of Object.entries(rules)) {
      console.log(`    - ${field}: -> ${rule.targetType} (${rule.description})`);
    }
  }

  if (!DRY_RUN) {
    console.log('\nWARNING: This will modify your database!');
    console.log('Backups will be created with suffix:', BACKUP_SUFFIX);
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  await connectToDatabase();
  const db = mongoose.connection.db;

  const summary = {
    voters: { analyzed: 0, needsFix: 0, fixed: 0 },
    surveyResponses: { analyzed: 0, needsFix: 0, fixed: 0 },
    mobileAppAnswers: { analyzed: 0, needsFix: 0, fixed: 0 },
    boothAgentActivities: { analyzed: 0, needsFix: 0, fixed: 0 }
  };

  for (const acId of ALL_AC_IDS) {
    console.log(`\n[AC ${acId}] Processing...`);

    // Voters
    const vr = await migrateCollection(db, `voters_${acId}`, NORMALIZATION_RULES.voters);
    summary.voters.analyzed += vr.analyzed;
    summary.voters.needsFix += vr.needsFix;
    summary.voters.fixed += vr.fixed;

    // Survey Responses
    const sr = await migrateCollection(db, `surveyresponses_${acId}`, NORMALIZATION_RULES.surveyResponses);
    summary.surveyResponses.analyzed += sr.analyzed;
    summary.surveyResponses.needsFix += sr.needsFix;
    summary.surveyResponses.fixed += sr.fixed;

    // Mobile App Answers
    const ma = await migrateCollection(db, `mobileappanswers_${acId}`, NORMALIZATION_RULES.mobileAppAnswers);
    summary.mobileAppAnswers.analyzed += ma.analyzed;
    summary.mobileAppAnswers.needsFix += ma.needsFix;
    summary.mobileAppAnswers.fixed += ma.fixed;

    // Booth Agent Activities
    const ba = await migrateCollection(db, `boothagentactivities_${acId}`, NORMALIZATION_RULES.boothAgentActivities);
    summary.boothAgentActivities.analyzed += ba.analyzed;
    summary.boothAgentActivities.needsFix += ba.needsFix;
    summary.boothAgentActivities.fixed += ba.fixed;
  }

  console.log('\n' + '='.repeat(80));
  console.log('Type Normalization Summary');
  console.log('='.repeat(80));

  for (const [collectionType, stats] of Object.entries(summary)) {
    console.log(`${collectionType}: ${stats.fixed}/${stats.needsFix} fixed (${stats.analyzed} analyzed)`);
  }

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. To execute migration, run with:');
    console.log('  DRY_RUN=false node server/migrations/universal/normalizeFieldTypes.js');
  }

  console.log('='.repeat(80));
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
