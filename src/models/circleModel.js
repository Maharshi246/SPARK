import mongoose from 'mongoose';

const circleSchema = new mongoose.Schema(
  {
    community_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    capacity: {
      type: Number,
      default: 8,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'circles',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Circle = mongoose.model('Circle', circleSchema);

export default Circle;
