# SPARK Full Codebase Audit Report

**Auditor:** Principal Security & Quality Architect (Adversarial)
**Date:** 2026-06-11
**Scope:** All backend files (`src/`) — models, controllers, services, middleware, routes, socket layer, config

---

## EXECUTIVE SUMMARY

**Overall Risk Level: 🔴 CRITICAL**

The SPARK codebase has a **fatal module system conflict**: `package.json` declares `"type": "module"` (ESM), but three recently modified files (`circleMatchingService.js`, `authMiddleware.js`, `engagementLogService.js`) use CommonJS `require()` syntax — **the server will crash on startup**. Beyond this, the `sendMessage` REST endpoint writes to non-existent schema fields (`user_id`, `content` instead of `sender_id`, `message`), guaranteeing Mongoose validation failures. A JWT claim mismatch between the token signer (`userId` claim) and the `authMiddleware.js` decoder (`decoded.id`) means **every authenticated request through the new middleware returns 401 Unauthorized**.

---

## ISSUES TABLE

| # | Severity | Category | File (approx line) | Description | Recommendation |
|---|----------|----------|---------------------|-------------|----------------|
| 1 | 🔴 CRITICAL | Module System | `package.json` L4 vs 3 service files | `"type": "module"` but `circleMatchingService.js`, `authMiddleware.js`, `engagementLogService.js` use `require()` | Convert those 3 files back to ESM `import`/`export`, OR remove `"type": "module"` from package.json |
| 2 | 🔴 CRITICAL | Auth – JWT Mismatch | `authMiddleware.js` L14 vs `authController.js` L7 | Token signed with `{ userId }` but middleware reads `decoded.id` → always `undefined` → every protected request returns 401 | Change `decoded.id` → `decoded.userId` in `authMiddleware.js` |
| 3 | 🔴 CRITICAL | Data Integrity | `messageController.js` L64-67 | `sendMessage` creates Message with fields `{ user_id, content }` but schema has `{ sender_id, message }` → Mongoose validation error, messages never save | Align field names to match [messageModel.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/models/messageModel.js) schema |
| 4 | 🔴 CRITICAL | Dual Auth Middleware | `auth.js` vs `authMiddleware.js` | Two competing protect functions — `auth.js` sets `req.user = { id, userId }`, `authMiddleware.js` sets `req.user = <full doc>`. Routes import from different sources → inconsistent `req.user` shape | Consolidate to a single middleware file |
| 5 | 🟠 HIGH | Auth – `buildEventPayload` | `engagementLogService.js` L20 | Checks `req.user._id` but `auth.js` protect sets `req.user = { id, userId }` (no `_id`) → `buildEventPayload` always returns `null` for routes using `auth.js` | Normalize to check `req.user._id || req.user.id` |
| 6 | 🟠 HIGH | Security | `engagementController.js` L7-22 | `getEvents` exposes all engagement data with user-supplied query filters and no authorization check beyond `protect` — any authenticated user can query any other user's events | Add ownership check: `query.user_id = req.user.id` unless admin |
| 7 | 🟠 HIGH | Security | `socket/index.js` L49-64 | `join_circle` socket event allows any authenticated user to join any circle room without verifying membership | Validate circle membership before `socket.join(room)` |
| 8 | 🟠 HIGH | Security | `messageController.js` L55-68 | `sendMessage` does not verify the user is a member of the target circle → any user can post to any circle | Add membership check (like `getCircleMessages` does) |
| 9 | 🟠 HIGH | Security | All routes | No rate limiting on `/api/auth/login`, `/api/auth/register`, or any endpoint → brute-force and credential-stuffing attacks | Add `express-rate-limit` to auth endpoints |
| 10 | 🟠 HIGH | Duplicate Service | `engagementService.js` vs `engagementLogService.js` vs `telemetryService.js` | Three separate services all write to EngagementEvent — `engagementService.js` accepts non-enum event types like `session_end`, `recommendation_viewed` that will cause Mongoose validation errors | Consolidate into one canonical service; update enum if new event types are valid |
| 11 | 🟡 MEDIUM | Data Integrity | `engagementService.js` L13-18 | Writes `community_id`, `circle_id`, `metadata` as top-level fields, but the updated schema nests IDs under `context` and has no `metadata` field → documents saved with wrong shape | Update to use `context: { community_id, circle_id }` |
| 12 | 🟡 MEDIUM | Security | `communityController.js` L141 | Error response includes `error: error.message` — leaks internal stack details | Remove `error.message` from production responses |
| 13 | 🟡 MEDIUM | Performance | `engagementController.js` L14-17 | `community_id` and `circle_id` query filters reference top-level fields but schema nests them under `context.community_id` / `context.circle_id` → queries always return empty | Update to `query['context.community_id']` |
| 14 | 🟡 MEDIUM | Performance | `circleMatchingService.js` L21 | `$match: { currentMemberCount: { $lt: "$capacity" } }` — comparing a field to a string literal `"$capacity"` in a `$match` stage doesn't work; needs `$expr` | Use `$expr: { $lt: ["$currentMemberCount", "$capacity"] }` |
| 15 | 🟡 MEDIUM | Production | `index.js` | No `helmet` middleware for security headers, no `express.json({ limit })` for body size limiting | Add `helmet()` and `{ limit: '1mb' }` |
| 16 | 🟡 MEDIUM | Production | `index.js` L35 | CORS hardcoded to `http://localhost:3000` — will block all requests in production | Use `CORS_ORIGIN` env var |
| 17 | 🟡 MEDIUM | Production | `index.js` | No graceful shutdown handler (SIGTERM/SIGINT) — active requests and DB connections terminated abruptly on deploy | Add process signal handlers |
| 18 | 🟢 LOW | Data Integrity | `circleModel.js` | No schema-level enforcement of `capacity` limit on `members` array — relies entirely on business logic | Consider a pre-save validator |

---

## DETAILED FINDINGS

### Finding 1 — 🔴 Module System Conflict (Server Won't Start)

[package.json](file:///c:/Users/MAHARSHI/Downloads/SPARK/package.json) declares `"type": "module"` at line 4. This means Node.js treats **every `.js` file** as ESM. However, these files use CommonJS:

| File | Syntax Used |
|------|-------------|
| [circleMatchingService.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/circleMatchingService.js) | `require()` / `module.exports` |
| [authMiddleware.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/middleware/authMiddleware.js) | `require()` / `module.exports` |
| [engagementLogService.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/engagementLogService.js) | `require()` / `module.exports` |
| [engagementEventModel.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/models/engagementEventModel.js) | `require()` / `module.exports` |
| [telemetryService.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/telemetryService.js) | `require()` / `module.exports` |

Running `node src/index.js` will throw `ReferenceError: require is not defined in ES module scope` the moment any of these files is imported.

**Fix:** Convert these 5 files to ESM (`import`/`export default`). The rest of the codebase already uses ESM.

---

### Finding 2 — 🔴 JWT Claim Mismatch (Auth Always Fails)

[authController.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/controllers/authController.js#L7) signs the token as:
```js
jwt.sign({ userId }, process.env.JWT_SECRET, ...)
```

But [authMiddleware.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/middleware/authMiddleware.js#L14) decodes as:
```js
const user = await User.findById(decoded.id) // decoded.id is undefined!
```

The original [auth.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/middleware/auth.js#L17) correctly reads `decoded.userId || decoded.id`. The new `authMiddleware.js` does not. Any route using the new middleware (currently `userRoutes.js` and `messageRoutes.js`) will **always return 401**.

---

### Finding 3 — 🔴 Message Schema Mismatch (Messages Never Save)

[messageModel.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/models/messageModel.js) defines fields `sender_id` (required) and `message` (required).

But [sendMessage](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/controllers/messageController.js#L64-L67) creates documents with `user_id` and `content`:
```js
const message = new Message({
  circle_id: circleId,
  user_id: userId,    // ← should be sender_id
  content: content    // ← should be message
});
```

This will throw a Mongoose `ValidationError` because `sender_id` and `message` are both `required: true` and missing.

---

### Finding 4 — 🔴 Dual Auth Middleware (Inconsistent `req.user`)

Two middleware files export `protect`:

| File | `req.user` shape | Used by |
|------|------------------|---------|
| [auth.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/middleware/auth.js) | `{ id: userId, userId }` | communityRoutes, circleRoutes, engagementRoutes, recommendationRoutes |
| [authMiddleware.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/middleware/authMiddleware.js) | Full Mongoose document | userRoutes, messageRoutes |

Controllers use `getUserIdFromReq` which checks `req.user.id` — this works with `auth.js` but is inconsistent with `authMiddleware.js` (which provides `req.user._id` via the Mongoose doc).

---

### Finding 5 — 🟠 `buildEventPayload` Silently Returns Null

[buildEventPayload](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/engagementLogService.js#L20) checks `req.user._id`. But for routes protected by `auth.js`, `req.user = { id, userId }` — there is no `_id`. Result: all logging calls silently skip.

---

### Finding 6 — 🟠 Engagement Events Endpoint: IDOR Vulnerability

[getEvents](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/controllers/engagementController.js#L5-L39) accepts any `user_id` as a query parameter. Any authenticated user can pass `?user_id=<victim_id>` to view another student's behavioral patterns. This is a direct **Insecure Direct Object Reference (IDOR)**.

---

### Finding 7 — 🟠 Socket `join_circle` Has No Membership Check

[socket/index.js L49-64](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/socket/index.js#L49-L64): Any authenticated user can join any circle's Socket.IO room and receive all real-time messages, even for circles they don't belong to.

---

### Finding 8 — 🟠 `sendMessage` Missing Circle Membership Authorization

[sendMessage](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/controllers/messageController.js#L55-L79) does not verify the sender is a member of the target circle. Compare with `getCircleMessages` which correctly checks membership at L30-36.

---

### Finding 10 — 🟠 Three Competing Logging Services

| Service | Module System | Schema Fields Used | Called By |
|---------|--------------|-------------------|-----------|
| [engagementService.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/engagementService.js) | ESM | Top-level `community_id`, `circle_id`, `metadata` (stale) | Socket layer, recommendationController |
| [engagementLogService.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/engagementLogService.js) | CJS | `context: { community_id, circle_id }` (correct) | Controllers |
| [telemetryService.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/telemetryService.js) | CJS | Top-level `context` (partially correct) | Unused |

`engagementService.js` logs event types `session_end` and `recommendation_viewed` which are **not in the schema enum** → every call throws a silent validation error.

---

### Finding 14 — 🟡 Aggregation Pipeline Bug

[circleMatchingService.js L21](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/circleMatchingService.js#L21):
```js
{ $match: { currentMemberCount: { $lt: "$capacity" } } }
```
In a `$match` stage, `"$capacity"` is treated as a **literal string**, not a field reference. This filter compares a number to a string and will match nothing. The correct approach:
```js
{ $match: { $expr: { $lt: ["$currentMemberCount", "$capacity"] } } }
```

---

## PASSED CHECKS ✅

- **Password hashing:** bcrypt with 10 salt rounds in [authController.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/controllers/authController.js#L30) and pre-save hook in [userModel.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/models/userModel.js#L72). Password field uses `select: false`.
- **No NoSQL injection vectors:** All queries use Mongoose parameterized APIs; no `$where` or `eval` usage found.
- **Engagement logging is fail-silent:** [engagementLogService.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/engagementLogService.js) wraps everything in try/catch, never throws downstream.
- **No message content in engagement logs:** `logEngagementEvent` and `buildEventPayload` never receive or pass `content`/`message`/`text` fields. Confirmed across all calling sites.
- **`getCommunityById` does not log 404s:** The logging call is placed after the null check, so non-existent communities are not logged. ✅
- **MongoDB indexes exist** on critical fields: `user_id` in EngagementEvent, `circle_id` in Message (compound with `createdAt`), `community_id` in Circle, `email` (unique) in User.
- **Global error handler exists:** [errorMiddleware.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/middleware/errorMiddleware.js) catches CastError, duplicate key, ValidationError, and JWT errors. Stack traces hidden in production.
- **Input validation with Zod** on auth routes via [validationMiddleware.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/middleware/validationMiddleware.js).
- **Socket.IO authentication** via [socketAuth.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/middleware/socketAuth.js) — JWT verified before connection.
- **DB connection failure exits process** with code 1 in [db.js](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/config/db.js#L68).
- **`$addToSet` used** in [circleMatchingService.js L69](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/services/circleMatchingService.js#L69) to prevent duplicate members.
- **`updateMe` uses allowlist** for updatable fields in [userController.js L76](file:///c:/Users/MAHARSHI/Downloads/SPARK/src/controllers/userController.js#L76-L80) — prevents mass assignment.

---

## NEXT ACTIONS (Prioritized)

| Priority | Action | Files |
|----------|--------|-------|
| **P0** | Convert 5 CommonJS files to ESM (or remove `"type": "module"` — but ESM is the majority) | `circleMatchingService.js`, `authMiddleware.js`, `engagementLogService.js`, `engagementEventModel.js`, `telemetryService.js` |
| **P0** | Fix JWT claim mismatch: `decoded.id` → `decoded.userId` in authMiddleware | `authMiddleware.js` |
| **P0** | Fix sendMessage schema fields: `user_id` → `sender_id`, `content` → `message` | `messageController.js` |
| **P0** | Consolidate dual auth middleware into one file; update all imports | `auth.js`, `authMiddleware.js`, all route files |
| **P1** | Fix `buildEventPayload` to check `req.user._id || req.user.id` | `engagementLogService.js` |
| **P1** | Add circle membership check to `sendMessage` | `messageController.js` |
| **P1** | Add membership validation to socket `join_circle` | `socket/index.js` |
| **P1** | Fix IDOR in `getEvents` — enforce `user_id = req.user.id` | `engagementController.js` |
| **P1** | Consolidate 3 logging services into one; update enum if needed | `engagementService.js`, `engagementLogService.js`, `telemetryService.js` |
| **P1** | Fix aggregation pipeline `$match` to use `$expr` | `circleMatchingService.js` |
| **P2** | Fix `engagementController` query paths (`context.community_id`) | `engagementController.js` |
| **P2** | Add rate limiting to auth endpoints | `index.js` or `authRoutes.js` |
| **P2** | Add `helmet()` and JSON body size limit | `index.js` |
| **P2** | Make CORS origin configurable via env var | `index.js` |
| **P3** | Add graceful shutdown (SIGTERM/SIGINT) | `index.js` |
| **P3** | Add pre-save capacity validator to Circle schema | `circleModel.js` |

---

## FINAL VERDICT

> **🔴 NOT READY FOR PRODUCTION**
>
> The server **will not start** due to the ESM/CJS conflict. Even if patched, the JWT mismatch will cause **universal 401s** on routes using `authMiddleware.js`, and the message endpoint will **fail every save** due to schema field mismatches. Three critical, server-breaking bugs must be resolved before any deployment. After those fixes, the HIGH-severity auth/IDOR issues must be addressed before exposing the API to any student traffic.

---

AUDIT COMPLETE – AWAITING USER ACTION.
