import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/userModel.js';
import { getRecommendationsForUser } from '../src/services/recommendationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spark';

async function verifyRecommendations() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    
    // Create Mock Users
    const userA = new User({
      display_name: 'Test User A',
      email: 'usera@test.com',
      password: 'password123',
      interests: ['AI', 'Cyber Security'],
      depth_level: 'deep',
      discussion_style: 'debate'
    });

    const userB = new User({
      display_name: 'Test User B',
      email: 'userb@test.com',
      password: 'password123',
      interests: ['Literature', 'Philosophy'],
      depth_level: 'surface',
      discussion_style: 'explore'
    });

    const userC = new User({
      display_name: 'Test User C',
      email: 'userc@test.com',
      password: 'password123',
      interests: ['Entrepreneurship', 'Startups'],
      depth_level: 'intermediate',
      discussion_style: 'learn'
    });

    console.log('\n--- Evaluating User A ---');
    console.log('Interests:', userA.interests);
    console.log('Depth:', userA.depth_level);
    console.log('Style:', userA.discussion_style);
    const recsA = await getRecommendationsForUser(userA);
    console.log('Top 3 Recommendations:');
    recsA.slice(0, 3).forEach(r => {
      console.log(`- ${r.name} (Score: ${r.score})`);
      r.reasons.forEach(reason => console.log(`   > ${reason}`));
    });

    console.log('\n--- Evaluating User B ---');
    console.log('Interests:', userB.interests);
    console.log('Depth:', userB.depth_level);
    console.log('Style:', userB.discussion_style);
    const recsB = await getRecommendationsForUser(userB);
    console.log('Top 3 Recommendations:');
    recsB.slice(0, 3).forEach(r => {
      console.log(`- ${r.name} (Score: ${r.score})`);
      r.reasons.forEach(reason => console.log(`   > ${reason}`));
    });

    console.log('\n--- Evaluating User C ---');
    console.log('Interests:', userC.interests);
    console.log('Depth:', userC.depth_level);
    console.log('Style:', userC.discussion_style);
    const recsC = await getRecommendationsForUser(userC);
    console.log('Top 3 Recommendations:');
    recsC.slice(0, 3).forEach(r => {
      console.log(`- ${r.name} (Score: ${r.score})`);
      r.reasons.forEach(reason => console.log(`   > ${reason}`));
    });

    process.exit(0);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

verifyRecommendations();
