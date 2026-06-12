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
import { validateRequest, registerSchema, loginSchema } from '../middleware/validationMiddleware.js';
import { register, login } from '../controllers/authController.js';

const router = Router();

// GET /api/users - Get all users (protected: prevents unauthorized data scraping)
router.get('/', protect, getUsers);

// POST /api/users - Create a new user (protected: admin/internal creation)
router.post('/', protect, validateRequest(registerSchema), createUser);

// POST /api/users/register - Public registration endpoint
router.post('/register', validateRequest(registerSchema), register);

// POST /api/users/login - Public login endpoint
router.post('/login', validateRequest(loginSchema), login);

// Protected profile routes
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.get('/progress', protect, getUserProgress);

// Backward-compatible curiosity profile routes
router.put('/profile', protect, updateProfile);
router.get('/profile', protect, getProfile);

export default router;
