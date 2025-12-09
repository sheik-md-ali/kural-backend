import cors from "cors";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import compression from "compression";
import mongoose from "mongoose";
import { createRequire } from 'module';

// Create require for CommonJS modules
const require = createRequire(import.meta.url);

// Import logger first (before other modules for console shim)
const logger = require('./utils/logger.cjs');

// Production console shim - redirect all console.* to Pino
if (process.env.NODE_ENV === 'production') {
  global.console = {
    log: (...args) => logger.info({ consoleArgs: args }, 'console.log'),
    info: (...args) => logger.info({ consoleArgs: args }, 'console.info'),
    warn: (...args) => logger.warn({ consoleArgs: args }, 'console.warn'),
    error: (...args) => logger.error({ consoleArgs: args }, 'console.error'),
    debug: (...args) => logger.debug({ consoleArgs: args }, 'console.debug'),
    trace: (...args) => logger.trace({ consoleArgs: args }, 'console.trace'),
    // Preserve these for debugging if needed
    dir: console.dir,
    time: console.time,
    timeEnd: console.timeEnd,
    table: console.table
  };
}

// Import logging utilities
const requestLogger = require('./middleware/requestLogger.cjs');
const { errorHandler, notFoundHandler, setupProcessErrorHandlers } = require('./middleware/errorHandler.cjs');
const { setupMongoQueryLogging, setupConnectionLogging } = require('./utils/mongoLogger.cjs');
const { startEventLoopMonitor } = require('./utils/eventLoopMonitor.cjs');

// Setup process error handlers early
setupProcessErrorHandlers();

// Import configuration
import {
  PORT,
  isProduction,
  CLIENT_ORIGINS,
  MONGODB_URI,
  SESSION_COOKIE_DOMAIN,
  SESSION_COOKIE_SAMESITE,
  SESSION_SECRET,
} from "./config/index.js";

// Import route registrar
import { registerRoutes } from "./routes/index.js";

logger.info({ pid: process.pid }, 'Starting server initialization');

const app = express();
app.set("trust proxy", 1);

// Performance optimizations
app.set("etag", false); // Disable ETags for faster responses
app.disable("x-powered-by"); // Reduce header size

// Request logging middleware - register EARLY
app.use(requestLogger.createRequestLogger({
  skipPaths: ['/favicon.ico'],
  skipExtensions: ['.js', '.css', '.png', '.jpg', '.ico', '.map']
}));

// Compression middleware - compress responses > 1kb
app.use(compression({
  level: 6, // Balanced compression level (1-9)
  threshold: 1024, // Only compress responses > 1kb
  filter: (req, res) => {
    // Skip compression for SSE or streaming
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Security middleware - adds various HTTP headers for security
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now as it may break frontend
  crossOriginEmbedderPolicy: false,
}));

// Helper function to check if origin is localhost
function isLocalhostOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
  } catch {
    return false;
  }
}

// CORS middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed =
        CLIENT_ORIGINS.includes("*") ||
        CLIENT_ORIGINS.includes(origin) ||
        (!isProduction && isLocalhostOrigin(origin));

      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn({ origin }, 'CORS origin rejected');
      return callback(
        new Error(
          `CORS origin ${origin} not allowed. Update CLIENT_ORIGIN env variable.`,
        ),
      );
    },
    credentials: true,
  }),
);

// JSON body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize MongoDB session store
logger.info('Initializing MongoDB session store');
const sessionStore = MongoStore.create({
  mongoUrl: MONGODB_URI,
  collectionName: 'sessions',
  ttl: 24 * 60 * 60, // 24 hours in seconds
  autoRemove: 'native',
  touchAfter: 24 * 3600, // lazy session update
});

sessionStore.on('create', (sessionId) => {
  logger.debug({ sessionId: sessionId.substring(0, 8) + '...' }, 'Session created');
});

sessionStore.on('destroy', (sessionId) => {
  logger.debug({ sessionId: sessionId.substring(0, 8) + '...' }, 'Session destroyed');
});

logger.info('Session store initialized');

// Session middleware
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    name: 'kural.sid',
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: SESSION_COOKIE_SAMESITE,
      path: '/',
      domain: SESSION_COOKIE_DOMAIN || undefined,
    },
  })
);

// Middleware to restore user from session
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    if (process.env.NODE_ENV === 'development') {
      logger.debug({
        userId: req.user.id || req.user._id,
        role: req.user.role,
        sessionId: req.sessionID?.substring(0, 8) + '...'
      }, 'Session restored');
    }
  }
  next();
});

// Setup MongoDB query logging
setupMongoQueryLogging(mongoose);
setupConnectionLogging(mongoose.connection);

// Start event loop monitoring
startEventLoopMonitor();

// Register all routes
registerRoutes(app);

// 404 handler (after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      environment: isProduction ? 'production' : 'development',
      pid: process.pid,
      nodeVersion: process.version
    },
    `Server listening on port ${PORT}`
  );
});

// Log successful startup
logger.info({ pid: process.pid }, 'Server initialization complete');
