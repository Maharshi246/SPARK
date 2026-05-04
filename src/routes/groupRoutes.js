import { Router } from 'express';
import { getSuggestedGroups, joinGroup } from '../controllers/groupController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/groups/suggestions - Get groups matching user interests
router.get('/suggestions', protect, getSuggestedGroups);

// POST /api/groups/join/:groupId - Join a group
router.post('/join/:groupId', protect, joinGroup);

export default router;
