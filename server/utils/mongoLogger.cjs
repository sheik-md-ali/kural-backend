/**
 * MongoDB Query Logger & Slow Query Detector
 *
 * Features:
 * - Hooks into Mongoose to detect slow queries (>300ms)
 * - Logs collection, operation, query, and duration
 * - Does NOT modify query behavior
 */

const logger = require('./logger.cjs');

// Slow query threshold in milliseconds
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS, 10) || 300;

/**
 * Setup MongoDB query logging using Mongoose debug mode
 * @param {import('mongoose')} mongoose - Mongoose instance
 */
function setupMongoQueryLogging(mongoose) {
  // Only enable in non-production or when explicitly enabled
  const enableDebug = process.env.MONGO_QUERY_DEBUG === 'true' ||
                      process.env.NODE_ENV !== 'production';

  if (!enableDebug) {
    logger.info('MongoDB query debugging disabled in production');
    return;
  }

  // Track query timing using Mongoose middleware hooks
  const queryStartTimes = new WeakMap();

  // Pre-hook to capture query start time
  mongoose.Query.prototype._originalExec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = async function (...args) {
    const startTime = Date.now();
    const query = this;
    const collection = query.mongooseCollection?.name || query.model?.collection?.name || 'unknown';
    const operation = query.op || 'unknown';

    try {
      const result = await query._originalExec.apply(query, args);
      const duration = Date.now() - startTime;

      // Log slow queries
      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn(
          {
            collection,
            operation,
            durationMs: duration,
            threshold: SLOW_QUERY_THRESHOLD_MS,
            filter: sanitizeQuery(query.getFilter ? query.getFilter() : {}),
            options: query.options || {}
          },
          `Slow MongoDB query detected: ${collection}.${operation} took ${duration}ms`
        );
      }

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          collection,
          operation,
          durationMs: duration,
          filter: sanitizeQuery(query.getFilter ? query.getFilter() : {}),
          error: err.message
        },
        `MongoDB query error: ${collection}.${operation}`
      );
      throw err;
    }
  };

  // Also hook aggregations
  mongoose.Aggregate.prototype._originalExec = mongoose.Aggregate.prototype.exec;
  mongoose.Aggregate.prototype.exec = async function (...args) {
    const startTime = Date.now();
    const collection = this._model?.collection?.name || 'unknown';

    try {
      const result = await this._originalExec.apply(this, args);
      const duration = Date.now() - startTime;

      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn(
          {
            collection,
            operation: 'aggregate',
            durationMs: duration,
            threshold: SLOW_QUERY_THRESHOLD_MS,
            pipelineLength: this.pipeline ? this.pipeline().length : 0
          },
          `Slow MongoDB aggregation detected: ${collection}.aggregate took ${duration}ms`
        );
      }

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          collection,
          operation: 'aggregate',
          durationMs: duration,
          error: err.message
        },
        `MongoDB aggregation error: ${collection}.aggregate`
      );
      throw err;
    }
  };

  logger.info({ threshold: SLOW_QUERY_THRESHOLD_MS }, 'MongoDB slow query detection enabled');
}

/**
 * Sanitize query to remove sensitive data and limit size
 * @param {Object} query - MongoDB query object
 * @returns {Object} Sanitized query
 */
function sanitizeQuery(query) {
  if (!query || typeof query !== 'object') {
    return query;
  }

  const sanitized = {};
  const sensitiveFields = ['password', 'token', 'secret', 'authorization'];

  for (const [key, value] of Object.entries(query)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Limit nested object depth
      sanitized[key] = JSON.stringify(value).length > 200
        ? '[TRUNCATED]'
        : value;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Log MongoDB connection events
 * @param {import('mongoose').Connection} connection - Mongoose connection
 */
function setupConnectionLogging(connection) {
  connection.on('connected', () => {
    logger.info({ host: connection.host, name: connection.name }, 'MongoDB connected');
  });

  connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  connection.on('error', (err) => {
    logger.error({ err: err.message }, 'MongoDB connection error');
  });

  connection.on('close', () => {
    logger.info('MongoDB connection closed');
  });
}

module.exports = {
  setupMongoQueryLogging,
  setupConnectionLogging,
  SLOW_QUERY_THRESHOLD_MS
};
