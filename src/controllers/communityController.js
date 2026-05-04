import mongoose from 'mongoose';
import Community from '../models/communityModel.js';
import User from '../models/userModel.js';
import Circle from '../models/circleModel.js';

const getUserIdFromReq = (req) => {
  if (!req?.user) return null;
  if (typeof req.user === 'string') return req.user;
  if (typeof req.user === 'object' && req.user.id) return req.user.id;
  return null;
};

export const getSuggestedCommunities = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const interests = Array.isArray(user.interests) ? user.interests : [];
    if (interests.length === 0) {
      return res.json({ success: true, communities: [] });
    }

    const communities = await Community.find({
      topic: { $in: interests },
    }).lean();

    return res.json({ success: true, communities });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching community suggestions',
      error: error?.message || String(error),
    });
  }
};

export const getAllCommunities = async (req, res) => {
  try {
    const communities = await Community.find();

    res.json({
      success: true,
      data: communities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching communities',
    });
  }
};

export const joinCommunity = async (req, res) => {
  try {
    const userId =
      getUserIdFromReq(req) ||
      (req?.user && typeof req.user === 'object' ? req.user.userId : null);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { communityId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid communityId' });
    }
    const community = await Community.findById(communityId);
    if (!community) {
      return res
        .status(404)
        .json({ success: false, message: 'Community not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const members = Array.isArray(community.members) ? community.members : [];
    const alreadyJoined = members.some((m) => String(m) === String(userId));
    if (!alreadyJoined) {
      community.members.push(userId);
      await community.save();

      // Optional UX: also track joined communities on the user
      await User.findByIdAndUpdate(
        userId,
        { $addToSet: { joinedCommunities: community._id } },
        { new: false }
      );
    }

    // 1) If user already has a circle for this community, return it immediately
    const membershipSnapshot = await User.findById(userId)
      .select('circle_memberships')
      .lean();

    const existingMembership = (membershipSnapshot?.circle_memberships || []).find(
      (m) => String(m.community) === String(communityId)
    );

    if (existingMembership?.circle) {
      const existingCircle = await Circle.findById(existingMembership.circle);
      if (existingCircle) {
        return res.json({
          success: true,
          message: 'Joined community and assigned to circle',
          circle: existingCircle,
        });
      }

      // If the membership points at a missing circle, reset and continue
      await User.updateOne(
        {
          _id: userId,
          'circle_memberships.community': communityId,
          'circle_memberships.circle': existingMembership.circle,
        },
        { $set: { 'circle_memberships.$.circle': null } }
      );
    }

    // 2) Claim a membership slot first (prevents concurrent double-assignment)
    await User.updateOne(
      { _id: userId, 'circle_memberships.community': { $ne: communityId } },
      {
        $push: {
          circle_memberships: {
            community: communityId,
            circle: null,
          },
        },
      }
    );

    // Re-check: if another request already assigned a circle, return it
    const afterClaim = await User.findById(userId).select('circle_memberships').lean();
    const claimedMembership = (afterClaim?.circle_memberships || []).find(
      (m) => String(m.community) === String(communityId)
    );

    if (claimedMembership?.circle) {
      const existingCircle = await Circle.findById(claimedMembership.circle);
      if (existingCircle) {
        return res.json({
          success: true,
          message: 'Joined community and assigned to circle',
          circle: existingCircle,
        });
      }
    }

    // 3) ATOMIC circle assignment using members_count
    let circle = await Circle.findOneAndUpdate(
      {
        community: communityId,
        members_count: { $lt: 8 },
        members: { $ne: userId },
      },
      {
        $addToSet: { members: userId },
        $inc: { members_count: 1 },
      },
      { new: true }
    );

    // 4) If no circle found, create a new circle
    if (!circle) {
      circle = await Circle.create({
        community: communityId,
        members: [userId],
        members_count: 1,
        max_size: 8,
      });
    }

    // 5) Save circle id into the user's membership, only if still unassigned
    const setCircleResult = await User.updateOne(
      {
        _id: userId,
        'circle_memberships.community': communityId,
        'circle_memberships.circle': null,
      },
      { $set: { 'circle_memberships.$.circle': circle._id } }
    );

    // If we didn't set it, another concurrent request already did. Clean up and return the final circle.
    if (setCircleResult.modifiedCount === 0) {
      const finalUser = await User.findById(userId).select('circle_memberships').lean();
      const finalMembership = (finalUser?.circle_memberships || []).find(
        (m) => String(m.community) === String(communityId)
      );

      if (finalMembership?.circle && String(finalMembership.circle) !== String(circle._id)) {
        await Circle.updateOne(
          { _id: circle._id, members: userId, members_count: { $gt: 0 } },
          { $pull: { members: userId }, $inc: { members_count: -1 } }
        );
        const finalCircle = await Circle.findById(finalMembership.circle);
        if (finalCircle) {
          circle = finalCircle;
        }
      }
    }

    return res.json({
      success: true,
      message: 'Joined community and assigned to circle',
      circle,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error joining community',
      error: error?.message || String(error),
    });
  }
};

export async function seedCommunities() {
  try {
    const count = await Community.countDocuments();
    if (count > 0) {
      console.log('Seeding skipped — communities already exist');
      return;
    }

    const communities = [
      {
        name: 'AI Builders',
        topic: 'AI/ML',
        description: 'Explore machine learning, deep learning, and AI systems',
      },
      {
        name: 'Cyber Defenders',
        topic: 'Cybersecurity',
        description: 'Learn ethical hacking, security, and system protection',
      },
      {
        name: 'Web Creators',
        topic: 'Web Development',
        description: 'Frontend, backend, and full-stack web development',
      },
      {
        name: 'Thinkers Circle',
        topic: 'Philosophy & Literature',
        description: 'Deep discussions on ideas, books, and human thinking',
      },
      {
        name: 'Visual Creators',
        topic: '3D & Video Editing',
        description: 'Blender, animation, and video production',
      },
      {
        name: 'Startup Lab',
        topic: 'Startups',
        description: 'Build ideas, startups, and entrepreneurial mindset',
      },
    ].map((c) => ({ ...c, members: [] }));

    // Extra safety: if a topic already exists, don't create it again
    const topics = communities.map((c) => c.topic);
    const existingTopic = await Community.findOne({ topic: { $in: topics } }).lean();
    if (existingTopic) {
      console.log('Seeding skipped — communities already exist');
      return;
    }

    // Ensure unique index exists before inserting (best-effort)
    await Community.init();

    await Community.bulkWrite(
      communities.map((c) => ({
        updateOne: {
          filter: { topic: c.topic },
          update: { $setOnInsert: c },
          upsert: true,
        },
      }))
    );

    console.log('Communities seeded successfully');
  } catch (error) {
    console.error('Error seeding communities:', error?.message || error);
  }
}
