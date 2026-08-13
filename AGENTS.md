# AGENTS.md — Salon Platform Project Guide

This file gives AI agents (Cline, Codex, Copilot, etc.) the ground truth about this project. Read it before making changes. It prevents agents from rebuilding what exists or violating the architecture.



## 0. How to use this repository's agent system

This repository separates four kinds of guidance:

- `AGENTS.md` — rules that are broadly applicable to every task.
- `.agents/skills/` — specialized procedures used when a task matches the skill.
- `.agents/workflows/` — explicit multi-step procedures for major activities such as building, testing, and documenting a module.
- `docs/` — project knowledge, research, decisions, module flows, and historical bug records.

The agent should not assume that every Markdown file in `docs/` is a skill. Skills live under `.agents/skills/<skill-name>/SKILL.md`.

When a workflow or skill says to inspect project documentation, read the relevant files from `docs/` before making decisions.

### Instruction precedence

When instructions appear to conflict:
1. Safety, security, and platform/tool constraints win.
2. Explicit user instructions for the current task win.
3. This `AGENTS.md` applies repository-wide.
4. A matching workflow controls the sequence of that activity.
5. A matching skill controls the specialized procedure.
6. `docs/` provides project-specific knowledge and historical context.

Do not silently ignore a conflict. Explain the conflict and use the highest-priority applicable rule.
---

## 1. Project Overview

A **multi-tenant SaaS + B2C marketplace** for salons (Fresha-style). Built as a **pnpm monorepo** with Turborepo.

- **Backend:** Node.js + TypeScript + Express 5
- **Database:** PostgreSQL + Drizzle ORM
- **Validation:** Zod
- **Auth:** JWT access tokens (stateless) + opaque refresh tokens (stateful, hashed in DB)
- **Docs:** OpenAPI 3.1 generated from Zod schemas, served via Scalar UI at `/docs` in every module 
- and /docs at the root is for research and other documentation things 

---

## 2. Monorepo Structure

```
apps/
  api/                    # The Express API application (entry point)
    src/
      app.ts              # Creates the Express app (middleware order matters)
      main.ts             # Bootstrap entry
      server.ts           # HTTP server
      boostrap/           # env, shutdown
      config/             # app config
      http/
        middlewares/      # error-handler, not-found, pino-logger, auth
        routes/           # health, docs, index (module mounting)
      tests/
configs/
  typescript-config/      # Shared TS configs (base, app, library, test)
infrastructure/
  docker/                 # docker-compose
packages/
  infrastructure/
    config/               # @salon/config — env validation via Zod
    database/             # @salon/database — Drizzle db, client, ALL schema tables
    events/               # @salon/events — event bus (currently a stub)
    logger/               # @salon/logger — pino
    validation/           # @salon/validation
  modules/
    identity/             # @salon/identity — auth (DONE)
    business/             # @salon/business — business lifecycle (NEXT)
    branch/               # @salon/branch — branch lifecycle
    service/              # @salon/service — service catalog
    staff/                # @salon/staff — staff profiles
    customer/             # @salon/customer — CRM
    marketplace/          # @salon/marketplace — B2C discovery
    appointment/          # @salon/appointment — booking engine
    payment/              # @salon/payment — Stripe
    notification/         # @salon/notification — SMS/email
    review/               # @salon/review — ratings
    audit/                # @salon/audit — audit logs
    inventory/            # @salon/inventory — (deferred)
    analytics/            # @salon/analytics — (deferred)
    administration/       # @salon/administration — (deferred)
  shared/                 # @salon/shared — errors, base repository
  testing/                # @salon/testing — test utilities
```

---

## 3. Module Architecture Pattern


```
packages/modules/<name>/src/
  api/
    controllers/          # HTTP controllers (parse req.body, call use cases, respond)
    dtos/                 # Zod schemas for request validation
    docs/                 # OpenAPI registry (zod-to-openapi)
    middlewares/          # Module-specific Express middleware (e.g., auth)
  application/
    ports/                # Interfaces (repositories, services) — the contracts
    use-cases/            # Business logic classes with execute() method
  domain/
    entities/             # Domain entities (UserEntity, SessionEntity, etc.)
  infrastructure/
    repositories/         # Drizzle implementations of ports
    services/             # Concrete services (JwtService, BcryptService)
  index.ts                # Module factory: wires everything, exports router + use cases

  but basically we are using pragmatic pattern so would not every module follow this some follow hexagonal and some clean and some layers, thats why you need to ask before following and applying any architecture to the module
```

The project is pragmatic. Existing modules may use Clean Architecture, Hexagonal Architecture, layered architecture, or a pragmatic combination.

Do **not** assume that every new module must use the same architecture.

Before implementing a module:
1. Inspect nearby/related modules.
2. Read relevant architecture documentation.
3. Identify the simplest architecture that fits the module.
4. Preserve established conventions unless there is a concrete reason to change them.
5. If the architectural choice materially affects the design and is genuinely ambiguous, stop and ask the user before committing to the approach.

### The 7-Step Module Build Checklist

The old 7-step module checklist is retained as a useful default starting point, not a blind law:

When building a new module, follow this exact order:

1. **Define the PORT** (interface) in `application/ports/`
2. **Implement the REPOSITORY** in `infrastructure/repositories/`
3. **Write the USE CASE** in `application/use-cases/` (top-down: write `execute()` first, it reveals dependencies)
4. **Create the CONTROLLER** in `api/controllers/`
5. **Define the DTO schemas** in `api/dtos/`
6. **Add the OpenAPI registry** in `api/docs/`
7. **Wire it** in the module's `index.ts` (factory) + mount in `apps/api/src/http/routes/index.ts`

## 4. Execution Workflow & Phase Lifecycle

To maintain high code quality, security, and learning outcomes, **every module MUST be built strictly phase-by-phase**. Never rush or combine all phases at once.


## 4. Module Lifecycle

Every module is built deliberately and one logical module at a time.

### Phase 1 — Understand and Plan
- Inspect current code, tests, configuration, and relevant docs.
- Determine dependencies and the logical module order.
- Check relevant official/current external documentation, especially Fresha-related behavior.
- Identify security and business/operational edge cases.
- Decide what is deliberately out of scope.

### Phase 2 — Core Implementation
- Use the module's chosen architecture.
- Keep business logic in the appropriate application/domain boundary.
- Do not add speculative features or unnecessary abstractions.
- Follow the 7-step checklist (Ports -> Repositories -> Use Cases -> Controllers -> DTOs -> OpenAPI -> Module Wiring & API Mounting).
- Implement real-world Fresha-style business logic and security edge cases (tenant isolation, price precision, duration checks, IDOR protection).
- **Comments Standard**: Add vivid, clear, and domain-relevant code comments explaining *why* key architectural decisions, validation boundaries, and security guards exist. Avoid generic or low-quality AI fluff.


### Phase 3 — Code Review and Issue Resolution
- Review the implementation for logic, data, security, business, concurrency, and integration problems.
- Resolve meaningful issues before test completion.

### Phase 4 — Testing and Integration Verification
- Use the `testing` skill.
- Inspect the implementation before writing tests.
- Add the smallest useful set of unit/integration/API tests.
- Cover important success, failure, security, business, retry/duplicate, and boundary cases.

### Phase 5 — Test Fixes and Refinement
- Run `pnpm check` and `pnpm test` as appropriate.
- Resolve failures and meaningful bugs revealed by tests.
- Re-review security and business edge cases after fixes.

### Phase 6 — Documentation
- Use the `module-documentation` skill.
- Create/update module flow documentation.
- Update `docs/BUGS_REPORT.md` using the established format.
- Record meaningful mistakes and lessons, not trivial edits.



### Permission Gate — Documentation
After implementation, review, and testing are complete, **STOP and ask the user for explicit permission before creating/updating module-completion documentation.**

### Permission Gate — Next Module
After documentation is complete, **STOP and ask the user for explicit permission before starting the next module.**

### Permission Gate — Git
**Never commit without explicit user permission.**
Do not infer commit permission from "continue", "looks good", or similar wording unless the user explicitly authorizes the commit.
- **Git Commits**: Never commit code without explicit user permission. When permitted, make distinct logical commits (e.g., `feat(<module>): core implementation`, `test(<module>): unit and api integration tests`, `docs(<module>): flow docs and bug report`).
- **Module Boundary**: Do NOT proceed to the next module without explicit permission from the user.


When approved, keep meaningful commits separate:
1. Core implementation
2. Tests
3. Documentation

Do not create empty commits.
Do not push unless separately authorized.


## 5. Architectural Invariants (DO NOT VIOLATE)

These are hard rules. Every agent must follow them.

### Where code lives
- **`req.body` and HTTP headers** live ONLY in `apps/api/src/http/controllers` (or module `api/controllers`).
- **SQL queries** live ONLY in `packages/infrastructure/database` (repositories).
- **Business rules** (e.g., "appointments must be booked 2 hours ahead") live ONLY in `packages/modules/*/src/application/use-cases`.
- **Domain entities** live ONLY in `packages/modules/*/src/domain/entities`.

### Error handling
- **Client-facing failures** MUST use `AppError` subclasses from `@salon/shared` (ValidationError, UnauthorizedError, ForbiddenError, ConflictError, ResourceNotFoundError, TenantIsolationError).
- **Internal invariant failures** (impossible states, DB bugs) MUST throw plain `Error` (→ 500), NOT a client-facing error like `UnauthorizedError`.
- Never leak internal details in error messages to clients.

### Auth & security
- **Access tokens** are short-lived JWTs (15 min), stateless.
- **Refresh tokens** are opaque random strings, stored ONLY as SHA-256 hashes in `user_sessions`.
- **Never store raw refresh tokens** in the DB.
- **IP and User-Agent** must come from the request (`req.ip`, `req.get('user-agent')`), NEVER from the request body.
- **Password comparison** must be constant-time (use a dummy hash for non-existent users to prevent timing attacks).
- **Token rotation** must be atomic (compare-and-swap on the expected hash).

### Concurrency & Type Safety
- **State transitions** that must be atomic (e.g., token rotation, assignment toggles) MUST use compare-and-swap or atomic SQL (`.onConflictDoNothing()`).
- **Read before write**: all validation/reads happen before any DB write in a use case.
- **Zero `any` types**: Biome and TypeScript strict mode will fail on `any`. Always use explicit types, `unknown` with type guards, or proper generics.

### API consistency
- Every response uses the envelope: `{ success, error, meta }`.
- `error.details` is ALWAYS a `Record<string, string>` (object), never an array.
- Every module contributes an OpenAPI registry to the unified docs.

---


## 6. Fresha and External Documentation

Use the `source-of-truth` skill when a task depends on external product/API behavior.

Do not invent undocumented:
- endpoints
- fields
- states
- permissions
- rate limits
- retry semantics
- webhook semantics
- pagination behavior
- lifecycle rules

Clearly distinguish:
- documented behavior
- observed behavior
- project decisions
- assumptions pending verification

When current external behavior may have changed, verify it before relying on it.


## 6. Phase Roadmap (What's Done, What's Next)

### ✅ DONE
- **Infrastructure:** config, database (all schema), logger, shared errors, validation
- **Identity/Auth:** register, login, refresh, logout, sessions, JWT, bcrypt, OpenAPI registry
- **Business module:** tenant creation, business member setup, owner RBAC role
- **Branch module:** branch lifecycle, opening hours, tenant-isolated operations
- **Service module:** service catalog, service categories, branch assignment matrix

### 🔜 NEXT (in logical sequence)
1. **Staff module** (`@salon/staff`) — onboard staff members, assign services to staff, manage staff working schedules/shifts across branches. *(Prerequisite for appointment scheduling)*
2. **RBAC module** (`@salon/rbac`) — expand roles/permissions beyond Owner (Stylist, Receptionist, Manager) now that Staff profiles exist.
3. **Customer module** (`@salon/customer`) — CRM, customer profiles, notes, history.
4. **Appointment module** (`@salon/appointment`) — availability engine, booking calendar, lock-free/atomic slot booking.
5. **Marketplace module** (`@salon/marketplace`) — public salon discovery, search by service/location.
6. **Payment module** (`@salon/payment`) — Stripe checkout, deposits, webhook idempotency.
7. **Notification module** (`@salon/notification`) — event-driven SMS/email reminders.
8. **Review module** (`@salon/review`) — ratings & customer feedback.
9. **Audit module** (`@salon/audit`) — system audit logs.

### Key ordering principle
- **Staff before Appointment:** An appointment requires a physical branch, a service, AND an assigned staff member who is available during that shift.
- **Staff before full RBAC:** Roles like "Stylist" or "Receptionist" are assigned to staff user profiles.
- **Business -> Branch -> Service -> Staff -> Appointment:** Real-world domain hierarchy matches Fresha platform architecture.

---

## 7. Database Schema Organization

The DB schema (`packages/infrastructure/database/src/schema/`) is organized by **data relationship** (foreign keys), NOT by module.

- `business/` contains `businesses`, `branches`, `business_settings`, `opening_hours` — because `branches.businessId → businesses.id`.
- This is CORRECT. The `branch` module (`packages/modules/branch/`) is a separate **application** module that operates on the `branches` table. DB schema grouping ≠ module grouping.

---

## 8. Commands

```bash
pnpm check          # typecheck + biome + depcruise (run before finishing any task)
pnpm format         # biome check --write (auto-fix formatting)
pnpm --filter @salon/service build    # rebuild a package's dist
pnpm --filter @salon/api dev          # run the API dev server
pnpm test                             # run all tests
```

**Important:** When you change a package (e.g., `@salon/service`), you must rebuild it (`pnpm --filter @salon/service build`) AND restart the API server. `tsx watch` only watches the API's own source, not dependency packages' dist.

---



## 9 . Teaching Rules

The agent acts as a teacher-engineer:
- Do not blindly agree with the student.
- If a proposed approach is unsafe, over-engineered, inconsistent with documentation, or poorly sequenced, say so and explain why.
- Explain important reasoning close to the relevant implementation.
- Keep comments vivid, specific, and domain-related.
- Do not write generic "AI-sounding" filler comments.
- Do not explain every trivial operation.
- Focus on lessons that transfer to future work.

## 10. Canonical Skill and Workflow Map

Use these specialized procedures when relevant:

- `.agents/skills/module-implementation/SKILL.md`
- `.agents/skills/testing/SKILL.md`
- `.agents/skills/security-review/SKILL.md`
- `.agents/skills/module-documentation/SKILL.md`
- `.agents/skills/source-of-truth/SKILL.md`

Use these workflows for explicit phase-driven work:

- `.agents/workflows/build-module.md`
- `.agents/workflows/test-module.md`
- `.agents/workflows/document-module.md`
