import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/userModel.js';
import Circle from '../src/models/circleModel.js';
import Community from '../src/models/communityModel.js';
import Message from '../src/models/messageModel.js';
import { findBestCircleForUser } from '../src/services/circleMatchingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spark';

async function verifyCircleMatching() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);

    // Setup Test Data
    const community = await Community.findOne({ name: 'Artificial Intelligence' });
    if (!community) throw new Error('AI community not found');

    // Clean up old test data
    await Circle.deleteMany({ community_id: community._id, capacity: 888 }); // use capacity 888 as test flag
    await User.deleteMany({ display_name: /TestCircleUser/ });
    await Message.deleteMany({ message: 'Test message for activity' });

    const createTestUser = async (name) => {
      return await User.create({
        display_name: name,
        email: `${name.replace(/\s/g, '').toLowerCase()}@test.com`,
        password: 'password123',
        interests: ['AI', 'Machine Learning'],
        depth_level: 'deep',
        discussion_style: 'explore'
      });
    };

    const joiningUser = await createTestUser('TestCircleUser Joiner');
    
    console.log('\n--- Scenario C: No Circles Exist ---');
    const resultC = await findBestCircleForUser(joiningUser, community._id);
    console.log(`Result: ${resultC === null ? 'null (Creation triggered)' : 'Circle returned'}`);
    
    // Create Circle 1 (High compatibility, occupancy 1)
    const member1 = await createTestUser('TestCircleUser M1');
    const circle1 = await Circle.create({
      community_id: community._id,
      members: [member1._id],
      capacity: 888, // flag for cleanup
      is_active: true
    });
    // Add activity
    for (let i = 0; i < 50; i++) {
      await Message.create({ circle_id: circle1._id, sender_id: member1._id, message: 'Test message for activity' });
    }

    // Create Circle 2 (High compatibility, occupancy 6)
    const membersC2 = [];
    for(let i=0; i<6; i++) {
        membersC2.push(await createTestUser(`TestCircleUser C2M${i}`));
    }
    const circle2 = await Circle.create({
      community_id: community._id,
      members: membersC2.map(m => m._id),
      capacity: 888,
      is_active: true
    });
    // Add activity
    for (let i = 0; i < 50; i++) {
      await Message.create({ circle_id: circle2._id, sender_id: membersC2[0]._id, message: 'Test message for activity' });
    }

    console.log('\n--- Scenario A: Two compatible circles with different occupancy ---');
    console.log(`Circle 1: 1 member, 50 messages. Circle 2: 6 members, 50 messages`);
    const resultA = await findBestCircleForUser(joiningUser, community._id);
    console.log(`Selected Circle ID: ${resultA._id}`);
    console.log(`Breakdown:`, resultA._scoreBreakdown);
    console.log(`Expected Circle 2 (higher occupancy) -> Winner: Circle ${resultA._id.toString() === circle2._id.toString() ? '2' : '1'}`);

    // Create Circle 3 (High compatibility, occupancy 6, NO activity)
    const circle3 = await Circle.create({
      community_id: community._id,
      members: membersC2.map(m => m._id),
      capacity: 888,
      is_active: true
    });

    console.log('\n--- Scenario B: One inactive circle with high compatibility vs Active Circle ---');
    console.log(`Circle 2: 6 members, active. Circle 3: 6 members, inactive.`);
    // We need to temporarily disable Circle 1 so it doesn't interfere
    circle1.capacity = 1; // full
    await circle1.save();
    
    const resultB = await findBestCircleForUser(joiningUser, community._id);
    console.log(`Selected Circle ID: ${resultB._id}`);
    console.log(`Breakdown:`, resultB._scoreBreakdown);
    console.log(`Expected Circle 2 (active) -> Winner: Circle ${resultB._id.toString() === circle2._id.toString() ? '2' : '3'}`);

    // Cleanup
    await Circle.deleteMany({ capacity: 888 });
    await Circle.deleteMany({ capacity: 1 });
    await User.deleteMany({ display_name: /TestCircleUser/ });
    await Message.deleteMany({ message: 'Test message for activity' });

    process.exit(0);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

verifyCircleMatching();
