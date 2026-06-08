// src/routes/circleRoutes.js
// Defines circle-related API routes

import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { getCircleMessages } from '../controllers/messageController.js';

const router = Router();

// GET /api/circles/:circleId/messages - Get latest messages for a circle
router.get('/:circleId/messages', protect, getCircleMessages);

export default router;
