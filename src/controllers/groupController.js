import mongoose from 'mongoose';
import Group from '../models/groupModel.js';
import User from '../models/userModel.js';

const getUserIdFromReq = (req) => {
  if (!req?.user) return null;
  if (typeof req.user === 'string') return req.user;
  if (typeof req.user === 'object' && req.user.id) return req.user.id;
  return null;
};

// Helper: Create default groups for testing (only if DB is empty)
export const createDefaultGroups = async () => {
  try {
    const count = await Group.countDocuments();
    if (count > 0) return;

    const defaultTopics = ['AI', 'Cyber', 'Startups', 'Blockchain', 'Cloud'];
    await Group.insertMany(
      defaultTopics.map((topic) => ({
        topic,
        members: [],
        capacity: 5,
        is_active: true,
      }))
    );

    console.log('Default groups created');
  } catch (error) {
    console.error('Error creating default groups:', error?.message || error);
  }
};

export const getSuggestedGroups = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const interests = Array.isArray(user.interests) ? user.interests : [];
    if (interests.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const groups = await Group.find({
      topic: { $in: interests },
      is_active: true,
    })
      .select({ topic: 1, members: 1, capacity: 1 })
      .lean();

    groups.sort((a, b) => (a.members?.length || 0) - (b.members?.length || 0));

    return res.json({
      success: true,
      data: groups.map((g) => ({
        id: String(g._id),
        topic: g.topic,
        members_count: Array.isArray(g.members) ? g.members.length : 0,
        capacity: g.capacity,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching suggested groups',
      error: error?.message || String(error),
    });
  }
};

export const joinGroup = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid groupId' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (!group.is_active) {
      return res.status(400).json({ success: false, message: 'Group is inactive' });
    }

    const members = Array.isArray(group.members) ? group.members : [];
    const isAlreadyMember = members.some((m) => String(m) === String(userId));
    if (isAlreadyMember) {
      return res
        .status(400)
        .json({ success: false, message: 'User already in group' });
    }

    if (members.length >= group.capacity) {
      return res.status(400).json({ success: false, message: 'Group is full' });
    }

    group.members.push(userId);
    await group.save();

    return res.json({
      success: true,
      message: 'Joined group successfully',
      data: group,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error joining group',
      error: error?.message || String(error),
    });
  }
};
