# TASKS.md

## Phase 1 — MVP Calculator in Telegram Mini App

### Goal
Build a working Phase 1 MVP where a real user can:
- open a Telegram bot;
- launch the wedding calculator as a Telegram Mini App;
- pass validated Telegram auth;
- fill wedding profile data;
- add and edit expenses;
- calculate total budget;
- leave the app and return later without losing progress.

Admin must be able to:
- receive basic Telegram notifications;
- open a minimal admin page;
- view lead list, lead card, expenses, and recent events.

---

## 1. Project bootstrap

- [ ] Create repository structure for:
  - frontend
  - backend
  - bot
  - infra
- [ ] Define root folder layout
- [ ] Add `.editorconfig`
- [ ] Add `.gitignore`
- [ ] Add base `README.md`
- [ ] Add `.env.example`
- [ ] Add Docker-based local dev environment
- [ ] Add Docker Compose for:
  - frontend
  - backend
  - bot
  - postgres
  - nginx
- [ ] Add healthchecks for all services
- [ ] Verify project starts locally with one command

### Acceptance criteria
- All services can be started through Docker Compose
- Project structure is stable and ready for incremental development

---

## 2. Backend bootstrap

- [ ] Create FastAPI application skeleton
- [ ] Add app config module
- [ ] Add environment-based settings
- [ ] Add modules:
  - `api`
  - `models`
  - `schemas`
  - `services`
  - `repositories`
  - `core`
- [ ] Add structured logging
- [ ] Add error handling middleware
- [ ] Add CORS config for Mini App frontend
- [ ] Add API version prefix `/api/v1`
- [ ] Add health endpoint

### Acceptance criteria
- Backend starts successfully
- `/api/v1/health` returns success
- App config is fully env-driven

---

## 3. Database and migrations

- [ ] Configure PostgreSQL connection
- [ ] Configure SQLAlchemy
- [ ] Configure Alembic
- [ ] Create initial migration
- [ ] Create tables:
  - `users`
  - `leads`
  - `expenses`
  - `lead_events`
  - `scheduled_messages`
  - `admin_notifications`
  - `message_templates`
- [ ] Add indexes for:
  - `users.telegram_id`
  - `leads.user_id`
  - `lead_events.lead_id`
  - `scheduled_messages.send_at`
- [ ] Add timestamps and update behavior
- [ ] Verify migrations run cleanly from zero

### Acceptance criteria
- Full schema can be recreated from migrations only
- No manual DB steps required
- DB structure matches spec

---

## 4. Domain models

- [ ] Implement SQLAlchemy models for all Phase 1 entities
- [ ] Define enums for:
  - lead status
  - notification status
  - scheduled message status
- [ ] Add constraints for one active lead per user in MVP
- [ ] Ensure expenses are stored as separate rows, not one JSON blob
- [ ] Add event payload support for append-only event history

### Acceptance criteria
- Models reflect domain logic from spec
- Statuses and relationships are explicit
- DB design is not tied to UI screens

---

## 5. Telegram Mini App auth

- [ ] Implement Telegram `initData` validation service
- [ ] Create `POST /api/v1/auth/telegram/init`
- [ ] Parse Telegram user info from validated payload
- [ ] Create or update `users` record
- [ ] Update:
  - `first_started_at`
  - `last_seen_at`
  - `visits_count`
- [ ] Return backend session/app identity payload
- [ ] Reject invalid or forged payloads
- [ ] Log auth-related events

### Acceptance criteria
- Mini App user identity is validated on backend
- Invalid init payload is rejected
- User record is created or updated correctly

---

## 6. Lead profile API

- [ ] Create schemas for lead create/update/read
- [ ] Implement:
  - `GET /api/v1/lead`
  - `POST /api/v1/lead`
  - `PATCH /api/v1/lead`
- [ ] Support fields:
  - role
  - city
  - venue_status
  - wedding_date_exact
  - wedding_date_mode
  - season
  - next_year_flag
  - guests_count
  - source
  - utm fields
  - partner_code
- [ ] Ensure lead is linked to authenticated user
- [ ] Add event logging:
  - `lead_created`
  - `profile_started`
  - `profile_updated`
  - `profile_completed`

### Acceptance criteria
- User can create and update profile
- Data persists between sessions
- Required events are written

---

## 7. Expenses API

- [ ] Create schemas for expense CRUD
- [ ] Implement:
  - `GET /api/v1/lead/expenses`
  - `POST /api/v1/lead/expenses`
  - `PATCH /api/v1/lead/expenses/{expense_id}`
  - `DELETE /api/v1/lead/expenses/{expense_id}`
- [ ] Support base categories from spec
- [ ] Support custom expense category
- [ ] Add event logging:
  - `expense_added`
  - `expense_updated`
  - `expense_removed`

### Acceptance criteria
- Expenses can be added, edited, removed
- Each expense is a separate DB row
- Events are logged for every change

---

## 8. Calculation and progress restore

- [ ] Implement budget calculation service
- [ ] Implement `POST /api/v1/lead/calculate`
- [ ] Save calculated total into `leads.total_budget`
- [ ] Add event `budget_calculated`
- [ ] Implement `GET /api/v1/lead/progress`
- [ ] Restore:
  - profile fields
  - expenses
  - current total
  - lead status
- [ ] Add event `app_resumed` for repeated entry

### Acceptance criteria
- Total budget is calculated from DB data, not only on frontend
- User can close app and continue later
- Progress restoration works from backend state

---

## 9. Event logging layer

- [ ] Create centralized event creation service
- [ ] Implement append-only writes to `lead_events`
- [ ] Cover Phase 1 minimum events:
  - `bot_started`
  - `miniapp_opened`
  - `lead_created`
  - `profile_started`
  - `profile_updated`
  - `profile_completed`
  - `expense_added`
  - `expense_updated`
  - `expense_removed`
  - `budget_calculated`
  - `app_resumed`
- [ ] Prevent event creation logic from being duplicated across routers

### Acceptance criteria
- Events are written consistently through one service
- Event history can be used later for Lead Intelligence

---

## 10. Telegram bot — Phase 1

- [ ] Create aiogram bot project
- [ ] Implement `/start`
- [ ] Add main entry message
- [ ] Add button to open Telegram Mini App
- [ ] Add admin notification sending service
- [ ] Send admin notifications for:
  - bot start
  - profile completed
  - calculation completed
- [ ] Make admin chat ID configurable via env
- [ ] Log delivery success/failure into `admin_notifications`

### Acceptance criteria
- User can open Mini App from bot
- Admin receives basic notifications
- Notification log is persisted

---

## 11. Minimal admin backend

- [ ] Implement admin auth guard strategy for MVP
- [ ] Implement endpoints:
  - `GET /api/v1/admin/leads`
  - `GET /api/v1/admin/leads/{lead_id}`
  - `GET /api/v1/admin/leads/{lead_id}/events`
  - `GET /api/v1/admin/notifications`
- [ ] Support lead list fields:
  - name / username
  - role
  - city
  - wedding date or season
  - guests_count
  - total_budget
  - lead_status
  - last_seen
  - source
- [ ] Support lead detail fields:
  - full profile
  - expenses
  - recent events

### Acceptance criteria
- Admin API returns enough data for minimal web-admin
- Admin can inspect lead card and event history

---

## 12. Frontend integration — Mini App

- [ ] Prepare frontend for Telegram Mini App runtime
- [ ] Add Telegram WebApp SDK integration
- [ ] Send `initData` to backend on app start
- [ ] Implement app bootstrap after auth
- [ ] Connect profile form to backend API
- [ ] Connect expenses UI to backend API
- [ ] Connect calculate action to backend API
- [ ] Load saved progress from backend
- [ ] Handle loading/error states
- [ ] Ensure no critical logic exists only on frontend
- [ ] Record `miniapp_opened` event

### Acceptance criteria
- Existing frontend works inside Telegram Mini App
- Frontend is backed by real API and DB
- Reload/re-entry restores saved state

---

## 13. Minimal admin frontend

- [ ] Create minimal admin route/page
- [ ] Build lead list page
- [ ] Build lead detail page
- [ ] Display:
  - profile
  - expenses
  - total budget
  - recent events
- [ ] Add basic sorting by:
  - created_at
  - updated_at
  - last_seen_at
- [ ] Add basic status display
- [ ] Ensure admin view is readable and operational, not decorative

### Acceptance criteria
- Admin can open lead list
- Admin can inspect one lead without DB access
- MVP admin page is useful for real work

---

## 14. Infra and deployment

- [ ] Prepare production Docker Compose
- [ ] Add Nginx reverse proxy config
- [ ] Add domain/subdomain routing plan
- [ ] Add HTTPS support plan
- [ ] Add env separation for production
- [ ] Add persistent volume for PostgreSQL
- [ ] Add backup strategy for DB
- [ ] Add deployment instructions for VPS
- [ ] Verify all services run on VPS
- [ ] Verify Mini App works over HTTPS

### Acceptance criteria
- App is deployable on VPS from documented steps
- HTTPS is available
- DB data survives container restart

---

## 15. Quality control and testing

- [ ] Add backend smoke tests for key endpoints
- [ ] Add auth validation test cases
- [ ] Add migration test from empty DB
- [ ] Add manual test checklist for full user flow
- [ ] Add manual test checklist for return flow
- [ ] Add manual test checklist for admin flow
- [ ] Verify no critical data loss on re-entry
- [ ] Verify invalid auth is rejected
- [ ] Verify notifications are sent and logged

### Acceptance criteria
- MVP has baseline reliability checks
- Main flows are reproducible and testable

---

## 16. Phase 1 completion checklist

- [ ] Telegram bot launches Mini App
- [ ] Telegram auth validation works
- [ ] User profile saves
- [ ] Expenses save
- [ ] Total budget calculates and saves
- [ ] Progress restores after reopening
- [ ] Events are logged
- [ ] Admin receives Telegram notifications
- [ ] Admin web page works
- [ ] App is deployed on VPS with Docker and HTTPS

---

## 17. Explicit non-goals for Phase 1

- [ ] Do not build complex auto-warmup logic yet
- [ ] Do not build advanced scoring
- [ ] Do not build full BI analytics
- [ ] Do not build partner кабинеты
- [ ] Do not build full UTM dashboards
- [ ] Do not build ML layer

---

## 18. Implementation order

### Recommended build order
1. Project bootstrap
2. Backend bootstrap
3. Database + migrations
4. Domain models
5. Telegram auth validation
6. Lead profile API
7. Expenses API
8. Calculation + progress restore
9. Event logging layer
10. Bot
11. Admin API
12. Frontend integration
13. Admin frontend
14. Infra + deployment
15. Testing + hardening

---

## 19. Done definition for Phase 1

Phase 1 is done only if:
- real Telegram user can use the calculator end-to-end;
- data persists in PostgreSQL;
- returning user restores previous state;
- admin receives notifications;
- admin can inspect leads in web-admin;
- deployment works on VPS over HTTPS;
- implementation does not block phases 2–4.