// src/index.js
// Entry point: sets up Express app, loads env variables, connects to DB

// src/index.js
// Main entry point for the Express app

import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Simple health check route
app.get('/', (req, res) => {
  res.send('SPARK API Running');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
