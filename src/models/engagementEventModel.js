import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const engagementEventSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  event_type: {
    type: String,
    required: true,
    enum: {
      values: ['message_sent', 'session_start', 'session_end', 'circle_joined', 'community_viewed', 'recommendation_viewed'],
      message: '{VALUE} is not a recognized behavioral event type.'
    }
  },
  context: {
    community_id: {
      type: Schema.Types.ObjectId,
      ref: 'Community',
      required: false
    },
    circle_id: {
      type: Schema.Types.ObjectId,
      ref: 'Circle',
      required: false
    }
  },
  weight: {
    type: Number,
    required: true,
    default: 1
  }
}, {
  timestamps: true
});

export default mongoose.model('EngagementEvent', engagementEventSchema);
