import mongoose from 'mongoose';

const circleSchema = new mongoose.Schema(
  {
    community_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },
    university_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
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

// Enforce capacity limit at the schema level
circleSchema.pre('validate', function (next) {
  if (this.members && this.members.length > this.capacity) {
    next(new Error(`Circle exceeds capacity: ${this.members.length}/${this.capacity}`));
  } else {
    next();
  }
});

const Circle = mongoose.model('Circle', circleSchema);

export default Circle;
