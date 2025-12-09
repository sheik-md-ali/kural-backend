import mongoose from "mongoose";
import { createRequire } from 'module';
import { MONGODB_URI } from "./index.js";

// Create require for CommonJS modules
const require = createRequire(import.meta.url);
const logger = require('../utils/logger.cjs');

// Create child logger for database operations
const dbLogger = logger.child({ component: 'MongoDB' });

let indexFixAttempted = false;

// Optimized MongoDB connection options for high-scale
const MONGO_OPTIONS = {
  // Connection pool settings - increase for high concurrency
  maxPoolSize: 100,              // Max connections in pool (default: 100)
  minPoolSize: 10,               // Keep minimum connections ready

  // Timeout settings
  serverSelectionTimeoutMS: 5000, // How long to try selecting a server
  socketTimeoutMS: 45000,        // How long socket can be inactive

  // Connection behavior
  maxIdleTimeMS: 30000,          // Close idle connections after 30s
  waitQueueTimeoutMS: 10000,     // How long to wait for connection from pool

  // Read/Write concerns
  retryWrites: true,             // Retry failed writes
  retryReads: true,              // Retry failed reads

  // Compression for network efficiency
  compressors: ['zlib'],
};

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  const wasConnected = mongoose.connection.readyState === 1;

  if (!wasConnected) {
    await mongoose.connect(MONGODB_URI, MONGO_OPTIONS);
    dbLogger.info({ maxPoolSize: MONGO_OPTIONS.maxPoolSize }, 'MongoDB connected with optimized pool settings');
  }

  // Fix formNumber index to be sparse (allows multiple null values) - only once
  if (!indexFixAttempted && mongoose.connection.readyState === 1) {
    indexFixAttempted = true;
    try {
      const surveysCollection = mongoose.connection.db.collection('surveys');
      const indexes = await surveysCollection.indexes();

      // Drop old formId_1 index if it exists (legacy index from old schema)
      const formIdIndex = indexes.find(idx => idx.name === 'formId_1');
      if (formIdIndex) {
        try {
          await surveysCollection.dropIndex('formId_1');
          dbLogger.info('Dropped old formId_1 index (legacy index)');
        } catch (dropError) {
          dbLogger.debug({ error: dropError.message }, 'Could not drop formId_1 index (may not exist)');
        }
      }

      const formNumberIndex = indexes.find(idx => idx.name === 'formNumber_1');

      if (formNumberIndex) {
        if (!formNumberIndex.sparse) {
          // Drop the old non-sparse index
          try {
            await surveysCollection.dropIndex('formNumber_1');
            dbLogger.info('Dropped old formNumber_1 index');
          } catch (dropError) {
            dbLogger.debug({ error: dropError.message }, 'Could not drop index (may not exist)');
          }
          // Create a new sparse unique index
          await surveysCollection.createIndex({ formNumber: 1 }, { unique: true, sparse: true });
          dbLogger.info('Fixed formNumber index: converted to sparse');
        } else {
          dbLogger.debug('formNumber index is already sparse');
        }
      } else {
        // Create the index if it doesn't exist
        await surveysCollection.createIndex({ formNumber: 1 }, { unique: true, sparse: true });
        dbLogger.info('Created formNumber index as sparse');
      }
    } catch (error) {
      dbLogger.error({ error: error.message, stack: error.stack }, 'Error fixing formNumber index');
      // Continue even if index fix fails
    }
  }
}
