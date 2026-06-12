// src/controllers/messageController.js
// Contains controller functions for message routes

import mongoose from 'mongoose';
import Message from '../models/messageModel.js';
import User from '../models/userModel.js';
import { logEngagementEvent, buildEventPayload } from '../services/engagementLogService.js';

const getUserIdFromReq = (req) => {
  if (req?.user?._id) return req.user._id;
  if (req?.user?.id) return req.user.id;
  return req?.user;
};

export const getCircleMessages = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = getUserIdFromReq(req);

    if (!circleId || !mongoose.Types.ObjectId.isValid(circleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid circleId',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMember = user.memberships.some(
      (m) => String(m.circle_id) === String(circleId)
    );

    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not a member of this circle' });
    }

    const messages = await Message.find({ circle_id: circleId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { circleId, content } = req.body;
    const userId = getUserIdFromReq(req);

    // Validate input
    if (!circleId || !content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Circle ID and message content required' });
    }

    if (!mongoose.Types.ObjectId.isValid(circleId)) {
      return res.status(400).json({ success: false, message: 'Invalid circleId' });
    }

    // Verify circle membership before allowing send
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMember = user.memberships.some(
      (m) => String(m.circle_id) === String(circleId)
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not a member of this circle' });
    }

    // Save message – using correct schema field names (sender_id, message)
    const message = new Message({
      circle_id: circleId,
      sender_id: userId,
      message: content.trim()
    });
    await message.save();

    // Log the event – do NOT log the message content, only context
    const eventPayload = buildEventPayload(req, 'message_sent', { circleId: circleId });
    if (eventPayload) {
      logEngagementEvent(eventPayload).catch(() => {});
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
