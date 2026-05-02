import dotenv from 'dotenv';
import dns from 'dns/promises';
import mongoose from 'mongoose';

dotenv.config();

const redactMongoUri = (uri = '') => {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return uri ? '[unparseable mongo uri]' : '[missing mongo uri]';
  }
};

const main = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  console.log('Node:', process.version);
  console.log('MONGO_URI (redacted):', redactMongoUri(uri));

  // Quick DNS SRV check for mongodb+srv:// URIs
  if (uri.startsWith('mongodb+srv://')) {
    const hostname = uri.replace('mongodb+srv://', '').split('@').pop()?.split('/')[0];
    if (hostname) {
      try {
        const records = await dns.resolveSrv(`_mongodb._tcp.${hostname}`);
        console.log('SRV records:', records.map(r => `${r.name}:${r.port}`).join(', '));
      } catch (err) {
        console.error('SRV lookup failed:', err?.code || err?.message || err);
      }
    }
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('MongoDB: CONNECTED');
    await mongoose.disconnect();
    console.log('MongoDB: DISCONNECTED');
    process.exit(0);
  } catch (err) {
    console.error('MongoDB connect FAILED');
    console.error('name:', err?.name);
    console.error('code:', err?.code);
    console.error('message:', err?.message);
    if (err?.cause) {
      console.error('cause:', err.cause);
    }
    process.exit(1);
  }
};

main();
