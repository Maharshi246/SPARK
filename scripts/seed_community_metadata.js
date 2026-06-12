import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup env path since script runs from /scripts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spark';

const metadataSeedMap = {
  'Cyber Security': { tags: ['cyber security', 'infosec', 'hacking', 'networking'], depth_level: 'deep', discussion_style: 'learn' },
  'Artificial Intelligence': { tags: ['artificial intelligence', 'ai', 'machine learning', 'ml', 'neural networks'], depth_level: 'deep', discussion_style: 'explore' },
  'Literature': { tags: ['literature', 'books', 'reading', 'novels', 'poetry'], depth_level: 'intermediate', discussion_style: 'explore' },
  'Psychology': { tags: ['psychology', 'mind', 'behavior', 'mental health'], depth_level: 'intermediate', discussion_style: 'explore' },
  'Business': { tags: ['business', 'finance', 'management', 'economics'], depth_level: 'surface', discussion_style: 'debate' },
  'History': { tags: ['history', 'past', 'events', 'world'], depth_level: 'intermediate', discussion_style: 'explore' },
  'Startups': { tags: ['startups', 'entrepreneurship', 'founders', 'venture capital'], depth_level: 'surface', discussion_style: 'debate' },
  'Blockchain': { tags: ['blockchain', 'crypto', 'web3', 'decentralization'], depth_level: 'intermediate', discussion_style: 'debate' },
  'Cloud': { tags: ['cloud', 'aws', 'azure', 'gcp', 'devops'], depth_level: 'deep', discussion_style: 'learn' },
  'AI': { tags: ['artificial intelligence', 'ai', 'machine learning'], depth_level: 'intermediate', discussion_style: 'explore' }
};

async function runSeed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const db = mongoose.connection.db;
    
    console.log('Seeding metadata for communities...');
    
    for (const [name, seedData] of Object.entries(metadataSeedMap)) {
      await db.collection('communities').updateOne(
        { name },
        { 
          $set: { 
            tags: seedData.tags,
            metadata: {
              depth_level: seedData.depth_level,
              discussion_style: seedData.discussion_style
            }
          }
        }
      );
      console.log(`Updated community: ${name}`);
    }

    console.log('Seed completed successfully.');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runSeed();
