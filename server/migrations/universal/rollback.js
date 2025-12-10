/**
 * Universal Migration Rollback Script
 *
 * This script rolls back migrations by restoring from backup collections.
 *
 * Usage:
 *   node server/migrations/universal/rollback.js --backup-suffix _backup_20251210
 *   node server/migrations/universal/rollback.js --list   (list available backups)
 *
 * Options:
 *   --backup-suffix   The backup suffix to restore from (e.g., _backup_20251210)
 *   --list            List all available backup collections
 *   --dry-run         Show what would be restored without making changes
 *   --collection      Specific collection pattern to restore (e.g., surveyresponses)
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '../../config/database.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIST_MODE = args.includes('--list');

const backupSuffixIdx = args.indexOf('--backup-suffix');
const BACKUP_SUFFIX = backupSuffixIdx >= 0 ? args[backupSuffixIdx + 1] : null;

const collectionIdx = args.indexOf('--collection');
const COLLECTION_FILTER = collectionIdx >= 0 ? args[collectionIdx + 1] : null;

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * List all backup collections in the database
 */
async function listBackups(db) {
  const collections = await db.listCollections().toArray();

  const backups = collections
    .filter(c => c.name.includes('_backup_') || c.name.includes('_typefix_'))
    .map(c => {
      const match = c.name.match(/(.+?)(_backup_|_typefix_)(\d+)/);
      return {
        name: c.name,
        baseCollection: match ? match[1] : c.name,
        backupType: match ? match[2] : 'unknown',
        date: match ? match[3] : 'unknown'
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (backups.length === 0) {
    console.log('No backup collections found.');
    return;
  }

  console.log('\nAvailable Backup Collections:');
  console.log('='.repeat(80));

  // Group by date
  const byDate = {};
  for (const backup of backups) {
    const key = backup.backupType + backup.date;
    if (!byDate[key]) {
      byDate[key] = [];
    }
    byDate[key].push(backup);
  }

  for (const [key, items] of Object.entries(byDate)) {
    console.log(`\nBackup: ${items[0].backupType}${items[0].date}`);
    console.log('-'.repeat(40));
    for (const item of items) {
      const count = await db.collection(item.name).countDocuments();
      console.log(`  ${item.baseCollection}: ${count} documents`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('To rollback, use:');
  console.log('  node server/migrations/universal/rollback.js --backup-suffix <suffix>');
  console.log('\nExample:');
  console.log('  node server/migrations/universal/rollback.js --backup-suffix _backup_20251210');
}

/**
 * Restore a collection from its backup
 */
async function restoreCollection(db, backupName, originalName) {
  console.log(`\n  Restoring ${originalName} from ${backupName}...`);

  const backup = db.collection(backupName);
  const original = db.collection(originalName);

  const backupCount = await backup.countDocuments();
  console.log(`    Backup contains ${backupCount} documents`);

  if (backupCount === 0) {
    console.log(`    No documents to restore, skipping`);
    return { restored: 0 };
  }

  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would restore ${backupCount} documents`);
    return { restored: 0, wouldRestore: backupCount };
  }

  // Get all backup documents
  const backupDocs = await backup.find({}).toArray();

  // For each backup document, update the original
  let restored = 0;
  const bulkOps = [];

  for (const doc of backupDocs) {
    bulkOps.push({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: false  // Only update existing documents
      }
    });

    if (bulkOps.length >= 500) {
      const result = await original.bulkWrite(bulkOps);
      restored += result.modifiedCount;
      console.log(`    Restored ${restored}/${backupCount} documents`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    const result = await original.bulkWrite(bulkOps);
    restored += result.modifiedCount;
  }

  console.log(`    Restoration complete: ${restored} documents restored`);
  return { restored };
}

/**
 * Rollback migrations using backup collections
 */
async function rollback(db, backupSuffix) {
  const collections = await db.listCollections().toArray();

  const backupPattern = new RegExp(`(.+)${backupSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

  const backups = collections
    .filter(c => backupPattern.test(c.name))
    .filter(c => !COLLECTION_FILTER || c.name.includes(COLLECTION_FILTER))
    .map(c => {
      const match = c.name.match(backupPattern);
      return {
        backupName: c.name,
        originalName: match ? match[1] : null
      };
    })
    .filter(b => b.originalName);

  if (backups.length === 0) {
    console.log(`No backup collections found matching suffix: ${backupSuffix}`);
    if (COLLECTION_FILTER) {
      console.log(`Collection filter: ${COLLECTION_FILTER}`);
    }
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Rollback: ${backupSuffix}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE ROLLBACK'}`);
  console.log('='.repeat(80));

  console.log('\nBackups to restore:');
  for (const backup of backups) {
    const count = await db.collection(backup.backupName).countDocuments();
    console.log(`  ${backup.originalName} <- ${backup.backupName} (${count} docs)`);
  }

  if (!DRY_RUN) {
    console.log('\nWARNING: This will overwrite data in original collections!');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const summary = { total: 0, restored: 0 };

  for (const backup of backups) {
    const result = await restoreCollection(db, backup.backupName, backup.originalName);
    summary.total += 1;
    summary.restored += result.restored || 0;
  }

  console.log('\n' + '='.repeat(80));
  console.log('Rollback Summary');
  console.log('='.repeat(80));
  console.log(`Collections processed: ${summary.total}`);
  console.log(`Documents restored: ${summary.restored}`);

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. To execute rollback, remove --dry-run flag.');
  } else {
    console.log('\nRollback complete. Backup collections are preserved.');
    console.log('To clean up backup collections after verification, use:');
    console.log('  mongosh --eval \'db.getCollectionNames().filter(n => n.includes("' + backupSuffix + '")).forEach(n => db[n].drop())\'');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db;

  if (LIST_MODE) {
    await listBackups(db);
  } else if (BACKUP_SUFFIX) {
    await rollback(db, BACKUP_SUFFIX);
  } else {
    console.log('Usage:');
    console.log('  node rollback.js --list                    List available backups');
    console.log('  node rollback.js --backup-suffix <suffix>  Rollback using backups');
    console.log('\nOptions:');
    console.log('  --dry-run                 Show what would be restored');
    console.log('  --collection <pattern>    Filter to specific collection type');
    console.log('\nExamples:');
    console.log('  node rollback.js --list');
    console.log('  node rollback.js --backup-suffix _backup_20251210 --dry-run');
    console.log('  node rollback.js --backup-suffix _backup_20251210 --collection surveyresponses');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
