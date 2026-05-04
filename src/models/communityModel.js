import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    collection: 'communities',
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

communitySchema.index({ topic: 1 }, { unique: true });

const Community = mongoose.model('Community', communitySchema);

export default Community;
