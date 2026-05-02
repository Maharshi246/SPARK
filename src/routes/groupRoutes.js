import { Router } from 'express';
import {
  createGroups,
  getMyGroup,
  getSuggestions,
  joinGroup,
} from '../controllers/groupController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/groups/create - Create groups based on user similarity
router.get('/create', createGroups);

// GET /api/groups/my-group - Get user's assigned group
router.get('/my-group', protect, getMyGroup);

// GET /api/groups/suggestions - Get groups matching user interests
router.get('/suggestions', protect, getSuggestions);

// POST /api/groups/join/:groupId - Join a group
router.post('/join/:groupId', protect, joinGroup);

export default router;
