import { Router } from 'express';
import { getCircleMessages, sendMessage } from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/messages/circle/:circleId - Get latest messages for a circle
router.get('/circle/:circleId', protect, getCircleMessages);

// POST /api/messages - Send a new message
router.post('/', protect, sendMessage);

export default router;
