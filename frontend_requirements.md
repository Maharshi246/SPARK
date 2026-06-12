# SPARK Student Network: Frontend Requirements Specification

## 1. Executive Summary
This document serves as the master blueprint for the SPARK Student Network frontend. It maps the fully functional Node.js/Express backend to a highly dynamic, Gen Z-focused Next.js web application. SPARK solves "intellectual loneliness" by connecting students based on behavioral engagement and shared intellectual curiosity. The UI must feel **premium, alive, and effortless**—utilizing glassmorphism, dynamic micro-animations, vibrant gradients, dark mode by default, and fluid page transitions.

## 2. Backend API Reference

| Method | Endpoint | Auth Req? | Request Payload | Response Data Shape | Frontend Usage |
|--------|----------|-----------|-----------------|---------------------|----------------|
| `POST` | `/api/auth/register` | No | `{ display_name, email, password }` | `{ success, data: { id, display_name, email }, token }` | Registration Page |
| `POST` | `/api/auth/login` | No | `{ email, password }` | `{ success, data, token }` | Login Page |
| `GET` | `/api/users/me` | Yes | None | `{ success, data: UserObject }` | Profile / Dashboard |
| `PUT` | `/api/users/me` | Yes | `{ interests, depth_level, ... }` | `{ success, data: UserObject }` | Onboarding / Edit Profile |
| `GET` | `/api/users/progress`| Yes | None | `{ success, data: { stage, ...} }` | Gamification UI |
| `GET` | `/api/recommendations`| Yes | None | `{ success, data: [CommunityObject] }` | Discovery/Dashboard |
| `GET` | `/api/communities/:id`| Yes | None | `{ success, data: CommunityObject }` | Community Detail Page |
| `POST` | `/api/communities/:id/join`| Yes | None | `{ success, data: { community_id, circle_id } }` | "Join" button in Community |
| `GET` | `/api/messages/circle/:id`| Yes | None | `{ success, data: [MessageObject] }` | Chat Room load history |
| `POST` | `/api/messages` | Yes | `{ circleId, content }` | `{ success, data: MessageObject }` | Chat Room Send Message |
| `GET` | `/api/engagement/events`| Yes | None (QueryParams: `event_type`, dates) | `{ success, data: [EventObject] }` | Activity / History Page |

## 3. Socket.IO Events Reference

The real-time layer powers the SPARK chat experience.

**Client → Server (Emits):**
- `join_circle`: Payload `{ circleId }`. Sent immediately when the chat page mounts. Returns an acknowledgment callback.
- `leave_circle`: Payload `{ circleId }`. Sent on unmount.
- `typing_start`: Payload `{ circleId }`. Sent when user focuses/types in input.
- `typing_stop`: Payload `{ circleId }`. Sent on blur or 2s timeout.
- `send_message`: Payload `{ circleId, message }`. Sent when hitting Enter.

**Server → Client (Listens):**
- `send_message`: Payload `{ message, senderId, senderName, timestamp }`. Append to chat list.
- `typing_start`: Payload `{ circleId, senderId }`. Show animated typing bubble.
- `typing_stop`: Payload `{ circleId, senderId }`. Hide typing bubble.

## 4. Page-by-Page Specification (Next.js 14 App Router)

### A. Public Routes (Aesthetic: Neon gradients, 3D elements, hyper-smooth)
**`/` (Landing Page)**
- **Purpose**: Sell the vision. Gen Z vibe.
- **Interactions**: Scroll-triggered animations, CTA "Find Your Circle" → `/register`.

**`/login` & `/register`**
- **Purpose**: Authentication.
- **API**: POST `/api/auth/login` or `/api/auth/register`.
- **UI**: Glassmorphic card over an animated mesh gradient background. Smooth error shake animations.
- **State**: On success, store token in HTTP-only cookie or secure LocalStorage, redirect to `/dashboard`.

### B. Protected Routes (Aesthetic: Sleek dark mode, fast transitions)
**`/dashboard`**
- **Purpose**: Main hub.
- **API**: `GET /api/users/me`, `GET /api/recommendations`.
- **UI**: Horizontal scrolling carousels for recommended communities. Hovering over a card triggers a slight tilt (Framer Motion).

**`/communities/[id]`**
- **Purpose**: View community details and decide to join.
- **API**: `GET /api/communities/:id`
- **UI**: Immersive banner image, tag pills.
- **Interaction**: Giant glowing "Join Community" button (`POST /api/communities/:id/join`). On success, confetti pop and redirect to `/chat/[circle_id]`.

**`/chat/[circle_id]`**
- **Purpose**: The Circle. Real-time engagement. Max 8 people.
- **API**: `GET /api/messages/circle/:circleId` (on mount).
- **Socket**: `join_circle`, `send_message`, `typing_start`.
- **UI**:
  - Message bubbles: Sender on right, others on left. Smooth slide-up enter animations.
  - Typing indicator: iMessage-style bouncing dots.
  - Input area: Sticky at bottom, expanding textarea, frosted glass backdrop.

**`/profile`**
- **Purpose**: Manage identity and gamification progress.
- **API**: `GET /api/users/progress`, `PUT /api/users/me`.
- **UI**: Circular progress rings showing "Curiosity Fingerprint" stats.

## 5. UI Component Inventory

| Action | Component Type | Aesthetic/Animation | API / Socket Call |
|--------|----------------|---------------------|-------------------|
| Submit Auth | `<Button>` | Magnetic pull effect on hover, spinning loader | `POST /api/auth/login` |
| View Comm. | `<CommunityCard>` | 3D Tilt effect, glowing border on hover | Navigation to `/communities/[id]` |
| Join Comm. | `<JoinButton>` | Haptic feedback (visual pulse), confetti burst | `POST /api/communities/:id/join` |
| Send Msg | `<ChatInput>` | Expanding pill shape, glowing "send" arrow | Socket: `send_message` + HTTP POST |
| Typing... | `<TypingDots>` | 3 bouncing dots (staggered translateY) | Socket: `typing_start` |
| Progress | `<StatsRing>` | SVG stroke-dasharray animation on load | `GET /api/users/progress` |

## 6. Authentication & Routing Guard Rules

- **Middleware Guard**: Next.js `middleware.ts` should intercept requests to `/dashboard`, `/chat/*`, `/profile`, `/communities/*`.
- If no token exists, redirect instantly to `/login`.
- If a logged-in user hits `/login` or `/register`, redirect to `/dashboard`.

## 7. Real-Time Message Flow

1. User navigates to `/chat/123`.
2. Frontend fetches history: `GET /api/messages/circle/123`.
3. Frontend connects socket: `socket.emit('join_circle', { circleId: '123' })`.
4. User types: emit `typing_start`.
5. User hits Enter:
   - Play a subtle "pop" sound.
   - Optimistically render message in the UI with a "sending..." grayed-out state.
   - Emit `send_message` via socket AND `POST /api/messages`.
   - On server ack, turn message solid.
6. Partner types: Server emits `typing_start`. Show floating bubble above input.

## 8. Admin Panel Requirements (`/admin/*`)

- **Purpose**: Manage the network, view analytics.
- **UI**: Clean, data-dense sidebar layout.
- **Features**:
  - User Directory: Needs an endpoint to list all users.
  - Community Creator: Form to create new communities (name, description, tags).
  - Telemetry Dashboard: Data visualization of engagement events (Requires global endpoint).

## 9. Missing Backend Features (For Admin)

To fully implement the admin panel, the backend team must add:
1. `GET /api/admin/users` (with Admin Role Auth Middleware)
2. `POST /api/admin/communities` (to create communities)
3. `GET /api/admin/engagement` (global view of events, overriding the IDOR fix that scopes events to `req.user`)
4. A standard `role: 'admin'` or `role: 'user'` field on the `User` model.

## 10. Recommended Frontend Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS + `tailwind-merge` + `clsx`
- **Animations**: Framer Motion (essential for the Gen Z bouncy/fluid feel)
- **Real-time**: `socket.io-client`
- **Data Fetching/State**: React Query (`@tanstack/react-query`) for caching HTTP requests + Zustand for global UI state (like active theme or mobile menu).
- **Forms**: React Hook Form + Zod validation.
- **UI Base**: shadcn/ui (customized with high border-radius, dark themes, and neon accents).

FRONTEND SPEC COMPLETE – READY FOR IMPLEMENTATION.
