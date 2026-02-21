# Utah Valley Research Lab (StatsLabManager) — Comprehensive Project Report

**Repository:** [JoeWhiteJr/Utah-Valley-Research-Lab](https://github.com/JoeWhiteJr/Utah-Valley-Research-Lab)
**Status:** Public, Active
**Created:** February 4, 2026
**Report Date:** February 20, 2026
**Collaborators:** JoeWhiteJr (Admin, 147 commits), Jayrod-21 (Write, 55 commits)

---

## 1. Project Overview

**Stats Lab Research Project Manager** — A Notion-inspired web application for organizing research projects, tracking progress, managing files, and facilitating team collaboration for statistics labs.

**Live Domain:** `utahvalleyresearchlab.com` (EC2 instance at 3.13.75.86)

### Tech Stack
| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, React Router v6, React Quill, @dnd-kit |
| Backend | Node.js 18+, Express.js, Socket.io v4.8.3, JWT auth, Google Generative AI (Gemini 2.5 Flash), Anthropic Claude |
| Database | PostgreSQL 15 (32 migration files, 1,239 lines), full-text search |
| Infrastructure | Docker + Docker Compose, Nginx reverse proxy, Let's Encrypt SSL, GitHub Actions CI/CD, S3 backups |
| Testing | Vitest (frontend), Jest (backend) |

### Code Metrics
| Component | Lines of Code |
|-----------|--------------|
| Backend (src/) | 13,636 |
| Frontend (src/) | 22,490 |
| Database Migrations | 1,239 |
| **Total** | **~37,365** |

### Local Copies
Three local clones exist, all pointing to the same GitHub remote:
- `/home/joe/Utah-Valley-Research-Lab/` — primary development
- `/home/joe/stats-lab-manager/` — earlier working copy
- `/home/joe/uvrl/` — production deployment copy

---

## 2. Features Built (Chronological by PR)

### PR #1–#2 (Feb 5) — Foundation
- API functions and UI component scaffolding (PR #1 closed, PR #2 merged)

### PR #3 (Feb 5) — Admin, Chat, Notifications
- Admin panel with role-based access control (`AdminRoute` guard)
- Real-time chat with Socket.io client service & lifecycle management
- Public application form (`Apply` page)
- `NotificationBell` component with dropdown
- All tests passing

### PR #4 (Feb 5) — Public Website (Jayrod-21)
- 7 public pages: Home, About, Projects, Team, Blog, Contact, Donate
- Search modal, responsive design
- 45+ new tests (118 total passing)

### PR #5 (Feb 5) — Super Admin, Cover Upload, Chat Creation
- Super admin role exclusive to `10947671@uvu.edu` (controls admin changes/deletion)
- Cover image upload with `POST /projects/:id/cover` endpoint
- Admin-only project meta editing (leads can edit description only)
- "Create Chat" button with member selector modal
- Team management moved to Admin page
- 118/118 frontend tests passing

### PR #6 (Feb 6) — UI Cleanup (Jayrod-21)
- Removed keyboard shortcut hint from search
- Added "Back to Home" links on Login/Register pages

### PR #8 (Feb 6) — Uploads, Audio, Categories (Jayrod-21)
- Image header upload fix (backend base URL)
- Drag-and-drop file upload with progress bar + `FilePreviewModal`
- Date picker improvements (date-only, Confirm/Cancel/Clear)
- Meeting notes with `RichTextEditor` + `AudioPlayer` (0.5x–2x speed) + `AudioRecorder`
- Action item categories with CRUD API + `CategoryManager`
- Progress bar (completed/total tasks)
- Inactive project status (admin-only control)

### PR #9 (Feb 6) — Registration Approval & Soft Delete
- Registration creates pending application (super admin bypasses)
- Login shows "under review" message for pending users (403 + `PENDING_APPROVAL`)
- Admin approval flow with stored password hash
- Default approved role changed from `researcher` to `viewer`
- Soft delete users (`deleted_at` column) — deleted users see "Access Revoked" page
- Migrations: `004_application_password.sql`, `005_soft_delete_users.sql`
- 16/16 frontend auth tests updated and passing

### PR #10 (Feb 6) — Cover Image Preview (Jayrod-21)
- Modal preview of selected cover file before uploading (confirm/cancel)

### PR #11 (Feb 6) — Button Fix (Jayrod-21)
- Fixed "New Project" button invisible on Lab Dashboard hero
- Added `white` variant to Button component to avoid Tailwind class conflicts

### PR #12 (Feb 7) — Task System Overhaul
- **Multi-assignee**: New `action_item_assignees` junction table, multi-select UI
- **Subtasks**: Parent task support with cascade delete, drag-and-drop reordering
- **Progress bar**: Auto-calculated from `(completed / total) * 100`
- Migration: `006_task_improvements.sql` with backward-compatible data migration
- 32 backend tests covering all features

### PR #13 (Feb 7) — Uploads, AI Summaries, Inactive Status
- Image upload fix: Cover endpoint returns complete project shape with JOIN + cache-busting
- Audio recording fix: Proper MediaRecorder API, echo cancellation, noise suppression
- AI summary per project (Gemini): Summarize status, tasks, notes, meetings
- AI dashboard summary: Weekly task overview with stats
- Inactive status added to project statuses
- 97 backend tests pass (3 new for inactive)

### PR #14 (Feb 7) — AI Admin Dashboard
- "Generate AI Summary" button on Admin dashboard using Gemini AI
- Three sections: What Has Been Done / Currently Being Done / Still Needs To Be Done
- Date range filtering: This Week, This Month, All Time
- Color-coded sections (green/blue/amber) with loading states
- Backend: `POST /api/ai/admin-summary` endpoint
- 7 new backend tests (auth, role, validation, date ranges)

### PR #15 (Feb 7) — Chat Improvements & Calendar
- **Chat**: Message reactions (emoji), audio messages with recording, file sharing, emoji picker, browser push notifications
- **Calendar**: Full system with lab-wide + personal calendars, daily/weekly/monthly views, `ClockPicker`, drag-drop event moving, recurring events, project linking, attendee RSVP, deadline overlay
- Migrations: `006_chat.sql`, `007_calendar.sql`
- 12 calendar components, WebSocket push notifications

### PR #16 (Feb 7) — EC2 Deployment & OOM Fix
- EC2 deployment script added
- Fixed OOM (Out of Memory) during frontend build
- Updated `package-lock.json`

### Direct Commits (Feb 7–8) — Production Hardening
- **Tier 1**: Security hardening and UX fixes
- **Tier 2**: Core UX improvements
- **Tier 3**: Power features — activity streaks, chat room deletion, UI improvements
- **Tier 4**: Production hardening — Pino logging, input sanitization, password reset flow, S3 backup configuration
- Drag-to-create calendar events, event resize, clock picker bug fixes
- SSH-action upgrade to v1.2.0 for OpenSSH key compatibility

### PR #17 (Feb 9) — Dark Mode & Chat Sort (Jayrod-21)
- Calendar: dark mode for all 10 components (views, modal, filters, pickers, deadlines)
- Projects: dark mode for ProjectCard (backgrounds, borders, badges, progress bar)
- Chat: re-sort rooms list on new message

### PR #18 (Feb 9) — UI Improvements Batch (Jayrod-21)
- Remove command-K badge from search button
- Fix dark mode hover states on LabDashboard stats cards
- Filter completed tasks from My Dashboard, add "View Project" links
- Add Current/All/Completed filter tabs to project Action Items

### Direct Commits (Feb 9) — SSL/HTTPS Infrastructure
- `feat: add HTTPS/SSL support with Let's Encrypt`
- `fix: restore HTTP server block in nginx config`
- `fix: add docker compose down before up to release ports`
- `feat: enable HTTP-to-HTTPS redirect now that SSL is active`

### PR #19 (Feb 9) — WebSocket Fix (Jayrod-21)
- Fixed WebSocket connectivity for real-time chat on deployed site
- Socket.io now correctly passes JWT token instead of user ID

### PR #20 (Feb 10) — Account Creation & Split Names (Jayrod-21)
- Account creation added to application form
- Split name fields (first/last) replacing single name field
- Migration: `023_split_name_fields.sql`

### PR #21 (Feb 10) — Project Membership System (Jayrod-21)
- Project members with join/leave flow
- Per-project calendar integration
- Lead assignment for projects
- Migration: `024_project_members.sql`

### PR #22 (Feb 10) — Calendar Scoping Fix (Jayrod-21)
- Resolved calendar scoping bugs — isolate project schedules
- Read-only dashboard events for non-project members

### PR #23 (Feb 10) — Read-Only Project Events (Jayrod-21)
- Block resize/drag on dashboard project events
- Read-only detail popup for non-editable events

### PR #24 (Feb 10) — Project Preview Modal (Jayrod-21)
- Project preview modal with join request flow for non-members
- Users can request to join projects they don't belong to

### PR #25 (Feb 10) — Join Request Notifications (Jayrod-21)
- Notify admins and project leads when users request to join projects

### PR #26 (Feb 10) — Join Request Approval UI (Jayrod-21)
- Approve/reject modal triggered from join request notifications

### PR #27 (Feb 10) — Sidebar Notification Badges (Jayrod-21)
- Sidebar notification badges for unread items
- Missing bell notifications added for various events

### PR #28 (Feb 10) — Auto-Dismiss Badges (Jayrod-21)
- Auto-dismiss sidebar badges on navigation
- Highlight new tasks on My Dashboard

### PR #29 (Feb 10) — Project Page Improvements (Jayrod-21)
- Important info section on project pages
- "Add Member" button for project leads
- Task descriptions (expandable)
- Expandable dashboard sections
- Migration: `025_important_info_and_task_description.sql`

### Direct Commits (Feb 10) — Dark Mode, Email, CMS, Calendar
- Dark theme fixes across multiple components
- Email notification system with SMTP integration and HTML templates
- Multi-day calendar event drag support
- Admin CMS (Content Management System) for public site content
- AudioPlayer dark mode support
- Migration: `023_site_content.sql`

### Direct Commits (Feb 11–12) — Quality of Life Rounds 1–5
- **Round 1**: Database indexes, security headers, structured logging, user-facing error feedback
- **Round 2**: N+1 query fix, server-side pagination, confirmation modals, ARIA labels, dark mode consistency
- **Round 3**: React.memo optimization, focus trap for modals, audit logging, cache headers
- **Round 4**: Backend pagination support, relative timestamps, constants extraction, filter UX improvements
- **Round 5**: Security hardening, accessibility improvements, dark mode polish
- Migration: `026_qol_indexes_and_cleanup.sql`

### PR #30 (Feb 12) — Modal Focus Fix (Jayrod-21)
- Prevent modal inputs from losing focus after first keystroke
- Root cause: React re-rendering caused by state changes during input

### PR #31 (Feb 13) — Task Priority & Trash System
- Task priority levels (low/medium/high/urgent) with visual indicators
- Soft-delete trash system for all major entities (projects, notes, tasks, meetings, files)
- Dashboard filter improvements
- Calendar drag-and-drop fix
- Audio recording fix for deployed environment
- Migrations: `027_task_priority_and_cleanup.sql`, `028_soft_delete_all_entities.sql`

### PR #32 (Feb 13) — AI Daily Planner
- AI-powered daily planner integrated into My Dashboard
- Uses Gemini to generate daily plans based on user's tasks, calendar, and deadlines
- Step completion tracking with toggle
- Check-in system for incomplete items from previous day
- Weekly review generation
- Migration: `029_ai_daily_planner.sql`

### Direct Commits (Feb 13) — RAG AI Research Assistant
- Full RAG (Retrieval-Augmented Generation) AI Research Assistant
- Initially built with pgvector for vector embeddings
- **Pivoted** to PostgreSQL full-text search after xenova/transformers was too large for EC2
- File chunking service for indexing uploaded documents
- Conversation management with message history
- Migration: `027_rag_assistant.sql`

### Direct Commits (Feb 13) — Deploy Fixes & Data Integrity
- Multiple deploy fixes for EC2 disk space exhaustion (ENOSPC):
  - Docker image pruning before builds
  - Builder cache pruning with DB volume preservation
  - Sequential service builds to limit peak disk usage
  - Force-remove stale containers before recreating
  - Deploy concurrency control to prevent race conditions
- ANTHROPIC_API_KEY injection to deploy workflow
- Fix duplicate team members from repeated migration runs (added UNIQUE constraint)
- Migration: `030_fix_team_member_duplicates.sql`

### PR #33 (Feb 13) — Bug Fixes & Polish (Jayrod-21)
- Fix calendar drag-drop behavior
- Admin notification improvements
- Sidebar layout adjustments
- Optional field handling improvements

### PR #34 (Feb 13) — Dashboard Layout Polish (Jayrod-21)
- MyDashboard header light mode fixes
- Stats card placement and alignment improvements
- Dark mode consistency for dashboard components

### PR #35 (Feb 14) — Hamburger Navigation (Jayrod-21)
- Replace fixed sidebar with hamburger dropdown menu
- Widen search bar for better usability
- Responsive navigation for mobile/desktop

### PR #36 (Feb 14) — Tabbed AI Planner (Jayrod-21)
- Unify daily plan and weekly review into tabbed AI Planner interface
- Calendar integration with drag-and-drop plan items

### PR #37 (Feb 14) — Signal-Inspired Chat (Jayrod-21)
- Signal-inspired chat features: user avatars, message search
- Mute, pin, and archive conversations
- Improved chat room list with activity indicators

### PR #38 (Feb 14) — Backfill Project Chats (Jayrod-21)
- Backfill migration to create chat rooms for existing projects
- Ensures all projects have associated chat rooms

### PR #39 (Feb 14) — Clickable Chat Members (Jayrod-21)
- Clickable chat room title to view members panel
- Member list with role indicators

### PR #40 (Feb 14) — DM Button (Jayrod-21)
- DM button in Members Modal for quick direct messaging
- One-click creation of direct message conversations

### PR #41 (Feb 17) — Chat Room Management (Jayrod-21)
- Chat room rename capability for admins/leads
- Member management: add/remove members, transfer admin rights
- Leave chat room functionality

### PR #42 (Feb 18) — Projects Tab Overhaul (Jayrod-21)
- Per-user project pins for quick access
- Cleaner card design with subtitles
- Member count display on project cards

### PR #43 (Feb 18) — Project Subheader & Preview (Jayrod-21)
- Subheader field for projects
- Remove card avatars for cleaner UI
- Preview button on project cards

### PR #44 (Feb 18) — My Projects Filter (Jayrod-21)
- "My Projects" default filter showing only joined projects
- Two-column preview modal layout

### PR #45 (Feb 18) — Two-Panel Projects Layout (Jayrod-21)
- Two-panel layout for Projects page: list + detail preview
- Dashboard layout fix for new navigation

### PR #46 (Feb 18) — Project Card Polish (Jayrod-21)
- "Preview" and "Pin" labels on project card hover buttons
- Improved visual hierarchy

### PR #47 (Feb 18) — Project Detail Major Overhaul (Jayrod-21)
- 5 parallel workstreams for Project Detail page redesign
- Tabbed interface for project content (Tasks, Notes, Meetings, Files, Calendar)
- Enhanced task management inline editing
- Improved file browser with preview support
- Calendar embedded in project view

### PR #48 (Feb 18) — Project Detail Follow-Up Fixes (Jayrod-21)
- Avatar display fixes
- Pin functionality refinements
- Rich text editor improvements
- Meeting and audio display fixes

### PR #49 (Feb 18) — Backfill Project Chat Rooms (Jayrod-21)
- Additional backfill for project chat rooms on existing projects
- Handles edge cases from previous migration

### PR #50 (Feb 18) — DM Duplicate Fix (Jayrod-21)
- Fix DM button creating duplicate rooms on double-click
- Idempotent room creation

### PR #51 (Feb 18) — Project Detail UI Round 2 (Jayrod-21)
- Dark mode support for Project Detail page
- Clickable notes navigation
- Audio playback fixes
- File display improvements

### PR #52 (Feb 18) — Audio & Calendar Fixes (Jayrod-21)
- Fix audio progress bar display
- Calendar height adjustment
- Meeting title hint text
- Description field improvements

### PR #53 (Feb 18) — Personal Notes (Jayrod-21)
- Personal notes feature on My Dashboard
- Rich text editor for note creation/editing
- Soft delete support for personal notes

### PR #54 (Feb 19) — Dashboard Task Grouping (Jayrod-21)
- Group dashboard tasks by project for better organization
- Simplify breadcrumbs to back link for cleaner navigation

### PR #55 (Feb 20) — Book Club Feature (Jayrod-21)
- Full Book Club feature with voting system
- Book club meetings with discussion support
- Audio recording for book discussions

### PR #56 (Feb 20) — Book Club Polish (Jayrod-21)
- Fix book club date handling
- Add "set current book" modal
- Shelve book functionality

### PR #57 (Feb 20) — Dead Code Removal (Jayrod-21)
- Remove unused files, API methods, CSS, and backend exports
- Codebase cleanup for maintainability

---

## 3. Errors Encountered & Fixes

### Error 1: Port 80 Already In Use (502 Deploy Failures)
- **Symptom:** Deploy workflow failing with HTTP 502 errors
- **Error:** `failed to bind host port 0.0.0.0:80/tcp: address already in use`
- **Root Cause:** Previous containers holding port 80 when nginx tried to bind
- **Fix:** Added `docker compose down` before `docker compose up` in deploy workflow

### Error 2: Nginx DNS Resolution Race Condition
- **Symptom:** After port fix, nginx failed at startup
- **Error:** `host not found in upstream "backend:3001" in /etc/nginx/nginx.conf:29`
- **Root Cause:** Nginx resolves upstream hostnames at startup before the backend container registers on the Docker network
- **Fix:** Refactored nginx config to use `resolver` directive with variables for runtime DNS resolution

### Error 3: OOM During Frontend Build on EC2
- **Symptom:** Frontend build crashing during deployment
- **Root Cause:** EC2 instance running out of memory during Vite build
- **Fix:** Addressed in PR #16 (deployment script + build config adjustments)

### Error 4: Cover Image Upload Not Updating
- **Symptom:** Uploading a project cover image didn't reflect immediately in the UI
- **Root Cause:** Cover upload endpoint not returning complete project shape; frontend not busting cache
- **Fix:** Cover endpoint now returns full project with JOIN; frontend adds cache-busting timestamp (PR #13)

### Error 5: Audio Recording Not Connecting to Microphone
- **Symptom:** Audio recorder not capturing audio
- **Root Cause:** Improper MediaRecorder API usage
- **Fix:** Rewrote with proper MediaRecorder API, added echo cancellation + noise suppression (PR #13)

### Error 6: Chat Messages Not Updating on Send
- **Symptom:** Sent messages not appearing in the chat UI
- **Fix:** Addressed through chat improvements (PR #15) with proper Socket.io event handling

### Error 7: "New Project" Button Invisible
- **Symptom:** Button on Lab Dashboard hero section not visible
- **Root Cause:** Tailwind class conflicts with button styling
- **Fix:** Added `white` variant to Button component (PR #11, Jayrod-21)

### Error 8: Conflicting Database Migration Numbers
- **Symptom:** Multiple migration files sharing the same number prefix (e.g., multiple `004_*.sql` files)
- **Risk:** Different systems running migrations in different order — data integrity risk
- **Fix:** Renumbered migrations to sequential order (004→022 range, 22 total files)

### Error 9: Deploy Failures (Multiple, Feb 5–9)
- **Status Distribution:** ~25 failed CI/Deploy runs out of 100+ total
- **Common causes:** Port conflicts, DNS resolution, SSL setup iterations
- **Resolution:** Iterative fixes to nginx config, docker-compose, and deploy workflow

### Error 10: Socket.io Passing User ID Instead of JWT Token
- **Symptom:** Real-time chat not working on deployed site
- **Root Cause:** WebSocket connection was passing the user ID instead of the JWT token for authentication
- **Fix:** Corrected Socket.io client to pass JWT token in auth handshake (PR #19)

### Error 11: Audio MIME Type Filter Bug
- **Symptom:** Audio recordings being rejected during upload
- **Root Cause:** Backend MIME type filter rejected `audio/webm;codecs=opus` format (only accepted exact `audio/webm`)
- **Fix:** Updated MIME type validation to accept codec-qualified MIME types

### Error 12: Audio Playback Auth Bug
- **Symptom:** Audio files not playing in the browser
- **Root Cause:** HTML `<audio>` element doesn't send JWT tokens in its HTTP requests
- **Fix:** Added a signed URL or proxy endpoint that handles authentication server-side

### Error 13: Modal Inputs Losing Focus After First Keystroke
- **Symptom:** Typing in modal form fields only captured the first character before losing focus
- **Root Cause:** React re-rendering the modal component on state change, causing input elements to remount
- **Fix:** Stabilized component identity to prevent unnecessary re-renders (PR #30)

### Error 14: Migration 028 Missing `deleted_at` Column for Notes
- **Symptom:** CI tests failing after soft-delete migration
- **Root Cause:** Migration `028_soft_delete_all_entities.sql` didn't add `deleted_at` to the notes table
- **Fix:** Updated migration to include notes table in soft-delete schema

### Error 15: CI Test Failures from Soft-Delete Changes
- **Symptom:** Multiple backend tests failing after soft-delete was added
- **Root Cause:** Existing queries not filtering out soft-deleted records; test assertions outdated
- **Fix:** Updated all queries to include `WHERE deleted_at IS NULL` and updated test expectations (PR #31)

### Error 16: EC2 Disk Space Exhaustion (ENOSPC) — Multiple Occurrences
- **Symptom:** Deployments failing with `ENOSPC: no space left on device`
- **Root Cause:** Docker images, build cache, and unused containers consuming all available disk on t2.micro EC2
- **Fix (iterative):**
  1. Prune Docker images before build (`docker image prune -af`)
  2. Prune builder cache while preserving DB volume (`docker builder prune -af`)
  3. Build services sequentially instead of in parallel to limit peak disk usage
  4. Force-remove stale containers before recreating

### Error 17: Package-lock.json Out of Sync
- **Symptom:** `npm ci` failing during Docker build
- **Root Cause:** New dependencies added to `package.json` without regenerating lock file
- **Fix:** Regenerated `package-lock.json` for both frontend and backend after adding RAG dependencies

### Error 18: RAG Architecture Pivot (pgvector → Full-Text Search)
- **Symptom:** RAG assistant deployment failing on EC2
- **Root Cause:** `xenova/transformers` package (for generating vector embeddings) was too large for the disk-constrained EC2 instance
- **Fix:** Pivoted from vector embeddings (pgvector) to PostgreSQL native full-text search with `ts_vector` and `ts_query`

### Error 19: Stale Docker Containers Blocking Deploys
- **Symptom:** `docker compose up` failing because old containers still held port bindings
- **Root Cause:** Containers from previous deploys not fully removed (status: "removal in progress")
- **Fix:** Added `docker rm -f` for stale containers before running `docker compose up`

### Error 20: Concurrent Deploy Conflicts
- **Symptom:** Two deploys running simultaneously causing port conflicts and race conditions
- **Root Cause:** GitHub Actions triggering multiple deploy workflows before previous ones completed
- **Fix:** Added `concurrency` control to deploy workflow with `cancel-in-progress: true`

### Error 21: AI Assistant 400 Errors (Undefined Corpus)
- **Symptom:** AI Research Assistant returning 400 errors when querying
- **Root Cause:** Frontend sending requests before corpus/conversation was properly initialized; `undefined` values in API calls
- **Fix:** Added null checks and proper initialization flow for AI assistant conversations

### Error 22: Duplicate Team Members from Repeated Migrations
- **Symptom:** Same user appearing multiple times in team member lists
- **Root Cause:** Missing `UNIQUE` constraint on `team_members` table; re-running seed/migration data inserted duplicates
- **Fix:** Added UNIQUE constraint and de-duplication query in migration `030_fix_team_member_duplicates.sql`

### Error 23: Response Format Mismatches (Backend vs Frontend)
- **Symptom:** Frontend crashing or showing empty data after API calls
- **Root Cause:** Backend returning data in different shape than frontend expected (e.g., `{ data: [...] }` vs `{ items: [...] }`)
- **Fix:** Standardized response formats across all API endpoints

### Error 24: Lint Failures on Feature Branches
- **Symptom:** CI failing on feature branches with ESLint errors
- **Root Cause:** Unused imports and variables introduced during development
- **Fix:** Resolved lint errors before merging; added `eslintIgnoreRestSiblings` config

### Error 25: Backend Crash on Startup — Uploads Directory Permission Denied
- **Symptom:** Backend container crashing immediately on startup
- **Error:** `EACCES: permission denied` when accessing `/app/uploads/chat`
- **Fix:** Ensured uploads directory exists and has correct permissions in Dockerfile

---

## 4. Infrastructure & Deployment

### CI/CD Pipelines (GitHub Actions)
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR + Push | Run backend/frontend tests + linting |
| `deploy.yml` | After CI on main | Deploy to EC2 via Docker Compose |
| `setup-ssl.yml` | Manual | Let's Encrypt SSL certificate setup |
| `setup-backups.yml` | Manual | S3 database backup automation |

### Deploy Workflow Features
- **Concurrency control**: `cancel-in-progress: true` prevents overlapping deploys
- **Sequential builds**: Services built one at a time to limit peak disk usage on EC2
- **Pre-deploy cleanup**: Force-remove stale containers, prune images and builder cache
- **Environment injection**: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, SMTP credentials injected via GitHub Secrets

### Docker Services (Production)
1. **PostgreSQL 15** (Alpine) — persistent volume for data
2. **Backend** (Node.js, `Dockerfile.prod`) — Express API + Socket.io
3. **Frontend** (React/Vite, `Dockerfile.prod`) — static build served by Nginx
4. **Nginx** (Alpine) — reverse proxy with SSL termination, WebSocket proxy

### S3 Backup System
- Automated PostgreSQL database dumps to S3
- Configured via `setup-backups.yml` workflow
- Cron-based scheduling on EC2

### Key Environment Variables
`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `CORS_ORIGIN`, `VITE_API_URL`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `APP_URL`

### EC2 Instance
- **Current IP:** 3.13.75.86 (changed from 3.15.16.169)
- **SSH Key:** `/home/joe/.ssh/UVRL_WEbsite_key_0226.pem`
- **Instance Type:** t2.micro (disk-constrained, requires sequential Docker builds)

---

## 5. Branches

| Branch | Status | Description |
|--------|--------|-------------|
| `main` | Active (default) | Production — deploys trigger on push |
| `fix/ux-improvements` | Active (local only) | Contains uncommitted local changes |

All other branches (`feature/*`, `jared/*`, `fix/*`) are historical — merged via PRs and retained on remote.

---

## 6. User Roles & Permissions

| Role | Capabilities |
|------|-------------|
| Super Admin | Exclusive to `10947671@uvu.edu` — controls admin role changes, user deletion, full system access |
| Admin | Full access, manage users, approve registrations, view AI analytics, manage trash, CMS content |
| Project Lead | Create/edit projects, manage team members, edit descriptions, manage project calendar |
| Researcher | View/edit assigned items, create notes/tasks, use AI planner |
| Viewer | Read-only access (default for newly approved users) |

---

## 7. API Endpoints Summary

| Area | Routes |
|------|--------|
| Auth | `/api/auth/{register, login, logout, me}` |
| Projects | `/api/projects/` (CRUD + cover upload + members) |
| Action Items | `/api/actions/project/:projectId/...` |
| Files | `/api/files/project/:projectId/...` (50MB limit, RAG indexing) |
| Notes | `/api/notes/project/:projectId/...` |
| Meetings | `/api/meetings/project/:projectId/...` (500MB audio upload) |
| Chat | `/api/chats/...` (25MB file/audio upload) |
| Calendar | `/api/calendar/...` (events, deadlines, RSVP) |
| Search | `/api/search/...` |
| Comments | `/api/comments/...` |
| Admin | `/api/admin/...` (stats, user management) |
| Notifications | `/api/notifications/...` |
| AI | `/api/ai/{status, chat, admin-summary, project-summary}` |
| Public | `/api/public/{projects, site-content, team}` |
| Site Content | `/api/admin/site-content/...` (CMS management) |
| Users | `/api/users/...` (team, activity tracking) |
| Applications | `/api/applications/...` (approval flow) |
| Categories | `/api/categories/project/:projectId/...` |
| Contact | `/api/contact/...` |
| Activity | `/api/activity/...` (activity log with pagination) |
| Trash | `/api/trash/...` (soft-delete restore/purge, admin only) |
| Planner | `/api/planner/{today, generate, steps, checkin, history, weekly-review}` |
| Assistant | `/api/assistant/{status, conversations, messages, files, reindex}` |

---

## 8. Work Contribution Breakdown

### JoeWhiteJr (Joe) — 147 commits, 11 merged PRs
- **PRs**: #2, #3, #5, #9, #12, #13, #14, #15, #16, #31, #32
- **Direct commits to main**: SSL/HTTPS, QoL rounds 1–5, dark mode/email/CMS, RAG AI assistant, deploy fixes, data integrity fixes, production hardening tiers 1–4
- **Focus**: Core architecture, backend APIs, authentication system, AI integration (Gemini + RAG), task system overhaul, chat/calendar infrastructure, deployment pipeline, security hardening, database optimization

### Jayrod-21 (Jared) — 55 commits, 44 merged PRs
- **PRs**: #4, #6, #8, #10, #11, #17, #18, #19, #20, #21, #22, #23, #24, #25, #26, #27, #28, #29, #30, #33, #34, #35, #36, #37, #38, #39, #40, #41, #42, #43, #44, #45, #46, #47, #48, #49, #50, #51, #52, #53, #54, #55, #56, #57
- **Focus**: Public-facing website, UI/UX design & polish, project membership system, notification system, Signal-inspired chat overhaul, projects page redesign, project detail overhaul, hamburger navigation, AI planner UI, book club feature, dark mode, dead code cleanup

---

## 9. Timeline Summary

| Date | Key Milestones |
|------|---------------|
| Feb 4 | Repository created |
| Feb 5 | Foundation: API scaffolding, UI components, admin panel, chat, notifications, public website (7 pages), super admin role, cover upload |
| Feb 6 | UI polish, file uploads, audio player/recorder, categories, registration approval flow, soft delete users, cover preview, button fixes |
| Feb 7 | Task system overhaul (multi-assignee, subtasks, progress), AI summaries (project + admin), chat improvements (reactions, audio, file sharing), full calendar system, EC2 deployment, production hardening tiers 1–4 |
| Feb 9 | Dark mode (calendar + projects), UI improvements batch, SSL/HTTPS setup, WebSocket connectivity fix |
| Feb 10 | Project membership system (join/leave/calendar), join request flow with notifications, sidebar badges, auto-dismiss badges, project page improvements, dark mode/email/CMS/calendar direct commits, split name fields |
| Feb 11 | QoL rounds 1–3: DB indexes, N+1 fixes, React.memo, focus traps, audit logging |
| Feb 12 | QoL rounds 4–5: pagination, timestamps, accessibility, security hardening; modal focus fix |
| Feb 13 | Task priority system, soft-delete trash, AI daily planner, RAG AI Research Assistant (pgvector→full-text search pivot), multiple deploy fixes for disk space, duplicate team members fix, dashboard layout polish |
| Feb 14 | Hamburger navigation replacing sidebar, tabbed AI Planner, Signal-inspired chat overhaul, chat backfill, DM button, clickable members panel |
| Feb 17 | Chat room management (rename, member management, admin transfer) |
| Feb 18 | Projects tab overhaul (pins, two-panel layout, preview modal), Project Detail major overhaul (5 workstreams, tabbed interface), personal notes feature |
| Feb 19 | Dashboard task grouping by project, breadcrumb simplification |
| Feb 20 | Book Club feature (voting, meetings, audio), dead code removal |

---

## 10. Workflow Run Statistics

- **Total PRs:** 57 (55 merged, 2 closed)
- **Total Commits:** ~204 (147 JoeWhiteJr + 55 Jayrod-21 + 2 Claude)
- **CI/Deploy Runs:** ~150+
- **Recent Failures:** ~4 lint failures on feature branches (all resolved before merge)
- **Deploy Failures (historical):** ~25 (port conflicts, DNS, disk space, SSL iterations — all resolved)

---

## 11. Known Issues

1. **Duplicate migration numbers**: Two `023_*.sql` files (`023_site_content.sql` and `023_split_name_fields.sql`) and two `027_*.sql` files (`027_rag_assistant.sql` and `027_task_priority_and_cleanup.sql`). Risk: migration ordering ambiguity on fresh installs.
2. **Uncommitted changes on `fix/ux-improvements`**: Local branch has uncommitted changes that may need to be committed or stashed.
3. **PROGRESS.md out of date**: The `docs/PROGRESS.md` file has not been updated to reflect recent development activity.
4. **Missing migration number 015**: The migration numbering jumps from `014` to `016`, leaving a gap.
