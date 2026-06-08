# Implementation Plan: Community + Circle Architecture Refactor

This plan details the steps to transition the SPARK backend from the legacy flat `Group` model to the hierarchical `Community -> Circle` paradigm as required by the Master Blueprint.

## User Review Required
> [!IMPORTANT]
> **Data Migration Strategy**
> The migration script will convert existing `groups` by creating a `Community` for each unique group `topic`, and converting the `group` itself into a `Circle` linked to that new Community. Users belonging to that group will have both the Community and Circle added to their `communities[]` and `circles[]` arrays.
> Please confirm if this is the desired behavior for existing data.

> [!WARNING]
> **Group Matching & Suggestions**
> The current `groupController.js` has complex $O(N^2)$ matching logic (`createGroups`). I plan to replace this with simpler endpoints that allow users to discover Communities by `topic` matching their interests, and then join specific Circles within those Communities. The automated grouping algorithm will be simplified to assign ungrouped users into open circles within relevant communities. Please confirm if simplifying this logic is acceptable for this phase.

## Proposed Changes

### Models

#### [NEW] [communityModel.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/models/communityModel.js)
- Schema: `name` (String, required, unique - represents the topic), `description` (String), `is_active` (Boolean).
- Replaces the top-level categorization previously handled by `groupModel.topic`.

#### [NEW] [circleModel.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/models/circleModel.js)
- Schema: `community_id` (ObjectId ref to Community), `members` (Array of ObjectIds ref to User), `capacity` (Number), `is_active` (Boolean).
- Replaces `groupModel.js`.

#### [DELETE] [groupModel.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/models/groupModel.js)
- Remove the legacy group model.

#### [MODIFY] [userModel.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/models/userModel.js)
- **Remove:** `group_id`
- **Add:** `communities` `[{ type: mongoose.Schema.Types.ObjectId, ref: 'Community' }]`
- **Add:** `circles` `[{ type: mongoose.Schema.Types.ObjectId, ref: 'Circle' }]`

### Controllers & Routes

#### [NEW] [communityController.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/controllers/communityController.js) & [communityRoutes.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/routes/communityRoutes.js)
- `GET /api/communities`: List available active communities.
- `GET /api/communities/suggestions`: Suggest communities based on user's `interests` array matching community `name`/topic.
- `POST /api/communities/:id/join`: Join a community (adds to user's `communities` array).

#### [NEW] [circleController.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/controllers/circleController.js) & [circleRoutes.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/routes/circleRoutes.js)
- Will incorporate the existing message fetching logic `GET /:circleId/messages`.
- `GET /api/circles/community/:communityId`: List circles under a specific community.
- `POST /api/circles/:circleId/join`: Join a circle (atomically checks capacity, uses `$addToSet` for thread safety, adds to `user.circles` and `circle.members`).

#### [DELETE] [groupController.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/controllers/groupController.js) & [groupRoutes.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/routes/groupRoutes.js)
- Logic absorbed by Community and Circle controllers.

#### [MODIFY] [index.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/src/index.js)
- Update route imports: remove `groupRoutes`, add `communityRoutes` and `circleRoutes`.

### Scripts

#### [NEW] [migrate-groups.js](file:///C:/Users/MAHARSHI/Downloads/SPARK/scripts/migrate-groups.js)
- Standalone Node script to read `groups`, generate `communities` based on `topics`, migrate `groups` to `circles`, and update all `users`' arrays.

## Verification Plan

### Automated Tests
- N/A - we will rely on manual API verification and running the migration script safely.

### Manual Verification
1. Run `migrate-groups.js` and verify MongoDB shows users with correct `communities` and `circles` arrays.
2. Use Postman/curl to test:
   - fetching community suggestions.
   - joining a community.
   - fetching circles in a community.
   - joining a circle (ensuring capacity limit is enforced).
3. Test Socket.IO chat (which uses `circleId`) to ensure messages persist and broadcast correctly with the new schema.
