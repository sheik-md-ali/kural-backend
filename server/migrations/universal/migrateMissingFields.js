/**
 * Universal Migration Script: Add Missing Standard Fields
 *
 * This script adds missing standard fields (aci_name, boothname, boothno)
 * to documents in all AC-sharded collections.
 *
 * IMPORTANT: This script does NOT execute automatically.
 * It must be run manually with proper backup procedures.
 *
 * Usage:
 *   DRY_RUN=true node server/migrations/universal/migrateMissingFields.js
 *   node server/migrations/universal/migrateMissingFields.js
 *
 * Features:
 * - Dry-run mode (default: true)
 * - Batch processing to avoid memory issues
 * - Progress logging
 * - Rollback capability via backup collections
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '../../config/database.js';
import { ALL_AC_IDS } from '../../utils/voterCollection.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.env.DRY_RUN !== 'false';
const BATCH_SIZE = 500;
const BACKUP_SUFFIX = '_backup_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

// AC Names lookup
const AC_NAMES = {
  101: 'Dharapuram (SC)',
  102: 'Kangayam',
  108: 'Udhagamandalam',
  109: 'Gudalur (SC)',
  110: 'Coonoor',
  111: 'Mettupalayam',
  112: 'Avanashi (SC)',
  113: 'Tiruppur North',
  114: 'Tiruppur South',
  115: 'Palladam',
  116: 'Sulur',
  117: 'Kavundampalayam',
  118: 'Coimbatore North',
  119: 'Thondamuthur',
  120: 'Coimbatore South',
  121: 'Singanallur',
  122: 'Kinathukadavu',
  123: 'Pollachi',
  124: 'Valparai (SC)',
  125: 'Udumalaipettai',
  126: 'Madathukulam'
};

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Build booth lookup from voters collection for an AC
 */
async function buildBoothLookup(db, acId) {
  const votersCollection = db.collection(`voters_${acId}`);
  const booths = await votersCollection.aggregate([
    { $match: { booth_id: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: '$booth_id',
        boothname: { $first: '$boothname' },
        boothno: { $first: '$boothno' }
      }
    }
  ]).toArray();

  const lookup = {};
  for (const booth of booths) {
    lookup[booth._id] = {
      boothname: booth.boothname,
      boothno: booth.boothno
    };
  }
  return lookup;
}

/**
 * Migrate survey responses collection for an AC
 */
async function migrateSurveyResponses(db, acId, boothLookup) {
  const collectionName = `surveyresponses_${acId}`;
  const collection = db.collection(collectionName);

  // Check if collection exists
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    console.log(`  [${collectionName}] Collection does not exist, skipping`);
    return { updated: 0, total: 0 };
  }

  // Find documents missing standard fields
  const query = {
    $or: [
      { aci_name: { $exists: false } },
      { boothname: { $exists: false } },
      { boothno: { $exists: false } }
    ]
  };

  const total = await collection.countDocuments(query);
  console.log(`  [${collectionName}] Found ${total} documents with missing fields`);

  if (total === 0 || DRY_RUN) {
    return { updated: 0, total };
  }

  // Create backup
  const backupName = collectionName + BACKUP_SUFFIX;
  console.log(`  [${collectionName}] Creating backup: ${backupName}`);
  const docsToBackup = await collection.find(query).toArray();
  if (docsToBackup.length > 0) {
    await db.collection(backupName).insertMany(docsToBackup);
  }

  // Process in batches
  let updated = 0;
  let cursor = collection.find(query).batchSize(BATCH_SIZE);

  const bulkOps = [];
  for await (const doc of cursor) {
    const updates = {};

    // Add aci_name if missing
    if (!doc.aci_name) {
      const acIdNum = Number(doc.aci_id || doc.acId || doc._acId || acId);
      updates.aci_name = AC_NAMES[acIdNum] || null;
    }

    // Add booth fields if missing
    const boothId = doc.booth_id || doc.boothId || doc.boothCode;
    if (boothId && boothLookup[boothId]) {
      if (!doc.boothname) updates.boothname = boothLookup[boothId].boothname;
      if (!doc.boothno) updates.boothno = boothLookup[boothId].boothno;
    } else if (boothId && !doc.boothno) {
      // Extract boothno from booth_id pattern "BOOTH1-111"
      const match = boothId.match(/^(BOOTH\d+)/i);
      if (match) updates.boothno = match[1].toUpperCase();
    }

    if (Object.keys(updates).length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: updates }
        }
      });
    }

    if (bulkOps.length >= BATCH_SIZE) {
      const result = await collection.bulkWrite(bulkOps);
      updated += result.modifiedCount;
      console.log(`  [${collectionName}] Processed batch: ${updated}/${total}`);
      bulkOps.length = 0;
    }
  }

  // Process remaining
  if (bulkOps.length > 0) {
    const result = await collection.bulkWrite(bulkOps);
    updated += result.modifiedCount;
  }

  console.log(`  [${collectionName}] Migration complete: ${updated} documents updated`);
  return { updated, total };
}

/**
 * Migrate mobile app answers collection for an AC
 */
async function migrateMobileAppAnswers(db, acId, boothLookup) {
  const collectionName = `mobileappanswers_${acId}`;
  const collection = db.collection(collectionName);

  // Check if collection exists
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    console.log(`  [${collectionName}] Collection does not exist, skipping`);
    return { updated: 0, total: 0 };
  }

  // Find documents missing standard fields
  const query = {
    $or: [
      { aci_name: { $exists: false } },
      { boothname: { $exists: false } },
      { boothno: { $exists: false } }
    ]
  };

  const total = await collection.countDocuments(query);
  console.log(`  [${collectionName}] Found ${total} documents with missing fields`);

  if (total === 0 || DRY_RUN) {
    return { updated: 0, total };
  }

  // Create backup
  const backupName = collectionName + BACKUP_SUFFIX;
  console.log(`  [${collectionName}] Creating backup: ${backupName}`);
  const docsToBackup = await collection.find(query).toArray();
  if (docsToBackup.length > 0) {
    await db.collection(backupName).insertMany(docsToBackup);
  }

  // Process in batches
  let updated = 0;
  let cursor = collection.find(query).batchSize(BATCH_SIZE);

  const bulkOps = [];
  for await (const doc of cursor) {
    const updates = {};

    // Add aci_name if missing
    if (!doc.aci_name) {
      const acIdNum = Number(doc.aci_id || doc.acId || doc.aciId || acId);
      updates.aci_name = AC_NAMES[acIdNum] || null;
    }

    // Add booth fields if missing
    const boothId = doc.booth_id || doc.boothId;
    if (boothId && boothLookup[boothId]) {
      if (!doc.boothname) updates.boothname = boothLookup[boothId].boothname;
      if (!doc.boothno) updates.boothno = boothLookup[boothId].boothno;
    } else if (boothId && !doc.boothno) {
      const match = boothId.match(/^(BOOTH\d+)/i);
      if (match) updates.boothno = match[1].toUpperCase();
    }

    if (Object.keys(updates).length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: updates }
        }
      });
    }

    if (bulkOps.length >= BATCH_SIZE) {
      const result = await collection.bulkWrite(bulkOps);
      updated += result.modifiedCount;
      console.log(`  [${collectionName}] Processed batch: ${updated}/${total}`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    const result = await collection.bulkWrite(bulkOps);
    updated += result.modifiedCount;
  }

  console.log(`  [${collectionName}] Migration complete: ${updated} documents updated`);
  return { updated, total };
}

/**
 * Migrate booth agent activities collection for an AC
 */
async function migrateBoothAgentActivities(db, acId, boothLookup) {
  const collectionName = `boothagentactivities_${acId}`;
  const collection = db.collection(collectionName);

  // Check if collection exists
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    console.log(`  [${collectionName}] Collection does not exist, skipping`);
    return { updated: 0, total: 0 };
  }

  // Find documents missing standard fields (aci_name is often present, but boothname/boothno are missing)
  const query = {
    $or: [
      { boothname: { $exists: false } },
      { boothno: { $exists: false } }
    ]
  };

  const total = await collection.countDocuments(query);
  console.log(`  [${collectionName}] Found ${total} documents with missing fields`);

  if (total === 0 || DRY_RUN) {
    return { updated: 0, total };
  }

  // Create backup
  const backupName = collectionName + BACKUP_SUFFIX;
  console.log(`  [${collectionName}] Creating backup: ${backupName}`);
  const docsToBackup = await collection.find(query).toArray();
  if (docsToBackup.length > 0) {
    await db.collection(backupName).insertMany(docsToBackup);
  }

  // Process in batches
  let updated = 0;
  let cursor = collection.find(query).batchSize(BATCH_SIZE);

  const bulkOps = [];
  for await (const doc of cursor) {
    const updates = {};

    // Add booth fields if missing
    const boothId = doc.booth_id;
    if (boothId && boothLookup[boothId]) {
      if (!doc.boothname) updates.boothname = boothLookup[boothId].boothname;
      if (!doc.boothno) updates.boothno = boothLookup[boothId].boothno;
    } else if (boothId && !doc.boothno) {
      const match = boothId.match(/^(BOOTH\d+)/i);
      if (match) updates.boothno = match[1].toUpperCase();
    }

    if (Object.keys(updates).length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: updates }
        }
      });
    }

    if (bulkOps.length >= BATCH_SIZE) {
      const result = await collection.bulkWrite(bulkOps);
      updated += result.modifiedCount;
      console.log(`  [${collectionName}] Processed batch: ${updated}/${total}`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    const result = await collection.bulkWrite(bulkOps);
    updated += result.modifiedCount;
  }

  console.log(`  [${collectionName}] Migration complete: ${updated} documents updated`);
  return { updated, total };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Universal Migration: Add Missing Standard Fields');
  console.log('='.repeat(80));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Target ACs: ${ALL_AC_IDS.join(', ')}`);
  console.log('='.repeat(80));

  if (!DRY_RUN) {
    console.log('\nWARNING: This will modify your database!');
    console.log('Backups will be created with suffix:', BACKUP_SUFFIX);
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  await connectToDatabase();
  const db = mongoose.connection.db;

  const summary = {
    surveyResponses: { updated: 0, total: 0 },
    mobileAppAnswers: { updated: 0, total: 0 },
    boothAgentActivities: { updated: 0, total: 0 }
  };

  for (const acId of ALL_AC_IDS) {
    console.log(`\n[AC ${acId}] Processing...`);

    // Build booth lookup from voters
    const boothLookup = await buildBoothLookup(db, acId);
    console.log(`  Found ${Object.keys(boothLookup).length} booths in voters_${acId}`);

    // Migrate each collection
    const sr = await migrateSurveyResponses(db, acId, boothLookup);
    summary.surveyResponses.updated += sr.updated;
    summary.surveyResponses.total += sr.total;

    const ma = await migrateMobileAppAnswers(db, acId, boothLookup);
    summary.mobileAppAnswers.updated += ma.updated;
    summary.mobileAppAnswers.total += ma.total;

    const ba = await migrateBoothAgentActivities(db, acId, boothLookup);
    summary.boothAgentActivities.updated += ba.updated;
    summary.boothAgentActivities.total += ba.total;
  }

  console.log('\n' + '='.repeat(80));
  console.log('Migration Summary');
  console.log('='.repeat(80));
  console.log(`Survey Responses: ${summary.surveyResponses.updated}/${summary.surveyResponses.total} updated`);
  console.log(`Mobile App Answers: ${summary.mobileAppAnswers.updated}/${summary.mobileAppAnswers.total} updated`);
  console.log(`Booth Agent Activities: ${summary.boothAgentActivities.updated}/${summary.boothAgentActivities.total} updated`);

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. To execute migration, run with:');
    console.log('  DRY_RUN=false node server/migrations/universal/migrateMissingFields.js');
  }

  console.log('='.repeat(80));
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
