import mongoose from 'mongoose';
import { connectToDatabase } from '../config/database.js';

async function checkIndexStatus() {
    try {
        await connectToDatabase();

        console.log('📊 Checking Index Status...\n');

        // Check voters_111 collection
        console.log('Voters_111 Collection:');
        const voters111 = mongoose.connection.collection('voters_111');
        const voterIndexes = await voters111.indexes();

        const hasRequiredIndexes = {
            familyId_boothno: voterIndexes.some(idx => idx.name === 'idx_familyId_boothno'),
            familyId: voterIndexes.some(idx => idx.name === 'idx_familyId'),
            familyHead: voterIndexes.some(idx => idx.name === 'idx_familyHead'),
        };

        console.log('  - idx_familyId_boothno:', hasRequiredIndexes.familyId_boothno ? '✅' : '❌');
        console.log('  - idx_familyId:', hasRequiredIndexes.familyId ? '✅' : '❌');
        console.log('  - idx_familyHead:', hasRequiredIndexes.familyHead ? '✅' : '❌');

        // Check users collection
        console.log('\nUsers Collection:');
        const users = mongoose.connection.collection('users');
        const userIndexes = await users.indexes();

        const hasUserIndexes = {
            role_ac_active: userIndexes.some(idx => idx.name === 'idx_role_ac_active'),
            role_booth: userIndexes.some(idx => idx.name === 'idx_role_booth'),
            name: userIndexes.some(idx => idx.name === 'idx_name'),
        };

        console.log('  - idx_role_ac_active:', hasUserIndexes.role_ac_active ? '✅' : '❌');
        console.log('  - idx_role_booth:', hasUserIndexes.role_booth ? '✅' : '❌');
        console.log('  - idx_name:', hasUserIndexes.name ? '✅' : '❌');

        // Check booths collection
        console.log('\nBooths Collection:');
        const booths = mongoose.connection.collection('booths');
        const boothIndexes = await booths.indexes();

        const hasBoothIndexes = {
            ac_active: boothIndexes.some(idx => idx.name === 'idx_ac_active'),
            booth_id: boothIndexes.some(idx => idx.name === 'idx_booth_id'),
        };

        console.log('  - idx_ac_active:', hasBoothIndexes.ac_active ? '✅' : '❌');
        console.log('  - idx_booth_id:', hasBoothIndexes.booth_id ? '✅' : '❌');

        // Overall status
        const allGood = Object.values(hasRequiredIndexes).every(v => v) &&
            Object.values(hasUserIndexes).every(v => v) &&
            Object.values(hasBoothIndexes).every(v => v);

        console.log('\n' + '='.repeat(50));
        if (allGood) {
            console.log('✅ ALL CRITICAL INDEXES CREATED SUCCESSFULLY!');
            console.log('🚀 Your system is now optimized!');
            console.log('\nNext steps:');
            console.log('1. Restart server: pm2 restart kural-backend');
            console.log('2. Run load test: cd k6 && ./k6.exe run loadtests/local_load_test.js');
        } else {
            console.log('⚠️  Some indexes are missing. Run createPerformanceIndexes.js again.');
        }
        console.log('='.repeat(50));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkIndexStatus();
