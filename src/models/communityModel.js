import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    university_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    metadata: {
      depth_level: {
        type: String,
        enum: ['surface', 'intermediate', 'deep'],
      },
      discussion_style: {
        type: String,
        enum: ['debate', 'explore', 'learn'],
      },
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'communities',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Community = mongoose.model('Community', communitySchema);

export default Community;
