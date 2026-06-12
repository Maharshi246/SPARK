import mongoose from 'mongoose';
import EngagementEvent from '../models/engagementEventModel.js';

const ALLOWED_EVENT_TYPES = [
  'message_sent',
  'session_start',
  'session_end',
  'circle_joined',
  'community_viewed',
  'recommendation_viewed'
];

/**
 * Helper to build an event payload from an Express request object.
 *
 * @param {Object} req - The Express request object.
 * @param {String} eventType - The type of event.
 * @param {Object} [extra={}] - Optional extra context (e.g., communityId, circleId, weight).
 * @returns {Object|null} The formatted event data object or null if req.user is missing.
 */
export const buildEventPayload = (req, eventType, extra = {}) => {
  if (!req || !req.user) return null;

  const userId = req.user._id ?? req.user.id ?? req.user.userId;
  if (!userId) return null;

  return {
    userId,
    eventType,
    ...extra
  };
};

/**
 * Logs an engagement event to the database safely and silently on failure.
 *
 * @param {Object} eventData - The data for the event.
 * @param {String|mongoose.Types.ObjectId} eventData.userId - Required user ID.
 * @param {String} eventData.eventType - Required event type.
 * @param {String|mongoose.Types.ObjectId} [eventData.communityId] - Optional community ID.
 * @param {String|mongoose.Types.ObjectId} [eventData.circleId] - Optional circle ID.
 * @param {Number} [eventData.weight] - Optional weight of the event.
 * @returns {Promise<Object|null>} The saved document or null on failure.
 */
export const logEngagementEvent = async (eventData) => {
  try {
    const { userId, eventType, communityId, circleId, weight } = eventData;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      console.error('[EngagementLog] Invalid or missing userId for event:', eventType);
      return null;
    }

    if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
      console.error(`[EngagementLog] Invalid event type '${eventType}' for user:`, userId);
      return null;
    }

    const context = {};
    if (communityId) context.community_id = communityId;
    if (circleId) context.circle_id = circleId;

    const eventPayload = {
      user_id: userId,
      event_type: eventType,
      context
    };

    if (weight !== undefined) {
      eventPayload.weight = weight;
    }

    const event = new EngagementEvent(eventPayload);
    const savedDocument = await event.save();
    return savedDocument;
  } catch (error) {
    console.error('[EngagementLog] Failed to save event:', error.message);
    return null;
  }
};
