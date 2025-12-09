/**
 * Event Loop Delay Monitor
 *
 * Features:
 * - Monitors event loop delay using perf_hooks
 * - Warns when delay exceeds threshold (default 50ms)
 * - Reports every 10 seconds
 * - Useful for detecting CPU-bound operations blocking the event loop
 */

const { monitorEventLoopDelay } = require('perf_hooks');
const cluster = require('cluster');
const logger = require('./logger.cjs');

// Configuration
const SAMPLE_INTERVAL_MS = 10000; // Report every 10 seconds
const DELAY_THRESHOLD_MS = parseInt(process.env.EVENT_LOOP_DELAY_THRESHOLD_MS, 10) || 50;

let histogram = null;
let monitorInterval = null;

/**
 * Start event loop delay monitoring
 */
function startEventLoopMonitor() {
  // Create histogram with 20ms resolution
  histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();

  const workerId = cluster.worker?.id || 'primary';
  const pid = process.pid;

  logger.info(
    { workerId, pid, threshold: DELAY_THRESHOLD_MS, intervalMs: SAMPLE_INTERVAL_MS },
    'Event loop delay monitoring started'
  );

  // Report event loop delay periodically
  monitorInterval = setInterval(() => {
    if (!histogram) return;

    const meanDelay = histogram.mean / 1e6; // Convert to milliseconds
    const maxDelay = histogram.max / 1e6;
    const minDelay = histogram.min / 1e6;
    const p99Delay = histogram.percentile(99) / 1e6;

    const metrics = {
      workerId,
      pid,
      meanMs: Math.round(meanDelay * 100) / 100,
      maxMs: Math.round(maxDelay * 100) / 100,
      minMs: Math.round(minDelay * 100) / 100,
      p99Ms: Math.round(p99Delay * 100) / 100
    };

    // Warn if mean delay exceeds threshold
    if (meanDelay > DELAY_THRESHOLD_MS) {
      logger.warn(
        metrics,
        `Event loop delay exceeded threshold: ${Math.round(meanDelay)}ms > ${DELAY_THRESHOLD_MS}ms`
      );
    } else {
      // Debug level for normal operation
      logger.debug(metrics, 'Event loop delay metrics');
    }

    // Reset histogram for next interval
    histogram.reset();

  }, SAMPLE_INTERVAL_MS);

  // Don't keep process alive just for monitoring
  if (monitorInterval.unref) {
    monitorInterval.unref();
  }

  return histogram;
}

/**
 * Stop event loop delay monitoring
 */
function stopEventLoopMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }

  if (histogram) {
    histogram.disable();
    histogram = null;
  }

  logger.info('Event loop delay monitoring stopped');
}

/**
 * Get current event loop delay metrics
 * @returns {Object|null} Current metrics or null if not monitoring
 */
function getEventLoopMetrics() {
  if (!histogram) {
    return null;
  }

  return {
    meanMs: Math.round((histogram.mean / 1e6) * 100) / 100,
    maxMs: Math.round((histogram.max / 1e6) * 100) / 100,
    minMs: Math.round((histogram.min / 1e6) * 100) / 100,
    p99Ms: Math.round((histogram.percentile(99) / 1e6) * 100) / 100,
    p95Ms: Math.round((histogram.percentile(95) / 1e6) * 100) / 100,
    p50Ms: Math.round((histogram.percentile(50) / 1e6) * 100) / 100
  };
}

module.exports = {
  startEventLoopMonitor,
  stopEventLoopMonitor,
  getEventLoopMetrics,
  DELAY_THRESHOLD_MS
};
