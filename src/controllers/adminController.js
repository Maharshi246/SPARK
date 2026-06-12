import User from '../models/userModel.js';
import Community from '../models/communityModel.js';
import EngagementEvent from '../models/engagementEventModel.js';
import Circle from '../models/circleModel.js';
import Message from '../models/messageModel.js';
import { testEmailConnection } from '../utils/emailService.js';

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const createCommunity = async (req, res, next) => {
  try {
    const { name, description, category, university_id } = req.body;
    if (!university_id) {
      return res.status(400).json({ success: false, message: 'university_id is required' });
    }
    const community = await Community.create({ name, description, category, university_id });
    res.status(201).json({ success: true, data: community });
  } catch (error) {
    next(error);
  }
};

export const getGlobalEngagement = async (req, res, next) => {
  try {
    const events = await EngagementEvent.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};

// NEW ENDPOINTS

export const getAdminStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCommunities = await Community.countDocuments();
    const totalCircles = await Circle.countDocuments();
    const totalMessages = await Message.countDocuments();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeCirclesResult = await Message.distinct('circle_id', { created_at: { $gte: oneDayAgo } });
    const activeCircles = activeCirclesResult.length;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersLast7days = await User.countDocuments({ created_at: { $gte: sevenDaysAgo } });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalCommunities,
        totalCircles,
        totalMessages,
        activeCircles,
        newUsersLast7days
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getCommunities = async (req, res, next) => {
  try {
    const communities = await Community.aggregate([
      {
        $lookup: {
          from: 'circles',
          localField: '_id',
          foreignField: 'community_id',
          as: 'circles'
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          is_active: 1,
          tags: 1,
          metadata: 1,
          created_at: 1,
          circleCount: { $size: '$circles' },
          members: {
            $reduce: {
              input: '$circles.members',
              initialValue: [],
              in: { $setUnion: ['$$value', '$$this'] }
            }
          }
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          is_active: 1,
          tags: 1,
          metadata: 1,
          created_at: 1,
          circleCount: 1,
          memberCount: { $size: { $ifNull: ['$members', []] } }
        }
      }
    ]);
    res.json({ success: true, data: communities });
  } catch (error) {
    next(error);
  }
};

export const getCirclesByCommunity = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const circles = await Circle.find({ community_id: communityId }).populate({
      path: 'members',
      select: 'display_name email current_stage created_at'
    }).lean();

    for (let circle of circles) {
      if (circle.members) {
        for (let member of circle.members) {
          const lastMsg = await Message.findOne({ sender_id: member._id }).sort({ created_at: -1 });
          member.last_active_at = lastMsg ? lastMsg.created_at : member.created_at;
        }
      }
    }
    
    res.json({ success: true, data: circles });
  } catch (error) {
    next(error);
  }
};

export const getStudentsByCircle = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const circle = await Circle.findById(circleId).populate({
      path: 'members',
      select: 'display_name email current_stage created_at'
    }).lean();

    if (!circle) {
      return res.status(404).json({ success: false, message: 'Circle not found' });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const students = await Promise.all(circle.members.map(async (student) => {
      const messages_count = await Message.countDocuments({ sender_id: student._id });
      const engagement_events_last_30_days = await EngagementEvent.countDocuments({
        user_id: student._id,
        timestamp: { $gte: thirtyDaysAgo }
      });
      const lastMsg = await Message.findOne({ sender_id: student._id }).sort({ created_at: -1 });
      
      return {
        _id: student._id,
        display_name: student.display_name,
        email: student.email,
        current_layer: student.current_layer,
        messages_count,
        engagement_events_last_30_days,
        last_active_at: lastMsg ? lastMsg.created_at : student.created_at,
      };
    }));

    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

export const getStudentProgress = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const student = await User.findById(studentId).populate('university_id').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const messages = await Message.aggregate([
      { $match: { sender_id: student._id, created_at: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // fill gaps
    const messages_per_day = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const match = messages.find(m => m._id === dateStr);
      messages_per_day.push({ date: dateStr, count: match ? match.count : 0 });
    }

    // joined communities / circles
    const circlesJoined = await Circle.find({ members: studentId }).populate('community_id', 'name').lean();
    const circles_joined = circlesJoined.map(c => ({
      _id: c._id,
      communityName: c.community_id?.name || 'Unknown',
    }));
    const communities_joined = [...new Set(circlesJoined.map(c => c.community_id?.name).filter(Boolean))];

    const recentEvents = await EngagementEvent.find({ user_id: studentId })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    // Default layer_history logic if empty
    let layer_history = student.layer_history || [];
    if (layer_history.length === 0) {
      layer_history = [{ layer: 'layer_1', changed_at: student.created_at }];
    }

    res.json({
      success: true,
      data: {
        _id: student._id,
        display_name: student.display_name,
        email: student.email,
        role: student.role,
        university: student.university_id,
        current_layer: student.current_layer || 'layer_1',
        layer_history,
        messages_per_day,
        communities_joined,
        circles_joined,
        recent_events: recentEvents
      }
    });
  } catch (error) {
    next(error);
  }
};

export const promoteStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const currentLayer = student.current_layer || 'layer_1';
    let nextLayer = currentLayer;
    if (currentLayer === 'layer_1') nextLayer = 'layer_2';
    else if (currentLayer === 'layer_2') nextLayer = 'layer_3';

    if (currentLayer !== nextLayer) {
      student.current_layer = nextLayer;
      if (!student.layer_history) student.layer_history = [];
      // Ensure there's an initial entry
      if (student.layer_history.length === 0) {
        student.layer_history.push({ layer: 'layer_1', changed_at: student.created_at || new Date() });
      }
      student.layer_history.push({ layer: nextLayer, changed_at: new Date() });
      await student.save();
    }

    res.json({ success: true, data: student, message: currentLayer !== nextLayer ? `Promoted to ${nextLayer}` : `Already at ${currentLayer}` });
  } catch (error) {
    next(error);
  }
};

export const toggleCommunityStatus = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found' });
    }

    community.is_active = !community.is_active;
    await community.save();

    res.json({ success: true, data: community });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['student', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const testEmailConfig = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const result = await testEmailConnection(email);
    res.json({ success: true, message: 'Test email sent successfully', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to send test email' });
  }
};
