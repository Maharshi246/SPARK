import express from 'express';
import { generateToken } from '../controllers/managerController.js';
import { managerOnly } from '../middleware/manager.js';

const router = express.Router();

router.use(managerOnly);

router.post('/generate-token', generateToken);

export default router;
