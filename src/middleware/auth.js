import jwt from 'jsonwebtoken';
import { authMiddleware } from './authMiddleware.js';

export const protect = (req, res, next) => {
  console.log('AUTH HEADER:', req.headers.authorization);

  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Attach user to req.user
    req.user = { id: userId, userId };
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Backward-compatible exports
export const auth = authMiddleware;
