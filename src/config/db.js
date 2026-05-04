// src/config/db.js
// Handles MongoDB connection using Mongoose

import mongoose from 'mongoose';

const buildSeedUriFromSrvUri = (srvUri, seedlist, replicaSet) => {
  const parsed = new URL(srvUri);

  const username = parsed.username ? encodeURIComponent(parsed.username) : '';
  const password = parsed.password ? encodeURIComponent(parsed.password) : '';
  const authPrefix = username
    ? `${username}${password ? `:${password}` : ''}@`
    : '';

  const database = parsed.pathname?.replace(/^\//, '') || '';
  const seedHosts = seedlist
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.includes(':') ? h : `${h}:27017`))
    .join(',');

  const params = new URLSearchParams(parsed.search);
  if (replicaSet && !params.has('replicaSet')) params.set('replicaSet', replicaSet);
  if (!params.has('authSource')) params.set('authSource', 'admin');
  if (!params.has('tls') && !params.has('ssl')) params.set('tls', 'true');

  const query = params.toString();
  return `mongodb://${authPrefix}${seedHosts}/${database}${query ? `?${query}` : ''}`;
};

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not set');
    }

    try {
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('MongoDB connected successfully');
      return;
    } catch (error) {
      const seedlist = process.env.MONGO_SEEDLIST;
      const replicaSet = process.env.MONGO_REPLICA_SET;
      const isSrvDnsError =
        mongoUri.startsWith('mongodb+srv://') &&
        (error?.code === 'ECONNREFUSED' ||
          String(error?.message || '').includes('querySrv'));

      if (isSrvDnsError && seedlist) {
        const fallbackUri = buildSeedUriFromSrvUri(mongoUri, seedlist, replicaSet);
        await mongoose.connect(fallbackUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        console.log('MongoDB connected successfully (seedlist fallback)');
        return;
      }

      throw error;
    }
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;
