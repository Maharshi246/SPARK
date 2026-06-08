import EngagementEvent from '../models/engagementEventModel.js';
import mongoose from 'mongoose';

// GET /api/engagement/events
export const getEvents = async (req, res) => {
  try {
    const { user_id, community_id, circle_id, event_type, startDate, endDate } = req.query;

    const query = {};

    if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
      query.user_id = user_id;
    }
    if (community_id && mongoose.Types.ObjectId.isValid(community_id)) {
      query.community_id = community_id;
    }
    if (circle_id && mongoose.Types.ObjectId.isValid(circle_id)) {
      query.circle_id = circle_id;
    }
    if (event_type) {
      query.event_type = event_type;
    }

    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }

    // Limit to 500 records to prevent overwhelming responses
    const events = await EngagementEvent.find(query)
      .sort({ created_at: -1 })
      .limit(500);

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch engagement events' });
  }
};
