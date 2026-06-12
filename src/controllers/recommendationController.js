import Community from '../models/communityModel.js';

export const getRecommendations = async (req, res, next) => {
  try {
    // Basic implementation: fetch all active communities
    // In a real app, this would use req.user.interests, etc.
    const user = req.user;
    const communities = await Community.find({ 
      is_active: true,
      university_id: user?.university_id 
    });
    res.json({ success: true, data: communities });
  } catch (error) {
    next(error);
  }
};
