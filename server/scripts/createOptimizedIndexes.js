/**
 * Create Optimized MongoDB Indexes for High-Scale Performance
 *
 * Run this script to create indexes on all voter collections.
 * These indexes significantly improve query performance for:
 * - Family lookups
 * - Booth filtering
 * - Dashboard analytics
 * - Survey status queries
 *
 * Usage: node server/scripts/createOptimizedIndexes.js
 */

import mongoose from 'mongoose';
import { MONGODB_URI } from '../config/index.js';

// All AC IDs in the system
const AC_IDS = [101, 102, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126];

// Indexes to create on each voter collection
const VOTER_INDEXES = [
  // Primary lookup indexes
  { key: { familyId: 1 }, name: 'idx_familyId' },
  { key: { boothno: 1 }, name: 'idx_boothno' },
  { key: { booth_id: 1 }, name: 'idx_booth_id' },
  { key: { voterID: 1 }, name: 'idx_voterID', options: { unique: true, sparse: true } },

  // Compound indexes for common queries
  { key: { familyId: 1, boothno: 1 }, name: 'idx_family_booth' },
  { key: { boothno: 1, familyId: 1 }, name: 'idx_booth_family' },
  { key: { surveyed: 1, boothno: 1 }, name: 'idx_surveyed_booth' },

  // Analytics indexes
  { key: { gender: 1 }, name: 'idx_gender' },
  { key: { age: 1 }, name: 'idx_age' },
  { key: { surveyed: 1 }, name: 'idx_surveyed' },

  // Text search index for name fields
  { key: { 'name.english': 'text', 'name.tamil': 'text', address: 'text' }, name: 'idx_text_search' },
];

// Indexes for other collections
const OTHER_INDEXES = {
  users: [
    { key: { role: 1 }, name: 'idx_role' },
    { key: { assignedAC: 1 }, name: 'idx_assignedAC' },
    { key: { email: 1 }, name: 'idx_email', options: { unique: true, sparse: true } },
    { key: { phone: 1 }, name: 'idx_phone', options: { unique: true, sparse: true } },
    { key: { deleted: 1, role: 1 }, name: 'idx_deleted_role' },
  ],
  booths: [
    { key: { acId: 1 }, name: 'idx_acId' },
    { key: { boothNumber: 1, acId: 1 }, name: 'idx_booth_ac' },
    { key: { deleted: 1, acId: 1 }, name: 'idx_deleted_ac' },
  ],
  surveys: [
    { key: { acId: 1 }, name: 'idx_acId' },
    { key: { status: 1 }, name: 'idx_status' },
    { key: { deleted: 1, status: 1 }, name: 'idx_deleted_status' },
  ],
  surveyresponses: [
    { key: { surveyId: 1 }, name: 'idx_surveyId' },
    { key: { familyId: 1 }, name: 'idx_familyId' },
    { key: { acId: 1 }, name: 'idx_acId' },
    { key: { boothId: 1 }, name: 'idx_boothId' },
    { key: { createdAt: -1 }, name: 'idx_createdAt' },
    { key: { surveyId: 1, acId: 1, createdAt: -1 }, name: 'idx_survey_ac_date' },
  ],
  mobileappresponses: [
    { key: { surveyId: 1 }, name: 'idx_surveyId' },
    { key: { acId: 1 }, name: 'idx_acId' },
    { key: { submittedAt: -1 }, name: 'idx_submittedAt' },
  ],
  sessions: [
    { key: { expires: 1 }, name: 'idx_expires', options: { expireAfterSeconds: 0 } },
  ],
};

async function createIndexes() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       MONGODB INDEX OPTIMIZATION SCRIPT                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✓ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    let totalIndexes = 0;
    let createdIndexes = 0;
    let skippedIndexes = 0;
    let errors = 0;

    // Create indexes on voter collections
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('PHASE 1: VOTER COLLECTION INDEXES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const acId of AC_IDS) {
      const collectionName = `voters_${acId}`;

      try {
        // Check if collection exists
        const collections = await db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
          console.log(`  ⏭ Skipping ${collectionName} (does not exist)`);
          continue;
        }

        const collection = db.collection(collectionName);
        const existingIndexes = await collection.indexes();
        const existingNames = existingIndexes.map(idx => idx.name);

        console.log(`  Processing ${collectionName}...`);

        for (const indexDef of VOTER_INDEXES) {
          totalIndexes++;

          if (existingNames.includes(indexDef.name)) {
            skippedIndexes++;
            continue;
          }

          try {
            await collection.createIndex(indexDef.key, {
              name: indexDef.name,
              background: true, // Don't block other operations
              ...indexDef.options
            });
            createdIndexes++;
            console.log(`    ✓ Created ${indexDef.name}`);
          } catch (err) {
            if (err.code === 85 || err.code === 86) {
              // Index exists with different options, skip
              skippedIndexes++;
            } else {
              errors++;
              console.log(`    ✗ Failed ${indexDef.name}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        console.log(`  ✗ Error processing ${collectionName}: ${err.message}`);
        errors++;
      }
    }

    // Create indexes on other collections
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('PHASE 2: OTHER COLLECTION INDEXES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const [collectionName, indexes] of Object.entries(OTHER_INDEXES)) {
      try {
        const collections = await db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
          console.log(`  ⏭ Skipping ${collectionName} (does not exist)`);
          continue;
        }

        const collection = db.collection(collectionName);
        const existingIndexes = await collection.indexes();
        const existingNames = existingIndexes.map(idx => idx.name);

        console.log(`  Processing ${collectionName}...`);

        for (const indexDef of indexes) {
          totalIndexes++;

          if (existingNames.includes(indexDef.name)) {
            skippedIndexes++;
            continue;
          }

          try {
            await collection.createIndex(indexDef.key, {
              name: indexDef.name,
              background: true,
              ...indexDef.options
            });
            createdIndexes++;
            console.log(`    ✓ Created ${indexDef.name}`);
          } catch (err) {
            if (err.code === 85 || err.code === 86) {
              skippedIndexes++;
            } else {
              errors++;
              console.log(`    ✗ Failed ${indexDef.name}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        console.log(`  ✗ Error processing ${collectionName}: ${err.message}`);
        errors++;
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`  Total indexes checked: ${totalIndexes}`);
    console.log(`  Created: ${createdIndexes}`);
    console.log(`  Skipped (already exist): ${skippedIndexes}`);
    console.log(`  Errors: ${errors}`);
    console.log('');

    if (errors === 0) {
      console.log('✓ Index optimization completed successfully!');
    } else {
      console.log(`⚠ Completed with ${errors} errors`);
    }

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

createIndexes();
