import { protect } from './auth.js';

export const managerOnly = [
  protect,
  (req, res, next) => {
    if (req.user && (req.user.role === 'manager' || req.user.role === 'admin')) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Forbidden: Manager or admin access required' });
    }
  }
];
