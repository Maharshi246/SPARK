import mongoose from 'mongoose';
import Community from '../models/communityModel.js';
import Circle from '../models/circleModel.js';
import User from '../models/userModel.js';

const getUserIdFromReq = (req) => {
  if (req?.user?.id) return req.user.id;
  return req?.user;
};

// GET /api/communities
export const getCommunities = async (req, res) => {
  try {
    const communities = await Community.find({ is_active: true }).sort({ name: 1 });
    res.json({ success: true, data: communities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch communities' });
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

    // 3. Find active Circle with capacity < 8 using aggregation-like approach
    // Mongoose doesn't natively support querying array length directly without $expr or $size if variable capacity
    // But since default is 8, we can do $expr
    let circle = await Circle.findOne({
      community_id: communityId,
      is_active: true,
      $expr: { $lt: [{ $size: "$members" }, "$capacity"] }
    }).session(session);

    // 4. If none exists, create new Circle
    if (!circle) {
      const [newCircle] = await Circle.create(
        [
          {
            community_id: communityId,
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
    // If running without replica set, transactions might fail. Fallback to non-transactional could be required depending on environment.
    res.status(500).json({ success: false, message: 'Failed to join community', error: error.message });
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
    res.status(500).json({ success: false, message: 'Failed to leave community', error: error.message });
  }
};
