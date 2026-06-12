# Day 1: Circle Matching Pipeline Design

> **Sprint:** Production Hardening
> **Target File:** [circleMatchingService.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/circleMatchingService.js) (READ ONLY — no changes today)
> **Status:** Design review pending approval

---

## Current Bottleneck (What We're Replacing)

The current [findBestCircleForUser](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/circleMatchingService.js#L47-L121) executes this sequence:

```
Step 1:  Circle.find({ community_id, is_active, capacity check }).populate('members')
         → 1 query, but returns ALL candidate circles with FULL User documents populated

Step 2:  for (const circle of candidateCircles) {          ← Loops N times
           for (const member of circle.members) {          ← Loops M times (≤8)
             calculatePairwiseCompatibility(user, member)  ← CPU work
           }
           await Message.countDocuments(...)                ← 🔴 1 DB query PER circle
         }

Step 3:  Sort in JS → return top result
```

**Cost per join request:** `1 + N` database round-trips, where N = number of open circles in the community.

---

## Proposed Design: Two-Phase Funnel Architecture

> [!IMPORTANT]
> **Core principle:** Move filtering, occupancy, and activity scoring INTO the database as a single aggregation pipeline. Run compatibility scoring in application code on only a tiny shortlist.

### Why Two Phases (Not Pure DB)?

The compatibility score requires comparing the joining user's `interests[]`, `depth_level`, and `discussion_style` against **each member's profile** in each circle. Pushing this entirely into the aggregation pipeline is technically possible (shown in Appendix A below), but it:

- Adds a `$lookup` to the `users` collection (another join)
- Requires `$map` + `$setIntersection` + `$toLower` expressions for case-insensitive interest matching
- Makes the pipeline fragile and hard to debug

**The smarter approach:** Let the pipeline do the heavy lifting (filter + score + rank), return only the **top 5 candidates**, then run the lightweight `calculatePairwiseCompatibility()` function on just those 5 circles (at most 5 × 8 = 40 comparisons). This preserves full compatibility scoring while eliminating the O(N) query loop.

---

## Phase 1: The Aggregation Pipeline (Single DB Trip)

This pipeline runs against the `circles` collection. It replaces both the `Circle.find().populate()` AND the N `Message.countDocuments()` calls.

```javascript
// ─── Inputs (passed from application code) ───
// communityId: string — the target community ObjectId
// sevenDaysAgo: Date — new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

const pipeline = [

  // ┌─────────────────────────────────────────────────┐
  // │ Stage 1: MATCH — Filter to candidate circles    │
  // │ Uses the existing { community_id: 1 } index     │
  // └─────────────────────────────────────────────────┘
  {
    $match: {
      community_id: new mongoose.Types.ObjectId(communityId),
      is_active: true,
      $expr: { $lt: [{ $size: "$members" }, "$capacity"] }
    }
  },

  // ┌─────────────────────────────────────────────────┐
  // │ Stage 2: COMPUTE — Occupancy score (in-memory)  │
  // │ Formula: (members.length / capacity) × 100      │
  // │ This biases toward fuller (more active) circles  │
  // └─────────────────────────────────────────────────┘
  {
    $addFields: {
      member_count: { $size: "$members" },
      occupancy_score: {
        $multiply: [
          { $divide: [{ $size: "$members" }, "$capacity"] },
          100
        ]
      }
    }
  },

  // ┌─────────────────────────────────────────────────────┐
  // │ Stage 3: LOOKUP — Activity score (replaces N queries│
  // │ Correlated sub-pipeline against `messages` collection│
  // │ Counts messages per circle in the last 7 days        │
  // │ Leverages existing compound index:                   │
  // │   { circle_id: 1, createdAt: -1 }                   │
  // └─────────────────────────────────────────────────────┘
  {
    $lookup: {
      from: "messages",
      let: { circle_id: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$circle_id", "$$circle_id"] },
            createdAt: { $gte: sevenDaysAgo }
          }
        },
        { $count: "count" }
      ],
      as: "recent_activity"
    }
  },

  // ┌─────────────────────────────────────────────────┐
  // │ Stage 4: NORMALIZE — Activity to 0-100 scale    │
  // │ Formula: min((messageCount / 50) × 100, 100)    │
  // │ Matches existing normalization exactly           │
  // └─────────────────────────────────────────────────┘
  {
    $addFields: {
      raw_message_count: {
        $ifNull: [
          { $arrayElemAt: ["$recent_activity.count", 0] },
          0
        ]
      }
    }
  },
  {
    $addFields: {
      activity_score: {
        $min: [
          {
            $multiply: [
              { $divide: ["$raw_message_count", 50] },
              100
            ]
          },
          100
        ]
      }
    }
  },

  // ┌─────────────────────────────────────────────────────┐
  // │ Stage 5: SCORE — Preliminary ranking                │
  // │ Uses only Occupancy (25%) + Activity (15%)          │
  // │ Reweighted to their original ratio:                 │
  // │   Occupancy: 25/(25+15) = 62.5%                    │
  // │   Activity:  15/(25+15) = 37.5%                    │
  // │ Compatibility (60%) applied in Phase 2 on shortlist │
  // └─────────────────────────────────────────────────────┘
  {
    $addFields: {
      prelim_score: {
        $add: [
          { $multiply: ["$occupancy_score", 0.625] },
          { $multiply: ["$activity_score", 0.375] }
        ]
      }
    }
  },

  // ┌─────────────────────────────────────────────────┐
  // │ Stage 6: SORT — Best candidates first           │
  // └─────────────────────────────────────────────────┘
  { $sort: { prelim_score: -1 } },

  // ┌─────────────────────────────────────────────────┐
  // │ Stage 7: LIMIT — Top 5 candidates only          │
  // │ (Not 1 — we need headroom for Phase 2 rerank)   │
  // └─────────────────────────────────────────────────┘
  { $limit: 5 },

  // ┌─────────────────────────────────────────────────┐
  // │ Stage 8: POPULATE — Fetch member profiles       │
  // │ Only for the 5 finalists (max 40 user docs)     │
  // │ Needed for Phase 2 compatibility scoring        │
  // └─────────────────────────────────────────────────┘
  {
    $lookup: {
      from: "users",
      localField: "members",
      foreignField: "_id",
      pipeline: [
        {
          $project: {
            interests: 1,
            depth_level: 1,
            discussion_style: 1
          }
        }
      ],
      as: "member_profiles"
    }
  },

  // ┌─────────────────────────────────────────────────┐
  // │ Stage 9: PROJECT — Return only what we need     │
  // └─────────────────────────────────────────────────┘
  {
    $project: {
      _id: 1,
      community_id: 1,
      members: 1,
      capacity: 1,
      is_active: 1,
      member_count: 1,
      occupancy_score: 1,
      activity_score: 1,
      prelim_score: 1,
      member_profiles: 1
    }
  }
];
```

### Pipeline Output Shape

```json
[
  {
    "_id": "ObjectId",
    "community_id": "ObjectId",
    "members": ["ObjectId", "..."],
    "capacity": 8,
    "is_active": true,
    "member_count": 6,
    "occupancy_score": 75,
    "activity_score": 40,
    "prelim_score": 61.875,
    "member_profiles": [
      { "_id": "...", "interests": ["ai", "math"], "depth_level": "deep", "discussion_style": "debate" },
      { "_id": "...", "interests": ["coding"], "depth_level": "surface", "discussion_style": "explore" }
    ]
  }
]
```

---

## Phase 2: Application-Level Compatibility Rerank

After the pipeline returns ≤ 5 candidates with their `member_profiles` already populated, the existing `calculatePairwiseCompatibility()` function runs unchanged:

```
For each of the ≤ 5 circles:
  avg_compatibility = average of pairwiseScore(joiningUser, member) for all members
  
  final_score = (avg_compatibility × 0.60) 
              + (occupancy_score × 0.25) 
              + (activity_score × 0.15)

Return the circle with the highest final_score.
If no candidates → return null (triggers new circle creation).
```

**Maximum work:** 5 circles × 8 members = **40 pairwise comparisons**. This is O(1) constant-bounded work regardless of how many circles exist in the community.

---

## Complexity Comparison

| Metric | Current Implementation | Proposed Pipeline |
|---|---|---|
| **DB round-trips** | `1 + N` (1 find + N countDocuments) | **1** (single aggregate) |
| **User docs loaded** | All members of ALL N circles (`N × 8`) | Only top-5 circles' members (`≤ 40`) |
| **Message count queries** | N separate `countDocuments` | **0** (folded into `$lookup`) |
| **Pairwise comparisons** | `N × M` (all circles × all members) | **≤ 5 × 8 = 40** (constant bound) |
| **Event loop blocking** | Entire scoring loop is synchronous | Single `await` yields event loop once |
| **At 500 open circles** | 501 DB queries + 4,000 user docs loaded | 1 DB query + ≤ 40 user docs loaded |

---

## Index Coverage

The pipeline leverages indexes that **already exist** in the codebase:

| Stage | Index Used | Defined In |
|---|---|---|
| `$match` on `community_id` | `{ community_id: 1 }` | [circleModel.js:9](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/models/circleModel.js#L9) |
| `$lookup` on messages | `{ circle_id: 1, createdAt: -1 }` | [messageModel.js:32](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/models/messageModel.js#L32) |
| `$lookup` on users | `{ _id: 1 }` (default `_id` index) | Built-in |

**No new indexes required.**

---

## Conflict Check

> [!NOTE]
> **No conflicts with previous work.** This design:
> - Does not change any schema, model, route, or controller.
> - Does not alter the scoring formula — the same three factors (compatibility 60%, occupancy 25%, activity 15%) are preserved exactly.
> - Does not change the `joinCommunity` controller flow — it still calls `findBestCircleForUser()`, which still returns a circle or `null`.
> - Does not affect the transaction logic in `communityController.js`.
> - The `session` parameter is compatible — `Circle.aggregate(...).session(session)` is supported by Mongoose.

---

## Appendix A: All-In-DB Variant (Full Compatibility in Pipeline)

If you want to eliminate Phase 2 entirely and do **everything** in the pipeline including compatibility scoring, this is the `$addFields` stage that would replace Stage 5 and make `$limit: 1` possible:

```javascript
// ⚠️ COMPLEX — shown for reference, NOT the recommended approach

// Requires these variables to be passed in:
// userInterests: ["ai", "math"] (already lowercased/trimmed)
// userDepth: "deep"
// userStyle: "debate"

{
  $addFields: {
    compatibility_score: {
      $cond: {
        if: { $gt: [{ $size: "$member_profiles" }, 0] },
        then: {
          $avg: {
            $map: {
              input: "$member_profiles",
              as: "m",
              in: {
                $add: [
                  // Interest overlap: min(sharedCount × 10, 60)
                  {
                    $min: [
                      {
                        $multiply: [
                          {
                            $size: {
                              $setIntersection: [
                                userInterests,   // pre-lowercased array passed in
                                {
                                  $map: {
                                    input: { $ifNull: ["$$m.interests", []] },
                                    as: "i",
                                    in: { $toLower: "$$i" }
                                  }
                                }
                              ]
                            }
                          },
                          10
                        ]
                      },
                      60
                    ]
                  },
                  // Depth match: 20 if equal, 0 otherwise
                  {
                    $cond: {
                      if: {
                        $and: [
                          { $ne: [userDepth, null] },
                          { $eq: ["$$m.depth_level", userDepth] }
                        ]
                      },
                      then: 20,
                      else: 0
                    }
                  },
                  // Style match: 20 if equal, 0 otherwise
                  {
                    $cond: {
                      if: {
                        $and: [
                          { $ne: [userStyle, null] },
                          { $eq: ["$$m.discussion_style", userStyle] }
                        ]
                      },
                      then: 20,
                      else: 0
                    }
                  }
                ]
              }
            }
          }
        },
        else: 0
      }
    }
  }
},

// Then final_score with all three weights:
{
  $addFields: {
    final_score: {
      $add: [
        { $multiply: ["$compatibility_score", 0.60] },
        { $multiply: ["$occupancy_score", 0.25] },
        { $multiply: ["$activity_score", 0.15] }
      ]
    }
  }
},

{ $sort: { final_score: -1 } },
{ $limit: 1 }
```

> [!WARNING]
> This variant adds a `$lookup` to users for ALL candidate circles (before the sort/limit), which partially reintroduces the scaling concern. The two-phase funnel approach (Phase 1: pipeline → top 5, Phase 2: app compatibility on 5) is the recommended design because it bounds the `$lookup` to users to only the finalists.

---

## Decision Requested

Which variant would you like me to implement tomorrow?

- **Option A (Recommended): Two-Phase Funnel** — Pipeline returns top 5 by activity + occupancy, app code reranks by compatibility. Maximum performance, preserves exact scoring behavior.
- **Option B: All-In-DB** — Single pipeline returns the #1 circle with all three factors scored. Simpler calling code, but more complex pipeline and slightly higher DB cost.
