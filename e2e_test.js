import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const globalFetch = fetch;

// Dynamically import models to ensure Mongoose knows about them
import './src/models/communityModel.js';
import './src/models/circleModel.js';

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/spark');
    console.log('Connected to DB for E2E Test');

    const BASE_URL = 'http://localhost:' + (process.env.PORT || 5000) + '/api';

    const testEmail = `test_${Date.now()}@example.com`;
    const password = 'password123';

    // 1. Register
    console.log('\n--- Step 1: Register ---');
    let res = await globalFetch(`${BASE_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: testEmail, password })
    });
    let data = await res.json();
    console.log('Register Response:', data);
    if (!data.success) throw new Error('Registration failed: ' + JSON.stringify(data.errors || data.message));

    // 2. Login
    console.log('\n--- Step 2: Login ---');
    res = await globalFetch(`${BASE_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password })
    });
    data = await res.json();
    console.log('Login Response:', data);
    if (!data.success) throw new Error('Login failed: ' + JSON.stringify(data.errors || data.message));
    
    const token = data.token;
    const userId = data.data.id;

    // 3. Get Profile
    console.log('\n--- Step 3: Get Profile ---');
    res = await globalFetch(`${BASE_URL}/users/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    console.log('Profile Response:', data);
    if (!data.success) throw new Error('Get Profile failed');

    // Fetch Communities to find one to join
    console.log('\n--- Fetching Communities ---');
    res = await globalFetch(`${BASE_URL}/communities`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    let communityId = null;
    if (data.success && data.data && data.data.length > 0) {
      communityId = data.data[0]._id;
      console.log(`Found community to join: ${data.data[0].name} (${communityId})`);
    } else {
      // Create a test community directly in DB
      console.log('No communities found. Creating one...');
      const Community = mongoose.model('Community');
      const newComm = await Community.create({
        name: 'Test Community',
        description: 'A test community',
        category: 'Tech'
      });
      communityId = newComm._id;
      console.log(`Created test community: ${communityId}`);
    }

    // 4. Join Community
    console.log('\n--- Step 4: Join Community ---');
    res = await globalFetch(`${BASE_URL}/communities/${communityId}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    console.log('Join Response:', data);
    if (!data.success) throw new Error('Join Community failed: ' + data.message);

    // 5. Verify Circle in DB
    console.log('\n--- Step 5: Verify Database ---');
    const Circle = mongoose.model('Circle');
    const circle = await Circle.findOne({
      community_id: communityId,
      members: userId
    });

    if (circle) {
      console.log(`✅ SUCCESS: User is a member of circle ${circle._id}.`);
      console.log(`Capacity Logic Check: Circle has ${circle.members.length}/${circle.capacity} members.`);
      if (circle.members.length <= circle.capacity) {
        console.log('✅ SUCCESS: Capacity logic holds.');
      } else {
        console.error('❌ FAILURE: Circle is over capacity!');
      }
    } else {
      console.error('❌ FAILURE: User was not assigned to a circle in the DB!');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error during E2E test:', err);
    process.exit(1);
  }
}

runTest();
