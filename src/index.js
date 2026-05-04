// src/index.js
// Entry point: sets up Express app, loads env variables, connects to DB

// src/index.js
// Main entry point for the Express app


import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import { createDefaultGroups } from './controllers/groupController.js';
import { seedCommunities } from './controllers/communityController.js';
import mongoose from 'mongoose';

// Load environment variables from .env file
dotenv.config();

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

const connectMongo = () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    return Promise.reject(new Error('MONGO_URI is not set'));
  }

  return mongoose.connect(mongoUri).catch((err) => {
    const seedlist = process.env.MONGO_SEEDLIST;
    const replicaSet = process.env.MONGO_REPLICA_SET;
    const isSrvDnsError =
      mongoUri.startsWith('mongodb+srv://') &&
      (err?.code === 'ECONNREFUSED' || String(err?.message || '').includes('querySrv'));

    if (isSrvDnsError && seedlist) {
      const fallbackUri = buildSeedUriFromSrvUri(mongoUri, seedlist, replicaSet);
      return mongoose.connect(fallbackUri);
    }

    throw err;
  });
};

const app = express();

// Body parsing (must be registered BEFORE routes)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.send('SPARK API Running');
});


// User API routes
app.use('/api/users', userRoutes);
// Auth API routes
app.use('/api/auth', authRoutes);
// Group matching routes
app.use('/api/groups', groupRoutes);
// Community suggestion routes
app.use('/api/communities', communityRoutes);

// Handle invalid JSON payloads explicitly (otherwise Express may return HTML)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload',
    });
  }
  return next(err);
});


const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

const startServer = (startPort, maxRetries = 10) => {
  const tryListen = (port, retriesLeft) => {
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    server.on('error', (err) => {
      if (err?.code === 'EADDRINUSE' && retriesLeft > 0) {
        console.error(`Port ${port} is already in use`);
        server.close(() => {
          tryListen(port + 1, retriesLeft - 1);
        });
        return;
      }

      if (err?.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });
  };

  tryListen(startPort, maxRetries);
};

connectMongo()
  .then(() => {
    console.log('MongoDB Connected Successfully');

    // Create default groups for testing (only if DB is empty)
    createDefaultGroups();

    // Seed default communities (only if DB is empty)
    seedCommunities();

    startServer(PORT);
  })
  .catch((error) => {
    console.error(`MongoDB Connection Failed: ${error?.message || error}`);
    process.exit(1);
  });
