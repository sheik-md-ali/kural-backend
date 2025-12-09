/**
 * MongoDB Connection Test Script
 * Tests connectivity to the database
 */

import mongoose from 'mongoose';

// Accept custom URI from command line or use default
const MONGODB_URI = process.argv[2] || 'mongodb://kuraladmin:Kuraldb%40app%23dev2025@142.93.216.27:27017/kuraldb?authSource=admin';

async function testConnection() {
  console.log('Testing MongoDB connection...');
  console.log('URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password in logs

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
    });

    console.log('\n✓ Successfully connected to MongoDB!');
    console.log('Database name:', mongoose.connection.db.databaseName);
    console.log('Host:', mongoose.connection.host);
    console.log('Port:', mongoose.connection.port);

    // List collections to verify access
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nAvailable collections:');
    collections.forEach(col => console.log('  -', col.name));

    // Close connection
    await mongoose.connection.close();
    console.log('\n✓ Connection closed successfully');

  } catch (error) {
    console.error('\n✗ Connection failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testConnection();
