import EngagementEvent from '../models/engagementEventModel.js';

/**
 * Fire-and-forget logging utility for Engagement Events.
 * Never block the caller or crash the app on DB failures.
 */
export const logEvent = async ({ user_id, community_id, circle_id, event_type, metadata }) => {
  try {
    if (!user_id || !event_type) return;

    // We do NOT await this locally in the calling context; 
    // it executes asynchronously in the background.
    await EngagementEvent.create({
      user_id,
      community_id,
      circle_id,
      event_type,
      metadata,
    });
  } catch (error) {
    // Fail silently in production to avoid crashing socket flow
    // Log to console for debugging purposes
    console.error(`[EngagementService] Failed to log ${event_type}:`, error.message);
  }
};
