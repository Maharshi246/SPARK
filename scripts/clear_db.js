import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    try { await mongoose.connection.db.collection('communities').drop(); console.log('Dropped communities'); } catch(e){}
    try { await mongoose.connection.db.collection('circles').drop(); console.log('Dropped circles'); } catch(e){}
    try { await mongoose.connection.db.collection('engagement_events').drop(); console.log('Dropped engagement'); } catch(e){}
    process.exit(0);
});
