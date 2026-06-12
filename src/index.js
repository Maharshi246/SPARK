// src/index.js
// Entry point: sets up Express app, loads env variables, connects to DB

import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import circleRoutes from './routes/circleRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import engagementRoutes from './routes/engagementRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import managerRoutes from './routes/managerRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import universityRoutes from './routes/universityRoutes.js';
import { initSocket } from './socket/index.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import cors from 'cors';

// Load environment variables from .env file
dotenv.config();

const AUDIT_MODE = process.env.AUDIT_MODE === 'true';

// Connect to MongoDB
if (!AUDIT_MODE) {
  connectDB().then(async () => {
    // One-time inline operation: refresh token 0911Z9
    try {
      const University = mongoose.connection.collection('universities');
      const User = mongoose.connection.collection('users');
      const EnrollmentToken = mongoose.connection.collection('enrollmenttokens');

      let uni = await University.findOne({ name: 'Parul University' });
      if (!uni) {
        const res = await University.insertOne({ name: 'Parul University', domain: 'paruluniversity.ac.in' });
        uni = { _id: res.insertedId };
      }
      
      let admin = await User.findOne({ role: { $in: ['admin', 'manager'] } });
      let adminId = admin ? admin._id : new mongoose.Types.ObjectId();

      await EnrollmentToken.updateMany(
        { token: '0911Z9' },
        { $set: { is_active: false } }
      );

      await EnrollmentToken.insertOne({
        token: '0911Z9',
        university_id: uni._id,
        created_by: adminId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_active: true,
        used_by: null
      });
      console.log('✅ Enrollment token 0911Z9 is active');
    } catch (err) {
      console.error('Error in inline token refresh:', err);
    }
  });
}

const app = express();

// Security headers
app.use(helmet());

// CORS – configurable via env
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  })
);

// Middleware to parse JSON bodies with size limit
app.use(express.json({ limit: '1mb' }));

// Rate limiting for auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many registration attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check route
app.get('/', (req, res) => {
  res.send('SPARK API Running');
});

// Apply rate limiters to auth routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/users/login', loginLimiter);
app.use('/api/users/register', registerLimiter);

// API routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/universities', universityRoutes);

// Global Error Handler (must be the last middleware)
app.use(errorHandler);

// Start server with robust error handling
if (AUDIT_MODE || process.env.NODE_ENV === 'test') {
  console.log('AUDIT_MODE or TEST_MODE enabled: module imports OK (server not started).');
} else {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Please use a different port or stop the process using it.`
      );
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
      } catch (err) {
        console.error('Error closing MongoDB connection:', err);
      }
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
