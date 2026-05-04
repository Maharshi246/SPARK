// src/models/groupModel.js
// Defines the Group schema and model for MongoDB

import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    capacity: {
      type: Number,
      default: 5,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'groups',
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

const Group = mongoose.model('Group', groupSchema);

export default Group;
