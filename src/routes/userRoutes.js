// src/routes/userRoutes.js
// Defines user-related API routes

import { Router } from 'express';
import { getUsers, createUser } from '../controllers/userController.js';

const router = Router();

// GET /api/users - Get all users
router.get('/', getUsers);

// POST /api/users - Create a new user
router.post('/', createUser);

export default router;
