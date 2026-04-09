# Agent Execution Rules — Wedding Calculator Project

This file defines strict execution rules for the coding agent in this repository.

The agent must follow these rules without deviation.

---

## 1. Source of Truth

- `PROJECT_SPEC.md` defines:
  - architecture
  - entities
  - system behavior

- `TASKS.md` defines:
  - execution order
  - implementation steps

- `DEPLOY_WORKFLOW.md` defines:
  - delivery order
  - GitHub to VPS deployment flow
  - обязательный порядок проверки после выкладки

The agent must not contradict these documents.

---

## 2. Core Principle

- Implement only what is defined in `TASKS.md`
- Follow architecture from `PROJECT_SPEC.md`
- Do not invent features
- Do not extend scope
- Do not simplify logic unless explicitly instructed

---

## 3. Phase Discipline

- Execute tasks strictly in order from `TASKS.md`
- Do not skip steps
- Do not start next block until current is complete
- Do not implement Phase 2+ logic during Phase 1

---

## 4. Task Isolation

- Work only on the current task block
- Do not modify unrelated modules
- Do not prepare future functionality
- Do not create abstractions “for later”

---

## 5. No Assumptions

- Do not guess requirements
- Do not invent missing logic
- If something is unclear:
  - STOP
  - ask for clarification

Only allowed sources:
- `PROJECT_SPEC.md`
- `TASKS.md`

---

## 6. No Refactoring / No Initiative

- Do not:
  - refactor code
  - improve architecture
  - optimize logic
- unless explicitly requested

Write minimal working implementation.

---

## 7. Architecture Safety

### Backend
- Use FastAPI structure defined in TASKS
- Keep modules separated:
  - api
  - services
  - repositories
  - models

### Database
- Use PostgreSQL + SQLAlchemy + Alembic
- Only additive migrations
- Do not:
  - rename fields
  - delete fields
  - change types

### Domain rules
- One active lead per user (MVP constraint)
- Expenses must be stored as separate rows (not JSON blob)
- Events must be append-only

---

## 8. Layer Isolation

Do not mix responsibilities:

- frontend (Telegram Mini App)
- backend (FastAPI)
- bot (aiogram)
- infra (Docker, Nginx)

Each task must affect only one layer unless explicitly required.

---

## 9. Telegram Integration Rules

- Always validate `initData` on backend
- Do not trust frontend data
- Link all data to `users.telegram_id`
- Do not bypass auth layer

---

## 10. API Discipline

- Follow `/api/v1/...` structure
- Do not change endpoint contracts without instruction
- Use explicit schemas for request/response
- Do not return raw DB models

---

## 11. Event System Rules

- All events must go through centralized event service
- Do not write events directly in routers
- Events must be append-only
- Required Phase 1 events:
  - bot_started
  - miniapp_opened
  - lead_created
  - profile_updated
  - expense_added
  - expense_updated
  - expense_removed
  - budget_calculated
  - app_resumed

---

## 12. State Persistence

- All user data must be stored in DB
- No critical state must live only in frontend
- Progress must be restorable via backend

---

## 13. Error Handling

- Do not ignore errors
- Return explicit error responses
- Do not create silent failures

---

## 14. Validation Before Commit

Before completing a task:

- Code compiles
- Imports are valid
- API endpoints respond
- DB migrations run
- No unrelated changes included
- For UI tasks, final visual conclusions must be based on the final deployed product URL where users actually open the product
- Local preview may be used only as an intermediate development aid, never as the final source of truth once the product is already deployed somewhere

---

## 15. Commit Rules

- One task = one commit
- After each completed task change, the agent must immediately:
  - verify the change locally when applicable
  - commit the result
  - push the commit to remote
- For any code/config/infra change that affects the running project, the agent must then:
  - deploy the latest pushed commit to VPS
  - verify VPS state via logs/health checks
- The required order is:
  - local change
  - local verification
  - commit
  - push to GitHub
  - deploy to VPS
  - verify VPS after deploy
- Do not leave finished changes only in local working tree unless the user explicitly requests that
- Do not stop after `git push` if the task is expected to be live on VPS
- Commit messages:
  - `feat: ...`
  - `fix: ...`
  - `chore: ...`
- No mixed changes

---

## 16. Forbidden Actions

The agent MUST NOT:

- change architecture
- modify unrelated files
- implement future phases
- invent business logic
- skip tasks
- merge multiple tasks
- generate fake/mock logic without marking it

---

## 17. If Something Is Unclear

- STOP execution
- Ask for clarification
- Do not guess

---

## 18. Definition of Done

A task is complete only if:

- All items in the task block are implemented
- Code works
- No side effects introduced
- Changes are committed
- Changes are pushed
- VPS is updated when the task affects deployed code
- Post-deploy verification is completed when VPS deploy was required

---

## 19. Priority Order

If conflict occurs:

1. `PROJECT_SPEC.md`
2. `TASKS.md`
3. This file

---

## 20. Code Hygiene And Cleanup

- Do not leave dead code, abandoned branches, or obsolete helpers in the codebase
- Do not keep temporary debug logic, temporary access hacks, or one-off operational workarounds after they are no longer needed
- Do not layer new logic on top of old broken logic if the old path can be safely removed
- When a temporary workaround is required to complete a task:
  - mark it clearly
  - contain it narrowly
  - remove it as soon as the stable path is implemented
- When a task changes architecture or behavior materially:
  - update the real source-of-truth files
  - remove superseded logic
  - keep the repository in a clean final state, not an intermediate state

This rule does not authorize broad speculative refactoring.
Cleanup must be targeted, justified, and directly connected to the implemented task.
