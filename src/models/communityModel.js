import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
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
