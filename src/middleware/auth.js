import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer')) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  const token = header.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid token payload' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};
