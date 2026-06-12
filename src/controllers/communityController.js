import mongoose from 'mongoose';
import Community from '../models/communityModel.js';
import Circle from '../models/circleModel.js';
import User from '../models/userModel.js';
import { findBestCircleForUser } from '../services/circleMatchingService.js';
import { logEngagementEvent, buildEventPayload } from '../services/engagementLogService.js';

const getUserIdFromReq = (req) => {
  if (req?.user?.id) return req.user.id;
  return req?.user;
};

// GET /api/communities
export const getCommunities = async (req, res) => {
  try {
    const user = req.user;
    const filter = { is_active: true };
    
    if (user.role !== 'admin') {
      filter.university_id = user.university_id;
    }

    const communities = await Community.find(filter).sort({ name: 1 });
    res.json({ success: true, data: communities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch communities' });
  }
};

// GET /api/communities/:id
export const getCommunityById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const community = await Community.findById(id).lean();
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found' });
    }

    if (user.role !== 'admin' && String(community.university_id) !== String(user.university_id)) {
      return res.status(403).json({ success: false, message: 'Access denied: Community belongs to a different university' });
    }
    // Log the view event (fire-and-forget, non-blocking)
    const eventPayload = buildEventPayload(req, 'community_viewed', { communityId: id });
    if (eventPayload) {
      logEngagementEvent(eventPayload).catch(() => {});
    }
    res.json({ success: true, data: community });
  } catch (error) {
    console.error('Error fetching community:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/communities/my-communities
export const getMyCommunities = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const user = await User.findById(userId)
      .populate('memberships.community_id')
      .populate('memberships.circle_id');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user.memberships });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user communities' });
  }
};

// POST /api/communities/:id/join
export const joinCommunity = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdFromReq(req);
    const communityId = req.params.id;

    // 1. Verify community
    const community = await Community.findById(communityId).session(session);
    if (!community || !community.is_active) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Community not found or inactive' });
    }

    const reqUser = req.user;
    if (reqUser.role !== 'admin' && String(community.university_id) !== String(reqUser.university_id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Access denied: Community belongs to a different university' });
    }

    // 2. Verify user and check if already joined
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const alreadyJoined = user.memberships.some(
      (m) => String(m.community_id) === String(communityId)
    );
    if (alreadyJoined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Already a member of this community' });
    }

    // 3. Find the most compatible Circle with capacity < 8
    let circle = await findBestCircleForUser(user, communityId, session);

    // 4. If none exists, create new Circle
    if (!circle) {
      const [newCircle] = await Circle.create(
        [
          {
            community_id: communityId,
            university_id: community.university_id,
            members: [userId],
            is_active: true,
            capacity: 8,
          },
        ],
        { session }
      );
      circle = newCircle;
    } else {
      // Add user to existing circle
      circle.members.push(userId);
      await circle.save({ session });
    }

    // 5. Add membership record to User
    user.memberships.push({
      community_id: communityId,
      circle_id: circle._id,
      joined_at: new Date(),
    });
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Log circle_joined event (fire-and-forget, after transaction success)
    const eventPayload = buildEventPayload(req, 'circle_joined', {
      communityId: communityId,
      circleId: String(circle._id)
    });
    if (eventPayload) {
      logEngagementEvent(eventPayload).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Successfully joined community and assigned to circle',
      data: {
        community_id: communityId,
        circle_id: circle._id,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: 'Failed to join community' });
  }
};

// POST /api/communities/:id/leave
export const leaveCommunity = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdFromReq(req);
    const communityId = req.params.id;

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const membershipIndex = user.memberships.findIndex(
      (m) => String(m.community_id) === String(communityId)
    );

    if (membershipIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Not a member of this community' });
    }

    const circleId = user.memberships[membershipIndex].circle_id;

    // Remove user from Circle
    await Circle.findByIdAndUpdate(
      circleId,
      { $pull: { members: userId } },
      { session }
    );

    // Remove membership from User
    user.memberships.splice(membershipIndex, 1);
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: 'Successfully left community and associated circle' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: 'Failed to leave community' });
  }
};
