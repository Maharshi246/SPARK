import { Router } from 'express';
import { register, login, verifyEmail, resendVerification } from '../controllers/authController.js';
import { forgotPassword, resetPassword } from '../controllers/passwordController.js';
import { protect } from '../middleware/auth.js';
import { validateRequest, registerSchema, loginSchema } from '../middleware/validationMiddleware.js';

const router = Router();

// POST /api/auth/register
router.post('/register', validateRequest(registerSchema), register);

// POST /api/auth/login
router.post('/login', validateRequest(loginSchema), login);

// GET /api/auth/verify-email
router.get('/verify-email', verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', resendVerification);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

export default router;
