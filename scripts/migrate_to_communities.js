import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup env path since script runs from /scripts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Assuming mongo URI is set
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spark';

async function runMigration() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const db = mongoose.connection.db;

    // 1. Fetch legacy groups
    console.log('Fetching legacy groups...');
    const groups = await db.collection('groups').find({}).toArray();
    console.log(`Found ${groups.length} groups.`);

    if (groups.length === 0) {
      console.log('No legacy groups found. Exiting.');
      process.exit(0);
    }

    // 2. Create standard system-managed communities
    const systemTopics = [
      'Cyber Security',
      'Artificial Intelligence',
      'Literature',
      'Psychology',
      'Business',
      'History',
      'Startups',
      'Blockchain',
      'Cloud',
      'AI'
    ];

    const communityDocs = systemTopics.map(topic => ({
      name: topic,
      description: `System managed community for ${topic}`,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }));

    // Insert ignoring duplicates (if any exist)
    console.log('Seeding system-managed communities...');
    for (const doc of communityDocs) {
      await db.collection('communities').updateOne(
        { name: doc.name },
        { $setOnInsert: doc },
        { upsert: true }
      );
    }

    // 3. Transform groups into circles
    const communityCache = {};
    const communities = await db.collection('communities').find({}).toArray();
    communities.forEach(c => communityCache[c.name.toLowerCase()] = c._id);

    console.log('Migrating groups to circles...');
    for (const group of groups) {
      let communityId = communityCache[group.topic?.toLowerCase()];
      
      // Edge case: group topic wasn't in our canonical list
      if (!communityId) {
        console.log(`Creating missing community for topic: ${group.topic}`);
        const insertRes = await db.collection('communities').insertOne({
          name: group.topic,
          description: `Auto-generated community from migration`,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        });
        communityId = insertRes.insertedId;
        communityCache[group.topic.toLowerCase()] = communityId;
      }

      // Create Circle
      const circleDoc = {
        _id: group._id, // Preserve ID to keep messages linked
        community_id: communityId,
        members: group.members || [],
        capacity: group.capacity || 8,
        is_active: group.is_active !== undefined ? group.is_active : true,
        created_at: group.created_at || new Date(),
        updated_at: new Date()
      };

      await db.collection('circles').updateOne(
        { _id: circleDoc._id },
        { $set: circleDoc },
        { upsert: true }
      );

      // 4. Update Users who belonged to this group
      // We will loop through the group members and update them
      console.log(`Updating users for circle/group: ${group._id}`);
      
      const members = group.members || [];
      for (const memberId of members) {
        // Construct the membership entry
        const membershipEntry = {
          community_id: communityId,
          circle_id: group._id,
          joined_at: new Date()
        };

        await db.collection('users').updateOne(
          { _id: new mongoose.Types.ObjectId(memberId) },
          { 
            $push: { memberships: membershipEntry },
            $unset: { group_id: "" } // Remove legacy field
          }
        );
      }
    }

    console.log('Migration completed successfully.');
    console.log('Legacy groups collection has been preserved but is now obsolete.');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
