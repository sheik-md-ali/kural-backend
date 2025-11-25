import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI not found in .env file');
  process.exit(1);
}

// Define Voter schema
const voterSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Voter = mongoose.model('Voter', voterSchema, 'voters');

async function deleteVoters() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Get total count before deletion
    const totalBefore = await Voter.countDocuments({});
    console.log(`Total voters before deletion: ${totalBefore}`);

    // Number of records to delete
    const deleteCount = 20000;
    
    if (totalBefore < deleteCount) {
      console.log(`\nWarning: Only ${totalBefore} records exist, which is less than ${deleteCount}`);
      console.log('Proceeding to delete all available records...\n');
    }

    // Show sample of what will be deleted (first 5 records)
    console.log('Sample of records that will be deleted:');
    const samples = await Voter.find({}).limit(5).lean();
    samples.forEach((voter, index) => {
      console.log(`${index + 1}. ID: ${voter._id}, VoterID: ${voter.voterID || 'N/A'}, Name: ${voter.name?.english || voter.name || 'N/A'}`);
    });
    console.log('');

    // Delete records in batches for efficiency
    const batchSize = 1000;
    let deleted = 0;
    const startTime = Date.now();

    console.log(`Starting deletion of ${deleteCount} records in batches of ${batchSize}...\n`);

    while (deleted < deleteCount) {
      const remaining = deleteCount - deleted;
      const batchToDelete = Math.min(batchSize, remaining);
      
      // Get IDs of records to delete (oldest first)
      const votersToDelete = await Voter.find({})
        .sort({ createdAt: 1 }) // Delete oldest first
        .limit(batchToDelete)
        .select('_id')
        .lean();

      if (votersToDelete.length === 0) {
        console.log('\nNo more records to delete.');
        break;
      }

      const idsToDelete = votersToDelete.map(v => v._id);

      // Delete this batch
      const result = await Voter.deleteMany({
        _id: { $in: idsToDelete }
      });

      deleted += result.deletedCount;
      const progress = ((deleted / deleteCount) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`Batch deleted: ${result.deletedCount} records | Total deleted: ${deleted}/${deleteCount} (${progress}%) | Elapsed: ${elapsed}s`);

      if (result.deletedCount === 0) {
        console.log('\nNo more records could be deleted.');
        break;
      }

      // Small delay to prevent overwhelming the database
      if (deleted < deleteCount) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Get total count after deletion
    const totalAfter = await Voter.countDocuments({});
    const actualDeleted = totalBefore - totalAfter;

    console.log('\n' + '='.repeat(60));
    console.log('DELETION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Records before deletion: ${totalBefore}`);
    console.log(`Records after deletion: ${totalAfter}`);
    console.log(`Total records deleted: ${actualDeleted}`);
    console.log(`Time taken: ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error deleting voters:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  }
}

// Run the deletion
deleteVoters();








