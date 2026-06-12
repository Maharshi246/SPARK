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
    current_layer: {
      type: String,
      enum: ['layer_1', 'layer_2', 'layer_3'],
      default: 'layer_1'
    },
    layer_history: [
      {
        layer: String,
        changed_at: { type: Date, default: Date.now }
      }
    ],
    role: {
      type: String,
      enum: ['student', 'manager', 'admin'],
      default: 'student'
    },
    university_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'University', 
      default: null,
      index: true
    },
    enrollment_token: { 
      type: String, 
      sparse: true, 
      unique: true 
    },
    is_email_verified: {
      type: Boolean,
      default: false
    },
    email_verification_token: {
      type: String,
      unique: true,
      sparse: true
    },
    email_verification_expires: {
      type: Date
    },
    password_reset_token: {
      type: String,
      unique: true,
      sparse: true
    },
    password_reset_expires: {
      type: Date
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
