import { Router } from 'express';
import {
	getAllCommunities,
	getSuggestedCommunities,
	joinCommunity,
} from '../controllers/communityController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/communities/all - Get all communities (public)
router.get('/all', getAllCommunities);

// GET /api/communities/suggestions - Get communities matching user interests
router.get('/suggestions', protect, getSuggestedCommunities);

// POST /api/communities/join/:communityId - Join a community
router.post('/join/:communityId', protect, joinCommunity);

export default router;
