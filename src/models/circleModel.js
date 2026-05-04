import mongoose from 'mongoose';

const circleSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
    },
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    members_count: {
      type: Number,
      default: 0,
    },
    max_size: {
      type: Number,
      default: 8,
    },
  },
  {
    collection: 'circles',
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

export default mongoose.model('Circle', circleSchema);
