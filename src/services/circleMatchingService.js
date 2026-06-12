// src/services/circleMatchingService.js
// Two-Phase Funnel Architecture (replaces O(N) query loop)

import mongoose from 'mongoose';
import Circle from '../models/circleModel.js';

/**
 * Calculates the pairwise compatibility between a joining user and an existing member.
 * Max score = 100
 */
const calculatePairwiseCompatibility = (newUser, member) => {
  let score = 0;

  // 1. Interest Priority (Max 60)
  const newInterests = (newUser.interests || []).map(i => i.toLowerCase().trim());
  const memberInterests = (member.interests || []).map(i => i.toLowerCase().trim());

  let sharedInterests = 0;
  for (const interest of newInterests) {
    if (memberInterests.includes(interest)) {
      sharedInterests++;
    }
  }
  score += Math.min(sharedInterests * 10, 60);

  // 2. Depth Priority (Max 20)
  if (newUser.depth_level && member.depth_level && newUser.depth_level === member.depth_level) {
    score += 20;
  }

  // 3. Style Priority (Max 20)
  if (newUser.discussion_style && member.discussion_style && newUser.discussion_style === member.discussion_style) {
    score += 20;
  }

  return score;
};

/**
 * Circle Matching Engine — Two-Phase Funnel Architecture
 *
 * Phase 1: MongoDB Aggregation Pipeline (single DB round-trip)
 *   - Filters circles by community, active status, and capacity (using $expr)
 *   - Scores by occupancy
 *   - Returns top 5 candidates with member profiles populated
 *
 * Phase 2: Application-Level Compatibility Rerank
 *   - Runs pairwise compatibility scoring on ≤5 circles (≤40 comparisons)
 *   - Computes final weighted score
 *   - Returns the single best circle
 *
 * Performance: Reduces N+1 DB queries to exactly 2 (1 aggregate + 1 findById).
 *
 * @param {Object} user - The joining user document
 * @param {String} communityId - The community ID
 * @param {Object} session - Mongoose session (optional)
 * @returns {Object|null} - The best circle, or null if a new one should be created
 */
export const findBestCircleForUser = async (user, communityId, session) => {
  const pipeline = [
    // Stage 1: Filter to candidate circles with available capacity
    // Uses $expr for proper field-to-field comparison
    {
      $match: {
        community_id: new mongoose.Types.ObjectId(String(communityId)),
        is_active: true,
        $expr: { $lt: [{ $size: '$members' }, '$capacity'] }
      }
    },

    // Stage 2: Compute occupancy score
    {
      $addFields: {
        member_count: { $size: '$members' },
        occupancy_score: {
          $multiply: [
            { $divide: [{ $size: '$members' }, '$capacity'] },
            100
          ]
        }
      }
    },

    // Stage 3: Sort by occupancy descending (prefer fuller circles for community building)
    { $sort: { occupancy_score: -1 } },

    // Stage 4: Top 5 candidates only
    { $limit: 5 },

    // Stage 5: Populate member profiles for compatibility scoring
    {
      $lookup: {
        from: 'users',
        localField: 'members',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              interests: 1,
              depth_level: 1,
              discussion_style: 1
            }
          }
        ],
        as: 'member_profiles'
      }
    },

    // Stage 6: Project final shape
    {
      $project: {
        _id: 1,
        community_id: 1,
        members: 1,
        capacity: 1,
        is_active: 1,
        member_count: 1,
        occupancy_score: 1,
        member_profiles: 1
      }
    }
  ];

  // Execute pipeline (with session support for transactional consistency)
  const candidates = session
    ? await Circle.aggregate(pipeline).session(session)
    : await Circle.aggregate(pipeline);

  if (!candidates || candidates.length === 0) {
    return null; // No circles with capacity → caller creates a new one
  }

  // ═══════════════════════════════════════════════════════
  // Phase 2: Compatibility Rerank (app-level, ≤40 comparisons)
  // ═══════════════════════════════════════════════════════
  let bestCandidateId = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    let compatibilityScore = 0;
    const profiles = candidate.member_profiles || [];

    if (profiles.length > 0) {
      let totalCompat = 0;
      for (const member of profiles) {
        totalCompat += calculatePairwiseCompatibility(user, member);
      }
      compatibilityScore = totalCompat / profiles.length;
    }

    // Final weighted score: compatibility 60%, occupancy 40%
    const finalScore =
      (compatibilityScore * 0.60) +
      (candidate.occupancy_score * 0.40);

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestCandidateId = candidate._id;
    }
  }

  // Fetch the winning circle as a Mongoose document
  // (aggregate returns plain objects; caller needs .members.push() and .save())
  const circleDoc = await Circle.findById(bestCandidateId).session(session || null);
  return circleDoc || null;
};
