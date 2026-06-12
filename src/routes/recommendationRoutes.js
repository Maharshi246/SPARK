import express from 'express';
import { getRecommendations } from '../controllers/recommendationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getRecommendations);

export default router;
