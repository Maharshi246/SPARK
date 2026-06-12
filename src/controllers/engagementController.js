import EngagementEvent from '../models/engagementEventModel.js';
import mongoose from 'mongoose';

// GET /api/engagement/events
export const getEvents = async (req, res) => {
  try {
    const { community_id, circle_id, event_type, startDate, endDate } = req.query;

    const query = {};

    // IDOR fix: always scope to authenticated user's own events
    const userId = req.user._id || req.user.id;
    query.user_id = userId;

    if (community_id && mongoose.Types.ObjectId.isValid(community_id)) {
      query['context.community_id'] = community_id;
    }
    if (circle_id && mongoose.Types.ObjectId.isValid(circle_id)) {
      query['context.circle_id'] = circle_id;
    }
    if (event_type) {
      query.event_type = event_type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Limit to 500 records to prevent overwhelming responses
    const events = await EngagementEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch engagement events' });
  }
};
