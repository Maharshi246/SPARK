// src/controllers/userController.js
// Contains controller functions for user routes

import User from '../models/userModel.js';

const safeUserSelect =
  'display_name email stage interests depth_level discussion_style availability created_at';

const getUserIdFromReq = (req) => {
  if (req?.user?.id) return req.user.id;
  return req?.user;
};

// Public: list users (safe fields only)
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}, safeUserSelect);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// Backward-compatible: create user via /api/users (kept so existing code doesn't break)
export const createUser = async (req, res) => {
  try {
    const { display_name, email, password, stage } = req.body;

    if (!display_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'display_name, email, and password are required',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({ display_name, email, password, stage });

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        display_name: user.display_name,
        email: user.email,
        stage: user.stage,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

// Protected: GET /api/users/me
export const getMe = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const user = await User.findById(userId).select(safeUserSelect);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// Protected: PUT /api/users/me
export const updateMe = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const allowed = ['interests', 'depth_level', 'discussion_style', 'availability'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
      select: safeUserSelect,
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// Backward-compatible aliases (older /profile routes)
export const getProfile = getMe;
export const updateProfile = updateMe;
