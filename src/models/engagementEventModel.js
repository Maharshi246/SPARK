import mongoose from 'mongoose';

const engagementEventSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    community_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
    },
    circle_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Circle',
    },
    event_type: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'engagement_events',
    timestamps: false, // We use created_at manually for exact tracking
  }
);

// Add required indexes for rapid analytic queries
engagementEventSchema.index({ user_id: 1 });
engagementEventSchema.index({ community_id: 1 });
engagementEventSchema.index({ circle_id: 1 });
engagementEventSchema.index({ event_type: 1 });
engagementEventSchema.index({ created_at: -1 });

const EngagementEvent = mongoose.model('EngagementEvent', engagementEventSchema);

export default EngagementEvent;
