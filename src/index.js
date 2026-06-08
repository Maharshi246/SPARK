// src/index.js
// Entry point: sets up Express app, loads env variables, connects to DB

// src/index.js
// Main entry point for the Express app


import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import circleRoutes from './routes/circleRoutes.js';
import engagementRoutes from './routes/engagementRoutes.js';
import { initSocket } from './socket/index.js';

// Load environment variables from .env file
dotenv.config();

const AUDIT_MODE = process.env.AUDIT_MODE === 'true';

// Connect to MongoDB
if (!AUDIT_MODE) {
  connectDB();
}

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.send('SPARK API Running');
});


// User API routes
app.use('/api/users', userRoutes);
// Auth API routes
app.use('/api/auth', authRoutes);
// Community routes
app.use('/api/communities', communityRoutes);

// Circle routes
app.use('/api/circles', circleRoutes);

// Engagement routes
app.use('/api/engagement', engagementRoutes);


// Start server with robust error handling
if (AUDIT_MODE) {
  console.log('AUDIT_MODE enabled: module imports OK (server not started).');
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
}
