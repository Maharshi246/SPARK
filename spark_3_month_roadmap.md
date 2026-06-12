# SPARK: 3-Month Strategic Roadmap

## The Current State: What We Have Done (The Foundation)
You have successfully built the **plumbing**. The MVP infrastructure is solid and ready to support the intelligence layer.

**Completed Infrastructure:**
1. **Frontend Foundation:** Next.js App Router, Tailwind CSS, Modern Codex design system, strict route protection.
2. **Backend Foundation:** Node/Express API, MongoDB schemas (Users, Communities, Circles, Messages, Engagement Events).
3. **Real-time Engine:** Fully functional Socket.IO architecture with room isolation and message persistence.
4. **Data Collection Engine:** The 5-question onboarding flow that captures raw data (interests, depth, style, availability).
5. **Placeholder Systems:** Basic auto-matching into circles, counter-based progression, and a flat list of communities.

*Crucially, the frontend is decoupled from the backend logic, meaning when the ML models are ready, the UI won't need a massive rewrite.*

---

## The Destination: What is Remaining (The Moat)
The next 3 months are about replacing the "dumb" placeholders with "intelligent" systems, and adding the missing product loops.

1. **The Intelligence Layer (ML)**
   - Curiosity Fingerprint generation (Vector embeddings).
   - Community Recommendation Engine.
   - Intelligent Circle Matching Engine (Grouping 8 highly compatible users).
   - Progression Engine V2 (Scoring discussion quality, peer behavior, and event participation).
2. **The Events System (Backend + Frontend)**
   - Creating an `Event` model tied to communities.
   - UI for users to view/understand upcoming events.
3. **The Admin Panel (Backend + Frontend)**
   - Dashboard to track student progress.
   - Tools to create/edit/deactivate Communities and Events.
4. **Telemetry & Data Pipeline (Backend + ML)**
   - Feeding the `engagement_events` and raw chat data securely to the ML models for analysis.

---

## The 3-Month Execution Plan

### Month 1: The Events System, Admin MVP, and ML Data Pipelines
*Goal: Give the Frontend and Backend new feature work (Events & Admin) while the ML engineer builds the foundation of the intelligence layer.*

**Backend (You):**
- **Week 1-2:** Build the `Event` schema, controllers, and routes (CRUD operations). Link events to `community_id`.
- **Week 3-4:** Build the Admin API endpoints. Create an `/api/admin` namespace to fetch platform-wide stats, user progress, and manage communities. Ensure secure Admin role middleware.

**Frontend:**
- **Week 1-2:** Build the "Events" UI inside the Community/Circle view. Ensure it matches the Codex design system.
- **Week 3-4:** Build a hidden `/admin` portal. Create tables to view users, their current progression, and a form to add new Communities/Events.

**ML:**
- **Week 1-2:** Data engineering. Set up a secure pipeline to pull anonymized chat logs, engagement events, and user onboarding data from MongoDB to the Python/FastAPI environment.
- **Week 3-4:** Develop the **Curiosity Fingerprint model**. Translate raw text (`interests`, `availability`) and categories (`depth`, `style`) into vector embeddings.

### Month 2: The Matching Engine & Recommendation Integration
*Goal: Replace placeholder matching logic with the ML matching engine.*

**Backend (You):**
- **Week 5-6:** Build internal microservice communication. When a user joins, the Node.js backend must call the ML FastAPI service: `POST /match { fingerprint_vector }` to get the best `circle_id` back.
- **Week 7-8:** Update `GET /api/communities` to call the ML service to return *Recommended* communities sorted by relevance, rather than a random list.

**Frontend:**
- **Week 5-6:** Refine the Dashboard UI to handle slight delays in matching (e.g., showing a polished "Analyzing Fingerprint & Finding Cohort" loading state).
- **Week 7-8:** QA the new flow. The UI shouldn't change much, but the user experience will feel personalized.

**ML:**
- **Week 5-6:** Build the **Circle Matching Algorithm**. Given a user's fingerprint, find an active circle with < 8 people that maximizes intellectual compatibility.
- **Week 7-8:** Build the **Community Recommendation Algorithm**. Expose these as FastAPI endpoints for the Node backend to consume.

### Month 3: The AI Progression Engine & Launch Prep
*Goal: Replace message-counting with true semantic quality scoring.*

**Backend (You):**
- **Week 9-10:** Update the `progressionService.js`. Instead of counting DB rows, query the ML service: `GET /score/{userId}`. 
- **Week 11-12:** Load testing, security audits, tightening rate limits, and optimizing MongoDB indexes.

**Frontend:**
- **Week 9-10:** Build the final UI for Progression/Growth. Since it's no longer just a progress bar, maybe it's a "Scholastic Report" showing semantic growth, peer recognition, and event participation.
- **Week 11-12:** Final bug bashing, cross-browser testing, and polish.

**ML:**
- **Week 9-10:** Build the **Progression Scoring Model**. Use NLP to evaluate chat history for depth, debate quality, and helpfulness. Output a 0-100 score for stage promotion.
- **Week 11-12:** Fine-tuning the models based on test data. Containerizing the FastAPI service (Docker) for production deployment.

---

## 💡 Startup Founder Advice for this Phase

1. **Don't Let the ML Block the App:** 
   - ML takes time. Your Node backend should always have a fallback. If the ML FastAPI service is down or slow, the Node backend should gracefully fall back to the V1 "dumb" logic (auto-assign to first available circle) so the app doesn't break.
2. **Privacy & Trust is Your Brand:** 
   - You are analyzing deep intellectual conversations. Ensure your ML guy strips PII (Personally Identifiable Information) before analyzing text.
3. **The "Empty Room" Problem:** 
   - A matching algorithm is useless with 0 users. On launch day, you won't have enough users to make perfect matches. The ML algorithm must prioritize *activity* over *perfect compatibility* in the early days. A circle of 8 slightly mismatched active people is better than a circle of 2 perfectly matched people who never talk.
