import express from 'express';
import { getUniversityById } from '../controllers/universityController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/:id', protect, getUniversityById);

export default router;
