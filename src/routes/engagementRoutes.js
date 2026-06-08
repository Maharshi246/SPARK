import { Router } from 'express';
import { getEvents } from '../controllers/engagementController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/engagement/events
router.get('/events', protect, getEvents);

export default router;
