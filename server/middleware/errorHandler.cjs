/**
 * Global Error Handler Middleware
 *
 * Features:
 * - Logs all unhandled errors with full context
 * - Includes correlation ID for request tracing
 * - Handles process-wide unhandled rejections and exceptions
 * - Returns consistent error responses
 */

const logger = require('../utils/logger.cjs');

/**
 * Express error handling middleware
 * Must be registered LAST after all routes
 */
function errorHandler(err, req, res, next) {
  // Get correlation ID from request
  const correlationId = req.correlationId || 'unknown';

  // Determine error details
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Log the error with full context
  logger.error(
    {
      correlationId,
      err: {
        message: err.message,
        name: err.name,
        stack: err.stack,
        code: err.code
      },
      request: {
        method: req.method,
        url: req.originalUrl || req.url,
        body: req.body ? '[PRESENT]' : '[EMPTY]',
        userId: req.session?.user?._id || null
      },
      statusCode
    },
    `Unhandled error: ${message}`
  );

  // Don't leak error details in production
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: true,
    message: isProduction && statusCode === 500 ? 'Internal Server Error' : message,
    correlationId,
    ...(isProduction ? {} : { stack: err.stack })
  });
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  const correlationId = req.correlationId || 'unknown';

  logger.warn(
    {
      correlationId,
      method: req.method,
      url: req.originalUrl || req.url
    },
    'Route not found'
  );

  res.status(404).json({
    error: true,
    message: 'Not Found',
    correlationId
  });
}

/**
 * Setup process-wide error handlers
 * Call this early in application bootstrap
 */
function setupProcessErrorHandlers() {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      {
        reason: reason instanceof Error ? {
          message: reason.message,
          stack: reason.stack,
          name: reason.name
        } : reason
      },
      'Unhandled Promise Rejection'
    );
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.fatal(
      {
        err: {
          message: err.message,
          stack: err.stack,
          name: err.name
        }
      },
      'Uncaught Exception - Process will exit'
    );

    // Give logger time to flush, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle SIGTERM for graceful shutdown logging
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, starting graceful shutdown');
  });

  // Handle SIGINT for graceful shutdown logging
  process.on('SIGINT', () => {
    logger.info('SIGINT received, starting graceful shutdown');
  });

  logger.info('Process error handlers registered');
}

module.exports = {
  errorHandler,
  notFoundHandler,
  setupProcessErrorHandlers
};
