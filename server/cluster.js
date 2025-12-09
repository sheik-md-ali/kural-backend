/**
 * Node.js Cluster Manager - Safe Mode
 *
 * Production: CPU_CORES - 1 workers (leaves headroom for OS/system tasks)
 * Development: 1 worker (simpler debugging, hot reload compatible)
 *
 * Features:
 * - Auto-restart crashed workers with rate limiting
 * - Graceful shutdown handling
 * - Environment-aware worker count
 * - Structured logging with Pino
 */

import cluster from 'cluster';
import os from 'os';
import { createRequire } from 'module';

// Create require for CommonJS modules (logger)
const require = createRequire(import.meta.url);
const logger = require('./utils/logger.cjs');

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const cpuCount = os.cpus().length;

// Safe worker count calculation
// Production: CPU_CORES - 1 (minimum 1, maximum based on available cores)
// Development: Always 1 worker for simpler debugging
const WORKERS = process.env.CLUSTER_WORKERS
  ? parseInt(process.env.CLUSTER_WORKERS, 10)
  : isProduction
    ? Math.max(1, cpuCount - 1)
    : 1;

// Restart configuration
const RESTART_DELAY_MS = 1000;
const MAX_RESTARTS = 5;
const RESTART_WINDOW_MS = 60000; // 1 minute

if (cluster.isPrimary) {
  // Create primary logger
  const primaryLogger = logger.child({ role: 'primary', pid: process.pid });

  primaryLogger.info('╔══════════════════════════════════════════════════════════════╗');
  primaryLogger.info('║         KURAL BACKEND - CLUSTER MODE (SAFE)                  ║');
  primaryLogger.info('╚══════════════════════════════════════════════════════════════╝');
  primaryLogger.info({ pid: process.pid }, 'Primary process started');
  primaryLogger.info({ environment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT' }, 'Environment');
  primaryLogger.info({ cpuCount, workersToSpawn: WORKERS }, 'CPU configuration');

  // Track worker restart history
  const restartHistory = new Map();

  // Fork initial workers
  for (let i = 0; i < WORKERS; i++) {
    const worker = cluster.fork();
    primaryLogger.info({ workerId: worker.id, pid: worker.process.pid }, 'Forking worker');
  }

  // Handle worker coming online
  cluster.on('online', (worker) => {
    primaryLogger.info(
      { workerId: worker.id, pid: worker.process.pid },
      'Worker is online'
    );
  });

  // Handle worker exit with restart rate limiting
  cluster.on('exit', (worker, code, signal) => {
    const workerId = worker.id;
    const exitReason = signal || `code ${code}`;

    primaryLogger.warn(
      { workerId, pid: worker.process.pid, code, signal, exitReason },
      'Worker exited'
    );

    // Check restart rate
    const now = Date.now();
    const history = restartHistory.get(workerId) || [];
    const recentRestarts = history.filter(time => now - time < RESTART_WINDOW_MS);

    if (recentRestarts.length >= MAX_RESTARTS) {
      primaryLogger.error(
        { workerId, maxRestarts: MAX_RESTARTS, windowMs: RESTART_WINDOW_MS },
        'Worker exceeded restart limit. Not restarting.'
      );

      // Check if all workers are dead
      const activeWorkers = Object.keys(cluster.workers).length;
      if (activeWorkers === 0) {
        primaryLogger.fatal({ activeWorkers: 0 }, 'All workers dead. Exiting primary process.');
        process.exit(1);
      }
      return;
    }

    // Record restart and spawn new worker
    recentRestarts.push(now);
    restartHistory.set(workerId, recentRestarts);

    primaryLogger.info({ workerId, delayMs: RESTART_DELAY_MS }, 'Scheduling worker restart');
    setTimeout(() => {
      const newWorker = cluster.fork();
      primaryLogger.info(
        { newWorkerId: newWorker.id, pid: newWorker.process.pid },
        'New worker spawned'
      );
    }, RESTART_DELAY_MS);
  });

  // Graceful shutdown handler
  const gracefulShutdown = (signal) => {
    primaryLogger.info({ signal }, 'Received shutdown signal, initiating graceful shutdown');

    // Send SIGTERM to all workers
    for (const id in cluster.workers) {
      const worker = cluster.workers[id];
      if (worker) {
        primaryLogger.info({ workerId: id, pid: worker.process.pid }, 'Sending SIGTERM to worker');
        worker.kill('SIGTERM');
      }
    }

    // Force exit after timeout
    const forceExitTimeout = setTimeout(() => {
      primaryLogger.warn('Force exiting after timeout');
      process.exit(0);
    }, 10000);

    // Clear timeout if all workers exit cleanly
    cluster.on('exit', () => {
      const remaining = Object.keys(cluster.workers).length;
      if (remaining === 0) {
        clearTimeout(forceExitTimeout);
        primaryLogger.info('All workers exited cleanly');
        process.exit(0);
      }
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

} else {
  // Worker process - create worker logger
  const workerLogger = logger.child({ role: 'worker', workerId: cluster.worker?.id, pid: process.pid });

  workerLogger.info('Worker process starting');

  // Load the main server
  import('./index.js')
    .then(() => {
      workerLogger.info('Worker successfully loaded server');
    })
    .catch(err => {
      workerLogger.fatal({ err }, 'Worker failed to start server');
      process.exit(1);
    });
}
