// src/models/userModel.js
// Defines the User schema and model for MongoDB

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'users' }
);

const User = mongoose.model('User', userSchema);

export default User;
