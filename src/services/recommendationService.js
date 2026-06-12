// src/services/recommendationService.js

import Community from '../models/communityModel.js';

/**
 * Deterministic scoring algorithm for Community Recommendations.
 * Returns a list of communities sorted by relevance to the user's curiosity fingerprint.
 */
export const getRecommendationsForUser = async (user) => {
  // 1. Fetch all active communities
  const communities = await Community.find({ is_active: true });

  // 2. Filter out communities the user is already a member of
  const joinedCommunityIds = (user.memberships || []).map(m => String(m.community_id));
  const availableCommunities = communities.filter(c => !joinedCommunityIds.includes(String(c._id)));

  // 3. User's fingerprint
  const userInterests = (user.interests || []).map(i => i.toLowerCase().trim());
  const userDepth = user.depth_level;
  const userStyle = user.discussion_style;

  const scoredCommunities = [];

  for (const community of availableCommunities) {
    let score = 0;
    const reasons = [];

    // Phase 1: Interest Matching (Max 60 points)
    let interestScore = 0;
    const commName = community.name.toLowerCase();
    const commDesc = (community.description || '').toLowerCase();
    const commTags = community.tags || [];

    for (const interest of userInterests) {
      if (
        commName.includes(interest) ||
        commDesc.includes(interest) ||
        commTags.some(tag => tag.includes(interest) || interest.includes(tag))
      ) {
        interestScore += 30;
        reasons.push(`Matches interest: ${interest}`);
      }
    }
    
    // Cap interest score at 60
    if (interestScore > 60) interestScore = 60;
    score += interestScore;

    // Phase 2: Depth Matching (Max 20 points)
    const commDepth = community.metadata?.depth_level;
    if (userDepth && commDepth) {
      if (userDepth === commDepth) {
        score += 20;
        reasons.push(`Matches depth preference: ${userDepth}`);
      }
    }

    // Phase 3: Discussion Style Matching (Max 20 points)
    const commStyle = community.metadata?.discussion_style;
    if (userStyle && commStyle) {
      if (userStyle === commStyle) {
        score += 20;
        reasons.push(`Matches discussion style: ${userStyle}`);
      }
    }

    scoredCommunities.push({
      community_id: community._id,
      name: community.name,
      description: community.description,
      score,
      reasons: [...new Set(reasons)] // Unique reasons
    });
  }

  // 4. Sort by score descending
  scoredCommunities.sort((a, b) => b.score - a.score);

  return scoredCommunities;
};
