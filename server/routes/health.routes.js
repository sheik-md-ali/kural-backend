import express from "express";
import cluster from "cluster";
import { connectToDatabase } from "../config/database.js";
import { createRequire } from 'module';

// Create require for CommonJS modules
const require = createRequire(import.meta.url);
const logger = require('../utils/logger.cjs');
const { getEventLoopMetrics } = require('../utils/eventLoopMonitor.cjs');

const router = express.Router();

/**
 * Enhanced health check endpoint for load balancers and monitoring
 * GET /api/health
 * Returns: { status, pid, workerId, uptime, memory, eventLoop, env, db }
 */
router.get("/", async (req, res) => {
  const startTime = Date.now();
  const correlationId = req.correlationId || 'health-check';

  // Gather memory metrics
  const memUsage = process.memoryUsage();
  const memory = {
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024) // MB
  };

  // Get event loop metrics
  const eventLoop = getEventLoopMetrics() || { status: 'not_monitoring' };

  // Worker info
  const workerId = cluster.worker?.id || 0;

  try {
    // Check database connectivity
    await connectToDatabase();
    const dbLatency = Date.now() - startTime;

    const healthData = {
      status: "ok",
      pid: process.pid,
      workerId,
      uptime: Math.floor(process.uptime()),
      memory,
      eventLoop,
      env: process.env.NODE_ENV || "development",
      db: {
        status: "connected",
        latencyMs: dbLatency
      },
      timestamp: new Date().toISOString()
    };

    // Log health check
    logger.info(
      { ...healthData, correlationId },
      'Health check requested - OK'
    );

    return res.json(healthData);
  } catch (error) {
    const healthData = {
      status: "error",
      pid: process.pid,
      workerId,
      uptime: Math.floor(process.uptime()),
      memory,
      eventLoop,
      env: process.env.NODE_ENV || "development",
      db: {
        status: "disconnected",
        error: error.message
      },
      timestamp: new Date().toISOString()
    };

    // Log health check failure
    logger.error(
      { ...healthData, correlationId, err: error.message },
      'Health check requested - ERROR'
    );

    return res.status(503).json(healthData);
  }
});

/**
 * Detailed metrics endpoint (for internal monitoring)
 * GET /api/health/metrics
 */
router.get("/metrics", async (req, res) => {
  const correlationId = req.correlationId || 'metrics-check';
  const memUsage = process.memoryUsage();

  const metrics = {
    process: {
      pid: process.pid,
      workerId: cluster.worker?.id || 0,
      uptime: Math.floor(process.uptime()),
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      arrayBuffers: Math.round((memUsage.arrayBuffers || 0) / 1024 / 1024)
    },
    eventLoop: getEventLoopMetrics() || { status: 'not_monitoring' },
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };

  logger.debug({ correlationId }, 'Metrics endpoint requested');

  res.json(metrics);
});

export default router;
