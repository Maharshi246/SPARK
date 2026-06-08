// src/models/userModel.js
// Defines the User schema and model for MongoDB

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    display_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    stage: {
      type: String,
      default: 'seeker',
      trim: true,
    },
    interests: [
      {
        type: String,
        trim: true,
      },
    ],
    depth_level: {
      type: String,
      enum: ['surface', 'intermediate', 'deep'],
      default: 'surface',
    },
    discussion_style: {
      type: String,
      enum: ['debate', 'explore', 'learn'],
      default: 'explore',
    },
    availability: [
      {
        type: String,
        trim: true,
      },
    ],
    memberships: [
      {
        community_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
        circle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle', required: true },
        joined_at: { type: Date, default: Date.now }
      }
    ],
    current_stage: {
      type: String,
      enum: ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5'],
      default: 'stage_1'
    }
  },
  {
    collection: 'users',
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // If the password already looks like a bcrypt hash, don't hash again.
  // This keeps compatibility with controllers that hash before saving.
  if (typeof this.password === 'string' && this.password.startsWith('$2')) {
    return next();
  }

  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

const User = mongoose.model('User', userSchema);

export default User;
