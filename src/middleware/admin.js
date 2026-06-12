import { protect } from './auth.js';

export const adminOnly = [
  protect,
  (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }
  }
];
