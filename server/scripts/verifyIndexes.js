import mongoose from 'mongoose';
import { connectToDatabase } from '../config/database.js';

async function verifyIndexes() {
    try {
        await connectToDatabase();

        console.log('🔍 Verifying indexes and query performance...\n');

        // Test families query on AC 111
        console.log('📊 Testing Families Query (AC 111)...');
        const voters111 = mongoose.connection.collection('voters_111');

        // Check if collection exists
        const collections = await mongoose.connection.db.listCollections({ name: 'voters_111' }).toArray();
        if (collections.length === 0) {
            console.log('⚠️  voters_111 collection not found, skipping families test');
        } else {
            const familiesExplain = await voters111
                .aggregate([
                    { $match: { familyId: { $exists: true } } },
                    { $group: { _id: "$familyId", count: { $sum: 1 } } },
                    { $limit: 20 }
                ])
                .explain('executionStats');

            const stage = familiesExplain.stages?.[0]?.$cursor || familiesExplain;
            const queryPlanner = stage.queryPlanner || stage;
            const executionStats = stage.executionStats || stage;

            console.log('   Stage:', queryPlanner.winningPlan?.stage || 'N/A');
            console.log('   Index Used:', queryPlanner.winningPlan?.inputStage?.indexName || queryPlanner.winningPlan?.indexName || 'NONE');
            console.log('   Docs Examined:', executionStats.totalDocsExamined || 0);
            console.log('   Execution Time:', executionStats.executionTimeMillis || 0, 'ms');

            if (queryPlanner.winningPlan?.stage === 'COLLSCAN' || !queryPlanner.winningPlan?.inputStage?.indexName) {
                console.log('   ⚠️  WARNING: Query is doing a collection scan (slow!)');
            } else {
                console.log('   ✅ Query is using an index (fast!)');
            }
        }

        console.log('\n📊 Testing Booth Agents Query...');

        // Test booth agents query
        const users = mongoose.connection.collection('users');

        const agentsExplain = await users
            .find({ role: 'BoothAgent', isActive: true })
            .limit(20)
            .explain('executionStats');

        console.log('   Stage:', agentsExplain.queryPlanner.winningPlan.stage);
        console.log('   Index Used:', agentsExplain.queryPlanner.winningPlan.inputStage?.indexName || 'NONE');
        console.log('   Docs Examined:', agentsExplain.executionStats.totalDocsExamined);
        console.log('   Execution Time:', agentsExplain.executionStats.executionTimeMillis, 'ms');

        if (agentsExplain.queryPlanner.winningPlan.stage === 'COLLSCAN') {
            console.log('   ⚠️  WARNING: Query is doing a collection scan (slow!)');
        } else {
            console.log('   ✅ Query is using an index (fast!)');
        }

        // List all indexes
        console.log('\n📋 Listing all indexes...\n');

        console.log('Users Collection Indexes:');
        const userIndexes = await users.indexes();
        userIndexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

        if (collections.length > 0) {
            console.log('\nVoters_111 Collection Indexes:');
            const voterIndexes = await voters111.indexes();
            voterIndexes.forEach(idx => {
                console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
            });
        }

        console.log('\nBooths Collection Indexes:');
        const booths = mongoose.connection.collection('booths');
        const boothIndexes = await booths.indexes();
        boothIndexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

        console.log('\n✅ Verification complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error verifying indexes:', error);
        process.exit(1);
    }
}

verifyIndexes();
