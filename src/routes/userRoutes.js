// src/routes/userRoutes.js
// Defines user-related API routes

import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateProfile,
  getProfile,
  getMe,
  updateMe,
  getUserProgress
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/users - Get all users
router.get('/', getUsers);

// POST /api/users - Create a new user
router.post('/', createUser);

// Protected profile routes (recommended)
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.get('/progress', protect, getUserProgress);

// Backward-compatible curiosity profile routes
router.put('/profile', protect, updateProfile);
router.get('/profile', protect, getProfile);

export default router;
