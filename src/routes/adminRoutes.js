import express from 'express';
import { 
  getAllUsers, 
  createCommunity, 
  getGlobalEngagement,
  getAdminStats,
  getCommunities,
  getCirclesByCommunity,
  getStudentsByCircle,
  getStudentProgress,
  promoteStudent,
  toggleCommunityStatus,
  updateUserRole,
  testEmailConfig
} from '../controllers/adminController.js';
import { adminOnly } from '../middleware/admin.js';

const router = express.Router();

router.use(adminOnly);

// Users
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);

// Stats & Engagement
router.get('/stats', getAdminStats);
router.get('/engagement', getGlobalEngagement);

// Communities & Circles
router.get('/communities', getCommunities);
router.post('/communities', createCommunity);
router.put('/communities/:communityId/toggle-status', toggleCommunityStatus);
router.get('/communities/:communityId/circles', getCirclesByCommunity);

// Students in Circles & Progress
router.get('/circles/:circleId/students', getStudentsByCircle);
router.get('/students/:studentId/progress', getStudentProgress);
router.post('/students/:studentId/promote', promoteStudent);

// System
router.post('/test-email', testEmailConfig);

export default router;
