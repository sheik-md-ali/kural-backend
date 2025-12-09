/**
 * HTTP Request Logging Middleware
 *
 * Features:
 * - Generates correlation ID (UUID v4) for request tracing
 * - Logs method, URL, status code, response time
 * - Attaches req.correlationId for downstream use
 * - Structured JSON logging with Pino
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger.cjs');

/**
 * Request logging middleware
 * Should be registered early in the middleware chain
 */
function requestLogger(req, res, next) {
  // Generate correlation ID
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;

  // Attach correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);

  // Record start time
  const startTime = process.hrtime.bigint();

  // Create request-scoped logger
  req.log = logger.child({ correlationId });

  // Log request start (debug level to avoid noise)
  req.log.debug(
    {
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress
    },
    'Incoming request'
  );

  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    // Calculate response time in milliseconds
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    // Determine log level based on status code
    const statusCode = res.statusCode;
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    // Log request completion
    logger[logLevel](
      {
        correlationId,
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        contentLength: res.getHeader('content-length'),
        userId: req.session?.user?._id || null
      },
      `${req.method} ${req.originalUrl || req.url} ${statusCode} ${Math.round(durationMs)}ms`
    );
  };

  next();
}

/**
 * Skip logging for specific paths (health checks, static files)
 * @param {string[]} skipPaths - Array of paths to skip logging
 */
function createRequestLogger(options = {}) {
  const skipPaths = options.skipPaths || ['/api/health', '/favicon.ico'];
  const skipExtensions = options.skipExtensions || ['.js', '.css', '.png', '.jpg', '.ico'];

  return function (req, res, next) {
    // Skip logging for specified paths
    const url = req.originalUrl || req.url;

    if (skipPaths.some(path => url.startsWith(path))) {
      // Still attach correlation ID but don't log
      req.correlationId = req.headers['x-correlation-id'] || uuidv4();
      req.log = logger.child({ correlationId: req.correlationId });
      return next();
    }

    // Skip static file extensions
    if (skipExtensions.some(ext => url.endsWith(ext))) {
      req.correlationId = req.headers['x-correlation-id'] || uuidv4();
      req.log = logger.child({ correlationId: req.correlationId });
      return next();
    }

    return requestLogger(req, res, next);
  };
}

module.exports = requestLogger;
module.exports.createRequestLogger = createRequestLogger;
