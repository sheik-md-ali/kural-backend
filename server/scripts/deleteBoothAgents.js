import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI not found in .env file');
  process.exit(1);
}

async function deleteBoothAgents() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Find all booth agents (handle both "BoothAgent" and "Booth Agent" roles)
    const boothAgentQuery = {
      $or: [
        { role: "BoothAgent" },
        { role: "Booth Agent" }
      ]
    };

    // Get total count before deletion
    const totalBefore = await User.countDocuments(boothAgentQuery);
    console.log(`Total booth agents found: ${totalBefore}`);

    if (totalBefore === 0) {
      console.log('\nNo booth agents found in the database.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Show sample of what will be deleted (first 10 records)
    console.log('\nSample of booth agents that will be deleted:');
    const samples = await User.find(boothAgentQuery)
      .limit(10)
      .select('name email phone role assignedAC createdAt')
      .lean();
    
    samples.forEach((user, index) => {
      console.log(`${index + 1}. Name: ${user.name || 'N/A'}, Email: ${user.email || 'N/A'}, Phone: ${user.phone || 'N/A'}, Role: ${user.role}, AC: ${user.assignedAC || 'N/A'}`);
    });
    
    if (totalBefore > 10) {
      console.log(`... and ${totalBefore - 10} more`);
    }
    console.log('');

    // Confirm deletion
    console.log('⚠️  WARNING: This will PERMANENTLY DELETE all booth agents from the database!');
    console.log(`This action will delete ${totalBefore} user(s) and cannot be undone.\n`);

    const startTime = Date.now();

    // Delete all booth agents
    console.log('Starting deletion...\n');
    const result = await User.deleteMany(boothAgentQuery);

    // Get total count after deletion
    const totalAfter = await User.countDocuments(boothAgentQuery);
    const actualDeleted = result.deletedCount;

    console.log('\n' + '='.repeat(60));
    console.log('DELETION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Booth agents before deletion: ${totalBefore}`);
    console.log(`Booth agents after deletion: ${totalAfter}`);
    console.log(`Total booth agents deleted: ${actualDeleted}`);
    console.log(`Time taken: ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
    console.log('='.repeat(60));

    if (actualDeleted > 0) {
      console.log('\n✅ Successfully deleted all booth agents from the user collection.');
    }

  } catch (error) {
    console.error('Error deleting booth agents:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  }
}

// Run the deletion
deleteBoothAgents();

