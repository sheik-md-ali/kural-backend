/**
 * Production-Grade Logger Utility
 * Uses Pino for structured JSON logging
 *
 * Features:
 * - Pretty print in development only
 * - Structured JSON in production (PM2 compatible)
 * - Correlation ID support
 * - Log levels: trace, debug, info, warn, error, fatal
 */

const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Base logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Base metadata included in every log
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV || 'development'
  },

  // Timestamp configuration
  timestamp: pino.stdTimeFunctions.isoTime,

  // Custom serializers for common objects
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      correlationId: req.correlationId,
      userAgent: req.headers?.['user-agent'],
      ip: req.ip || req.connection?.remoteAddress
    }),
    res: (res) => ({
      statusCode: res.statusCode
    }),
    err: pino.stdSerializers.err
  },

  // Redact sensitive fields
  redact: {
    paths: ['password', 'token', 'authorization', 'cookie', 'req.headers.cookie', 'req.headers.authorization'],
    censor: '[REDACTED]'
  }
};

// Development: pretty print to console
// Production: JSON to stdout (PM2 captures this)
const transport = isProduction || isTest
  ? undefined  // Default: JSON to stdout
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        singleLine: false
      }
    };

// Create the logger instance
const logger = transport
  ? pino(loggerConfig, pino.transport(transport))
  : pino(loggerConfig);

/**
 * Create a child logger with additional context
 * @param {Object} bindings - Additional context to include
 * @returns {pino.Logger} Child logger instance
 */
function createChildLogger(bindings) {
  return logger.child(bindings);
}

/**
 * Create a request-scoped logger with correlation ID
 * @param {string} correlationId - Request correlation ID
 * @returns {pino.Logger} Request-scoped logger
 */
function createRequestLogger(correlationId) {
  return logger.child({ correlationId });
}

/**
 * Log with worker context (for cluster mode)
 * @param {number} workerId - Cluster worker ID
 * @returns {pino.Logger} Worker-scoped logger
 */
function createWorkerLogger(workerId) {
  return logger.child({ workerId, workerPid: process.pid });
}

// Export logger and utilities
module.exports = logger;
module.exports.logger = logger;
module.exports.createChildLogger = createChildLogger;
module.exports.createRequestLogger = createRequestLogger;
module.exports.createWorkerLogger = createWorkerLogger;
