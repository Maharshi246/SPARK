// src/models/messageModel.js
// Defines the Message schema and model for MongoDB

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    circle_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  {
    collection: 'messages',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

messageSchema.index({ circle_id: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
