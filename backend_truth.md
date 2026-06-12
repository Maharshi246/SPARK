# SPARK Backend Truth Audit

This document establishes the verified source of truth for the SPARK Express + Socket.io backend codebase. It details the exact behaviors, schemas, route signatures, and events of the backend to ensure absolute alignment for any frontend development.

---

## 1. Authentication Truth

### JWT Flow
- **Token Generation**: Generated on successful registration (`POST /api/auth/register`) or login (`POST /api/auth/login`) via `jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })`.
- **Transmission**: Returned directly in the JSON response body under the root key `token`.
- **Storage**: Must be stored client-side (e.g., in LocalStorage, SessionStorage, or client memory) and sent in subsequent requests.
- **REST Header Usage**: Sent in the standard `Authorization` header as a Bearer token:
  ```http
  Authorization: Bearer <your_jwt_token>
  ```
- **Socket Handshake**: Can be provided in two ways:
  1. Handshake header: `Authorization` with value `Bearer <token>`
  2. Handshake auth object: `token` field with the raw token string value.

### Cookie Flow
- **Verdict**: **None**.
- There is no cookie-parsing middleware configured in the Express backend, nor does the backend set or read any HTTP cookies (`res.cookie` is not used). Authentication is purely header-based.

### Protected Route Mechanism
- **REST APIs**: Handled by the `protect` middleware (defined in `src/middleware/auth.js`) or its backward-compatible alias `auth`/`authMiddleware` (defined in `src/middleware/authMiddleware.js`).
  - Decodes token using `process.env.JWT_SECRET`.
  - Verifies the payload contains `userId` or `id`.
  - Attaches `{ id: userId, userId }` to `req.user`.
  - Rejects with `401 Unauthorized` / `No token provided` / `Invalid token` if authorization is missing or fails verification.
- **WebSockets**: Handled by the `socketAuth` middleware (defined in `src/middleware/socketAuth.js`).
  - Extracts token using `extractToken(socket)` (looks at `socket.handshake.headers.authorization` or `socket.handshake.auth.token`).
  - Decodes token using `process.env.JWT_SECRET`.
  - Saves the string user ID on `socket.data.userId`.
  - Rejects the socket connection with an `Unauthorized` error if verification fails.

---

## 2. Users & Profiles Truth

### Database Schema vs. REST API Response Shape
There is a critical discrepancy between what is stored in the MongoDB `User` model and what is returned by the profile endpoints.

#### A. Database Fields (`User` Model)
*Collection Name: `users`*
- `_id` (`ObjectId`, automatically created)
- `display_name` (`String`, required, trimmed)
- `email` (`String`, required, unique, lowercase, trimmed)
- `password` (`String`, required, excluded from default queries with `select: false`)
- `stage` (`String`, default: `'seeker'`, trimmed)
- `interests` (`Array of Strings`, default: `[]`)
- `depth_level` (`String`, enum: `['surface', 'intermediate', 'deep']`, default: `'surface'`)
- `discussion_style` (`String`, enum: `['debate', 'explore', 'learn']`, default: `'explore'`)
- `availability` (`Array of Strings`, default: `[]`)
- `memberships` (`Array of subdocuments`, default: `[]`):
  - `community_id` (`ObjectId`, ref: `'Community'`, required: true)
  - `circle_id` (`ObjectId`, ref: `'Circle'`, required: true)
  - `joined_at` (`Date`, default: `Date.now`)
- `current_stage` (`String`, enum: `['stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5']`, default: `'stage_1'`)
- `created_at` (`Date`, automatically added on creation; note: `updatedAt` is disabled)

#### B. API Response Field Exposure (`safeUserSelect`)
Profile endpoints (`GET /api/users/me`, `PUT /api/users/me`, `GET /api/users`) filter user fields using:
```javascript
const safeUserSelect = 'display_name email stage interests depth_level discussion_style availability created_at';
```
> [!WARNING]
> **Key Omissions**: The profile responses **do NOT** contain `current_stage` or `memberships`.
> - To fetch the user's progression stage (`current_stage`), you **must** call the progress endpoint (`GET /api/users/progress`).
> - To fetch the user's community and circle memberships (`memberships`), you **must** call the community memberships endpoint (`GET /api/communities/my-communities`).

#### C. Profile Update Constraints
When performing `PUT /api/users/me` (or `PUT /api/users/profile`), the backend strictly enforces a whitelist of updateable fields:
- **Allowed Fields**: `interests`, `depth_level`, `discussion_style`, `availability`.
- **Ignored/Forbidden Fields**: `display_name`, `email`, `stage`, `current_stage`, `memberships`. Attempts to update these fields through the profile update endpoint will be silently ignored.

---

## 3. Communities & Circles Truth

The community architecture operates on a system-managed model with dynamic user assignment to "Circles" (discussion/chat cohorts) of a limited capacity.

### Core Logic & Flow
1. **Communities** are predefined subject areas (e.g. `'Cyber Security'`, `'Artificial Intelligence'`, `'Literature'`). They are populated in the database with `is_active: true`.
2. When a user requests to **join** a community (`POST /api/communities/:id/join`):
   - The backend searches for an active `Circle` linked to that community that has available capacity (`members.length < capacity`, default capacity is **8**).
   - If a circle with space is found, the user is appended to the circle's `members` array.
   - If no circle is found (or all are full), the backend dynamically **creates a new Circle** for the community with `capacity: 8` and adds the user as the first member.
   - The user's profile is updated by pushing the `{ community_id, circle_id, joined_at }` object into their `memberships` array.
3. When a user requests to **leave** a community (`POST /api/communities/:id/leave`):
   - The user is removed from the associated circle's `members` array.
   - The membership subdocument matching the community ID is removed from the user's `memberships` array.

### Available REST Endpoints
- `GET /api/communities`: Returns all active communities.
- `GET /api/communities/my-communities`: Returns a list of communities the user has joined, with fully populated community and circle objects.
- `POST /api/communities/:id/join`: Join a community and assigns a circle.
- `POST /api/communities/:id/leave`: Leaves a community and associated circle.

### Missing REST Endpoints
- No route to fetch details for a single community (`GET /api/communities/:id`).
- No route to retrieve circles within a community (only handled automatically via the join endpoint).
- No route to retrieve the member list for a circle outside of the populated `my-communities` list.
- No administrative route to create, edit, or disable communities/circles via HTTP (managed via DB migrations/direct access).

---

## 4. Chat & Room Architecture

Chat occurs in near real-time using Socket.io. Messages are persistently stored in MongoDB.

### Room Architecture
- A Socket.io "Room" is established for every active circle.
- Room naming convention: `circle_<circle_id>` (e.g. `"circle_64d262b9a7c36940a049d5bf"`).
- Clients subscribe to a room by emitting `join_circle` and unsubscribe by emitting `leave_circle`.

### Socket Event Specifications

#### A. Client-to-Server Events (In-bound)

##### 1. `join_circle`
- **Description**: Subscribes the client's socket to the specified circle's room.
- **Payload**:
  ```json
  {
    "circleId": "string (ObjectId)"
  }
  ```
- **Acknowledgment (optional)**:
  - On Success: `{ "success": true, "room": "circle_<circleId>" }`
  - On Error: `{ "success": false, "message": "Invalid circleId" }` or `{ "success": false, "message": "Failed to join circle" }`

##### 2. `leave_circle`
- **Description**: Unsubscribes the client's socket from the specified circle's room.
- **Payload**:
  ```json
  {
    "circleId": "string (ObjectId)"
  }
  ```
- **Acknowledgment (optional)**:
  - On Success: `{ "success": true, "room": "circle_<circleId>" }`
  - On Error: `{ "success": false, "message": "Invalid circleId" }` or `{ "success": false, "message": "Failed to leave circle" }`

##### 3. `typing_start`
- **Description**: Signals that the user has started typing in a circle chat.
- **Payload**:
  ```json
  {
    "circleId": "string (ObjectId)"
  }
  ```

##### 4. `typing_stop`
- **Description**: Signals that the user has stopped typing in a circle chat.
- **Payload**:
  ```json
  {
    "circleId": "string (ObjectId)"
  }
  ```

##### 5. `send_message`
- **Description**: Sends a message to the circle. The server creates a `Message` document and broadcasts it.
- **Payload**:
  ```json
  {
    "circleId": "string (ObjectId)",
    "message": "string (1 to 5000 characters)"
  }
  ```
- **Acknowledgment (optional)**:
  - On Success:
    ```json
    {
      "success": true,
      "data": {
        "message": "string",
        "senderId": "string (ObjectId)",
        "senderName": "string",
        "timestamp": "ISO Date String"
      }
    }
    ```
  - On Error: `{ "success": false, "message": "Message is required" }` or `{ "success": false, "message": "Failed to send message" }`

#### B. Server-to-Client Events (Out-bound Broadcasts)

##### 1. `send_message`
- **Broadcasted to**: All users in the circle room (including the sender).
- **Payload**:
  ```json
  {
    "message": "string",
    "senderId": "string (ObjectId)",
    "senderName": "string",
    "timestamp": "ISO Date String"
  }
  ```

##### 2. `typing_start`
- **Broadcasted to**: All users in the circle room *except* the sender.
- **Payload**:
  ```json
  {
    "circleId": "string (ObjectId)",
    "senderId": "string (ObjectId)"
  }
  ```

##### 3. `typing_stop`
- **Broadcasted to**: All users in the circle room *except* the sender.
- **Payload**:
  ```json
  {
    "circleId": "string (ObjectId)",
    "senderId": "string (ObjectId)"
  }
  ```

---

## 5. User Engagement & Progression Truth

Progress is calculated based on "Engagement Events" logged dynamically when the user takes action (sessions started and messages sent).

### Progression Rules Config
Located in `src/config/progressionRules.js`. Progression criteria are defined by two key metrics:
1. `minMessages`: The minimum number of messages the user must send in total.
2. `minSessions`: The minimum number of connection sessions.

| Transition Rule | Target Stage | Minimum Messages | Minimum Sessions | Status |
| :--- | :--- | :--- | :--- | :--- |
| `stage_1_to_2` | `stage_2` | 50 | 5 | Enabled |
| `stage_2_to_3` | `stage_3` | 150 | 15 | Enabled |
| `stage_3_to_4` | `stage_4` | 300 | 30 | Enabled |
| `stage_4_to_5` | `stage_5` | 500 | 50 | Enabled |

### Calculation Logic
- The progression service fetches the user's `current_stage` (default is `'stage_1'`).
- The count of `message_sent` events and `session_start` events corresponding to the user are queried from `engagement_events`.
- Progress percentage is determined by taking the average of the message requirement progress and session requirement progress:
  ```javascript
  const msgProgress = Math.min((messagesCount / rule.minMessages) * 100, 100);
  const sessionProgress = Math.min((sessionsCount / rule.minSessions) * 100, 100);
  const overallProgress = Math.floor((msgProgress + sessionProgress) / 2);
  ```
- **Promotion eligibility**: An user becomes eligible for promotion once `progressPercentage >= 100`.

### Exact Response Shape (`GET /api/users/progress`)

#### Scenario A: User is in `stage_1` to `stage_4`
```json
{
  "success": true,
  "data": {
    "currentStage": "stage_1",
    "progressPercentage": 45,
    "requirements": {
      "nextStage": "stage_2",
      "metrics": {
        "messages": {
          "current": 18,
          "required": 50
        },
        "sessions": {
          "current": 4,
          "required": 5
        }
      }
    }
  }
}
```

#### Scenario B: User is in `stage_5` (Maximum Stage)
```json
{
  "success": true,
  "data": {
    "currentStage": "stage_5",
    "progressPercentage": 100,
    "requirements": {
      "nextStage": null,
      "status": "maxed"
    }
  }
}
```

#### Scenario C: Progression Rules are Disabled/Missing
```json
{
  "success": true,
  "data": {
    "currentStage": "stage_some",
    "progressPercentage": 0,
    "requirements": {
      "nextStage": null,
      "status": "disabled"
    }
  }
}
```

---

## 6. Complete REST Endpoint Reference

Below is the exhaustive catalog of all available REST endpoints. All request and response bodies use application/json.

### A. Auth Modules

#### 1. Register User
- **Method**: `POST`
- **Route**: `/api/auth/register`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "display_name": "John Doe",
    "email": "john.doe@example.com",
    "password": "securepassword123"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "64d262b9a7c36940a049d5b0",
      "display_name": "John Doe",
      "email": "john.doe@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Error Response (400 Bad Request - Missing Fields)**:
  ```json
  {
    "success": false,
    "message": "display_name, email, and password are required"
  }
  ```
- **Error Response (400 Bad Request - Email Taken)**:
  ```json
  {
    "success": false,
    "message": "Email already in use"
  }
  ```

#### 2. Login User
- **Method**: `POST`
- **Route**: `/api/auth/login`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "john.doe@example.com",
    "password": "securepassword123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "64d262b9a7c36940a049d5b0",
      "display_name": "John Doe",
      "email": "john.doe@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Error Response (400 Bad Request)**:
  ```json
  {
    "success": false,
    "message": "Email and password are required"
  }
  ```
- **Error Response (401 Unauthorized)**:
  ```json
  {
    "success": false,
    "message": "Invalid credentials"
  }
  ```

---

### B. User Modules

#### 1. List Users
- **Method**: `GET`
- **Route**: `/api/users`
- **Auth Required**: No
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "64d262b9a7c36940a049d5b0",
        "display_name": "John Doe",
        "email": "john.doe@example.com",
        "stage": "seeker",
        "interests": ["tech", "philosophy"],
        "depth_level": "surface",
        "discussion_style": "explore",
        "availability": ["weekends"],
        "created_at": "2026-06-09T04:17:13.000Z"
      }
    ]
  }
  ```

#### 2. Create User (Legacy Setup Route)
- **Method**: `POST`
- **Route**: `/api/users`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "display_name": "John Doe",
    "email": "john.doe@example.com",
    "password": "securepassword123",
    "stage": "seeker"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "64d262b9a7c36940a049d5b0",
      "display_name": "John Doe",
      "email": "john.doe@example.com",
      "stage": "seeker",
      "created_at": "2026-06-09T04:17:13.000Z"
    }
  }
  ```

#### 3. Get Current User Profile
- **Method**: `GET`
- **Route**: `/api/users/me` (or `/api/users/profile`)
- **Auth Required**: Yes
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "64d262b9a7c36940a049d5b0",
      "display_name": "John Doe",
      "email": "john.doe@example.com",
      "stage": "seeker",
      "interests": ["tech", "philosophy"],
      "depth_level": "surface",
      "discussion_style": "explore",
      "availability": ["weekends"],
      "created_at": "2026-06-09T04:17:13.000Z"
    }
  }
  ```

#### 4. Update Current User Profile
- **Method**: `PUT`
- **Route**: `/api/users/me` (or `/api/users/profile`)
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "interests": ["coding", "science"],
    "depth_level": "intermediate",
    "discussion_style": "learn",
    "availability": ["weekdays"]
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "64d262b9a7c36940a049d5b0",
      "display_name": "John Doe",
      "email": "john.doe@example.com",
      "stage": "seeker",
      "interests": ["coding", "science"],
      "depth_level": "intermediate",
      "discussion_style": "learn",
      "availability": ["weekdays"],
      "created_at": "2026-06-09T04:17:13.000Z"
    }
  }
  ```

#### 5. Get User Progress & Stage Status
- **Method**: `GET`
- **Route**: `/api/users/progress`
- **Auth Required**: Yes
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "currentStage": "stage_1",
      "progressPercentage": 45,
      "requirements": {
        "nextStage": "stage_2",
        "metrics": {
          "messages": {
            "current": 18,
            "required": 50
          },
          "sessions": {
            "current": 4,
            "required": 5
          }
        }
      }
    }
  }
  ```

---

### C. Community Modules

#### 1. List Active Communities
- **Method**: `GET`
- **Route**: `/api/communities`
- **Auth Required**: Yes
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "64d262b9a7c36940a049d5c0",
        "name": "Artificial Intelligence",
        "description": "System managed community for Artificial Intelligence",
        "is_active": true,
        "created_at": "2026-06-09T04:17:13.000Z",
        "updated_at": "2026-06-09T04:17:13.000Z"
      }
    ]
  }
  ```

#### 2. Get Joined Communities (with Circle memberships)
- **Method**: `GET`
- **Route**: `/api/communities/my-communities`
- **Auth Required**: Yes
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "community_id": {
          "_id": "64d262b9a7c36940a049d5c0",
          "name": "Artificial Intelligence",
          "description": "System managed community for Artificial Intelligence",
          "is_active": true,
          "created_at": "2026-06-09T04:17:13.000Z",
          "updated_at": "2026-06-09T04:17:13.000Z"
        },
        "circle_id": {
          "_id": "64d262b9a7c36940a049d5d5",
          "community_id": "64d262b9a7c36940a049d5c0",
          "members": [
            "64d262b9a7c36940a049d5b0"
          ],
          "capacity": 8,
          "is_active": true,
          "created_at": "2026-06-09T04:18:00.000Z",
          "updated_at": "2026-06-09T04:18:00.000Z"
        },
        "joined_at": "2026-06-09T04:18:00.000Z",
        "_id": "64d262b9a7c36940a049d5ff"
      }
    ]
  }
  ```

#### 3. Join Community
- **Method**: `POST`
- **Route**: `/api/communities/:id/join`
- **Auth Required**: Yes
- **URL Params**: `:id` (Community ID string)
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Successfully joined community and assigned to circle",
    "data": {
      "community_id": "64d262b9a7c36940a049d5c0",
      "circle_id": "64d262b9a7c36940a049d5d5"
    }
  }
  ```
- **Error Response (400 Bad Request - Already Joined)**:
  ```json
  {
    "success": false,
    "message": "Already a member of this community"
  }
  ```
- **Error Response (404 Not Found - Inactive or Invalid Community)**:
  ```json
  {
    "success": false,
    "message": "Community not found or inactive"
  }
  ```

#### 4. Leave Community
- **Method**: `POST`
- **Route**: `/api/communities/:id/leave`
- **Auth Required**: Yes
- **URL Params**: `:id` (Community ID string)
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Successfully left community and associated circle"
  }
  ```
- **Error Response (400 Bad Request - Not a Member)**:
  ```json
  {
    "success": false,
    "message": "Not a member of this community"
  }
  ```

---

### D. Circle Modules

#### 1. Get Circle Messages
- **Method**: `GET`
- **Route**: `/api/circles/:circleId/messages`
- **Auth Required**: Yes
- **URL Params**: `:circleId` (Circle ID string)
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "64d262b9a7c36940a049d5e3",
        "circle_id": "64d262b9a7c36940a049d5d5",
        "sender_id": "64d262b9a7c36940a049d5b0",
        "message": "Hello class! Welcome to the Artificial Intelligence discussion.",
        "createdAt": "2026-06-09T04:18:30.000Z"
      }
    ]
  }
  ```
- **Error Response (400 Bad Request - Invalid ID)**:
  ```json
  {
    "success": false,
    "message": "Invalid circleId"
  }
  ```
- **Error Response (403 Forbidden - Access Denied)**:
  ```json
  {
    "success": false,
    "message": "Access denied: You are not a member of this circle"
  }
  ```

---

### E. Engagement Modules

#### 1. Query Engagement Events (Administrative/Analytic Querying)
- **Method**: `GET`
- **Route**: `/api/engagement/events`
- **Auth Required**: Yes
- **Query Parameters**:
  - `user_id` (`string`, optional): Filter by user
  - `community_id` (`string`, optional): Filter by community
  - `circle_id` (`string`, optional): Filter by circle
  - `event_type` (`string`, optional): Filter by event type (`session_start` | `session_end` | `message_sent`)
  - `startDate` (`string` in ISO format, optional): Filter events on or after this timestamp
  - `endDate` (`string` in ISO format, optional): Filter events on or before this timestamp
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "64d262b9a7c36940a049d5fa",
        "user_id": "64d262b9a7c36940a049d5b0",
        "community_id": "64d262b9a7c36940a049d5c0",
        "circle_id": "64d262b9a7c36940a049d5d5",
        "event_type": "message_sent",
        "metadata": {
          "messageLength": 60
        },
        "created_at": "2026-06-09T04:18:30.000Z"
      }
    ]
  }
  ```
