# AGENTS.md — Salon Platform Project Guide

This file gives AI agents (Cline, Codex, Copilot, etc.) the ground truth about this project. Read it before making changes. It prevents agents from rebuilding what exists or violating the architecture.

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

Every module follows the same **Clean Architecture** structure:

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

### The 7-Step Module Build Checklist

When building a new module, follow this exact order:

1. **Define the PORT** (interface) in `application/ports/`
2. **Implement the REPOSITORY** in `infrastructure/repositories/`
3. **Write the USE CASE** in `application/use-cases/` (top-down: write `execute()` first, it reveals dependencies)
4. **Create the CONTROLLER** in `api/controllers/`
5. **Define the DTO schemas** in `api/dtos/`
6. **Add the OpenAPI registry** in `api/docs/`
7. **Wire it** in the module's `index.ts` (factory) + mount in `apps/api/src/http/routes/index.ts`

---

## 4. Architectural Invariants (DO NOT VIOLATE)

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

### Concurrency
- **State transitions** that must be atomic (e.g., token rotation) MUST use compare-and-swap (conditional WHERE clause + check rows affected).
- **Read before write**: all validation/reads happen before any DB write in a use case.

### API consistency
- Every response uses the envelope: `{ success, error, meta }`.
- `error.details` is ALWAYS a `Record<string, string>` (object), never an array.
- Every module contributes an OpenAPI registry to the unified docs.

---

## 5. Phase Roadmap (What's Done, What's Next)

### ✅ DONE
- **Infrastructure:** config, database (all schema), logger, shared errors, validation
- **Identity/Auth:** register, login, refresh, logout, sessions, JWT, bcrypt, OpenAPI registry
- **API app:** app.ts, health/docs/auth routes, error-handler, not-found, pino-logger, Scalar docs
- **API Docs:** Scalar UI at `/docs`, OpenAPI JSON at `/docs/openapi.json`

### 🔜 NEXT (in order)
1. **Auth middleware** — protect routes with `req.user` (currently being added)
2. **Business module** — `CreateBusinessUseCase` (creates Business + Owner RBAC role + business_member in one transaction)
3. **Tenant middleware** — reads `x-business-id`, checks `business_members`, throws `ForbiddenError`
4. **Branch module** — `CreateBranchUseCase`
5. **Service module** — `CreateServiceUseCase`
6. **Staff module** — onboard staff, assign services, set schedules
7. **RBAC module** — expand roles/permissions beyond Owner (once Staff exist)
8. **Customer module** — CRM
9. **Marketplace module** — search salons, professional profiles
10. **Appointment module** — availability engine, booking (db.transaction)
11. **Payment module** — Stripe checkout + webhook (idempotency)
12. **Notification module** — event-driven SMS/email
13. **Review module** — submit/reply reviews
14. **Audit module** — audit logging
15. **Inventory, Analytics, Administration** — deferred (post-MVP)

### Key ordering principle
- **RBAC is NOT built first in isolation.** The minimum RBAC (Owner role) is created inside `CreateBusinessUseCase`. Full RBAC expansion happens after Staff exist.
- **Business must exist before Branch, Staff, Service, Appointment.** Everything B2B hangs off the tenant.

---

## 6. Database Schema Organization

The DB schema (`packages/infrastructure/database/src/schema/`) is organized by **data relationship** (foreign keys), NOT by module.

- `business/` contains `businesses`, `branches`, `business_settings`, `opening_hours` — because `branches.businessId → businesses.id`.
- This is CORRECT. The `branch` module (`packages/modules/branch/`) is a separate **application** module that operates on the `branches` table. DB schema grouping ≠ module grouping.

---

## 7. Commands

```bash
pnpm check          # typecheck + biome + depcruise (run before finishing any task)
pnpm format         # biome check --write (auto-fix formatting)
pnpm --filter @salon/identity build   # rebuild a package's dist
pnpm --filter @salon/api dev          # run the API dev server
```

**Important:** When you change a package (e.g., `@salon/identity`), you must rebuild it (`pnpm --filter @salon/identity build`) AND restart the API server. `tsx watch` only watches the API's own source, not dependency packages' dist.

---

## 8. Testing

- Tests live in `apps/api/tests/` and `packages/testing/`.
- Write a test for each bug fix that demonstrates the bug before the fix and passes after.
- Run `pnpm check` before declaring a task complete.

if there are bugs you encountered while solving, creating and implementing anything opr the bug I gave you to fix , you make sure you create bug report file inside the docs folder and regarding the format of file follow this BUGS_REPORT.md file already inside the docs folder 

make sure you write data and time and task at the top of each report I gave you, dont waste soo much token on it, bug report should follow the format and explain things vivdly 