import User from '../models/userModel.js';
import Group from '../models/groupModel.js';

// Helper: Create default groups for testing
export const createDefaultGroups = async () => {
  try {
    const count = await Group.countDocuments();
    if (count > 0) return; // Already has groups

    const defaultTopics = ['AI', 'Cyber', 'Startups', 'Blockchain', 'Cloud'];
    for (const topic of defaultTopics) {
      await Group.create({
        topic,
        members: [],
        capacity: 5,
        is_active: true,
      });
    }
    console.log('Default groups created');
  } catch (error) {
    console.error('Error creating default groups:', error.message);
  }
};

const calculateScore = (userA, userB) => {
  let score = 0;

  // 1. Interests match: +2 for first, +1 for each additional
  if (userA.interests && userB.interests) {
    const userAInterests = userA.interests || [];
    const userBInterests = userB.interests || [];
    const matches = userAInterests.filter((interest) =>
      userBInterests.includes(interest)
    );
    if (matches.length > 0) {
      score += 2 + (matches.length - 1);
    }
  }

  // 2. Depth level: Same = +2, Close (intermediate/deep) = +1
  if (userA.depth_level && userB.depth_level) {
    if (userA.depth_level === userB.depth_level) {
      score += 2;
    } else if (
      ['intermediate', 'deep'].includes(userA.depth_level) &&
      ['intermediate', 'deep'].includes(userB.depth_level)
    ) {
      score += 1;
    }
  }

  // 3. Discussion style: Same = +1
  if (userA.discussion_style && userB.discussion_style) {
    if (userA.discussion_style === userB.discussion_style) {
      score += 1;
    }
  }

  // 4. Availability: At least one overlap = +1
  if (userA.availability && userB.availability) {
    const userAAvail = userA.availability || [];
    const userBAvail = userB.availability || [];
    const overlap = userAAvail.some((slot) => userBAvail.includes(slot));
    if (overlap) {
      score += 1;
    }
  }

  return score;
};

export const getSuggestions = async (req, res) => {
  try {
    const userId = req.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userInterests = user.interests || [];

    if (userInterests.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'Add interests to get group suggestions',
      });
    }

    // Find groups with matching topics
    const suggestedGroups = await Group.find({
      topic: { $in: userInterests },
      is_active: true,
    }).populate('members', 'display_name email');

    res.json({
      success: true,
      data: suggestedGroups,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching suggestions',
      error: error.message,
    });
  }
};

export const joinGroup = async (req, res) => {
  try {
    const userId = req.user;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    if (!group.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Group is inactive',
      });
    }

    // Check capacity
    if (group.members.length >= group.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Group is full',
      });
    }

    // Check if already member
    const isMember = group.members.some(
      (memberId) => memberId.toString() === userId
    );

    if (isMember) {
      return res.json({
        success: true,
        message: 'Already a member of this group',
        data: group,
      });
    }

    // Add user to group
    group.members.push(userId);
    await group.save();

    const updatedGroup = await Group.findById(groupId).populate(
      'members',
      'display_name email'
    );

    res.json({
      success: true,
      message: 'Joined group successfully',
      data: updatedGroup,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error joining group',
      error: error.message,
    });
  }
};

export const getMyGroup = async (req, res) => {
  try {
    const userId = req.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.group_id) {
      return res.json({
        success: true,
        group: null,
        message: 'User is not in any group',
      });
    }

    const group = await Group.findById(user.group_id).populate('members');

    res.json({
      success: true,
      group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching group',
      error: error.message,
    });
  }
};

export const createGroups = async (req, res) => {
  try {
    // Fetch only ungrouped users with interests
    const allUsers = await User.find({
      interests: { $exists: true, $ne: [] },
      group_id: null,
    });

    if (allUsers.length < 3) {
      return res.json({
        success: true,
        groups: [],
        message: 'Not enough ungrouped users with interests to form groups',
      });
    }

    const groups = [];
    const grouped = new Set();

    // For each ungrouped user, find best matches and form a group
    for (let i = 0; i < allUsers.length; i++) {
      const userA = allUsers[i];
      const userAId = String(userA._id);

      // Skip if already in a group
      if (grouped.has(userAId)) {
        continue;
      }

      // Calculate scores with all other ungrouped users
      const candidates = [];

      for (let j = 0; j < allUsers.length; j++) {
        if (i === j) continue;
        const userB = allUsers[j];
        const userBId = String(userB._id);
        if (grouped.has(userBId)) continue;

        const score = calculateScore(userA, userB);
        candidates.push({ user: userB, score });
      }

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);

      // Pick top 2-3 candidates to form group of 3-4
      const groupMembers = [userA];
      const topCandidates = candidates.slice(0, 3); // Pick top 3

      for (const candidate of topCandidates) {
        groupMembers.push(candidate.user);
        grouped.add(String(candidate.user._id));
      }

      grouped.add(userAId);

      // Create Group document
      const memberIds = groupMembers.map((u) => u._id);
      const groupDoc = await Group.create({
        members: memberIds,
        is_active: true,
      });

      // Assign group_id to each user and save
      for (const user of groupMembers) {
        user.group_id = groupDoc._id;
        await user.save();
      }

      groups.push(groupDoc);
    }

    res.json({
      success: true,
      groups,
      message: `Created ${groups.length} groups`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating groups',
      error: error.message,
    });
  }
};
