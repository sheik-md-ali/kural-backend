import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', 'env.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://kuraladmin:Kuraldb%40app%23dev2025@178.16.137.247:27017/kuraldb';

// Voter Schema
const voterSchema = new mongoose.Schema({}, { strict: false, collection: 'voters' });
const Voter = mongoose.model('Voter', voterSchema);

async function testFamilyDetail() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    // First, get one family address from the aggregation
    const acId = 119;
    const matchQuery = {
      $or: [
        { aci_num: acId },
        { aci_id: acId }
      ]
    };
    
    const familyResult = await Voter.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            address: "$address",
            booth: "$boothname",
            boothno: "$boothno"
          },
          family_head: { $first: "$name" },
          members: { $sum: 1 }
        }
      },
      { $limit: 1 }
    ]);
    
    if (familyResult.length > 0) {
      const family = familyResult[0];
      console.log('\n=== Family from aggregation ===');
      console.log('Address:', family._id.address);
      console.log('Booth:', family._id.booth);
      console.log('Members:', family.members);
      console.log('Address type:', typeof family._id.address);
      console.log('Address value (JSON):', JSON.stringify(family._id.address));
      
      // Now try to fetch members using the same address
      const detailQuery = {
        $or: [
          { aci_num: acId },
          { aci_id: acId }
        ],
        address: family._id.address
      };
      
      console.log('\n=== Querying for members ===');
      console.log('Query:', JSON.stringify(detailQuery, null, 2));
      
      const members = await Voter.find(detailQuery);
      console.log('Found members:', members.length);
      
      if (members.length > 0) {
        console.log('\nFirst member:');
        console.log('- Name:', members[0].name);
        console.log('- Address:', members[0].address);
        console.log('- Booth:', members[0].boothname);
      }
    } else {
      console.log('No families found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nConnection closed');
  }
}

testFamilyDetail();
