import { Router } from 'express';
import {
  getCommunities,
  getMyCommunities,
  joinCommunity,
  leaveCommunity,
  getCommunityById,
} from '../controllers/communityController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// GET /api/communities - List all available system-managed communities
router.get('/', protect, getCommunities);

// GET /api/communities/my-communities - List communities the user has joined
router.get('/my-communities', protect, getMyCommunities);

// GET /api/communities/:id - View a single community
router.get('/:id', protect, getCommunityById);

// POST /api/communities/:id/join - Join a community (auto-assigns circle)
router.post('/:id/join', protect, joinCommunity);

// POST /api/communities/:id/leave - Leave a community (auto-leaves circle)
router.post('/:id/leave', protect, leaveCommunity);

export default router;
