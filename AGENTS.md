# AGENTS.md — Salon Platform Project Guide

This file gives AI agents (Cline, Copilot, etc.) the ground truth about this repository. Read it before making changes. It prevents agents from rebuilding what exists or violating the architecture.

## 0. How to use this repository's agent system

This repository separates four kinds of guidance:
- `AGENTS.md` — rules that apply broadly to every task.
- `.agents/skills/` — specialized procedures used when a task matches a skill.
- `.agents/workflows/` — explicit multi-step procedures for major activities such as building, testing, documenting a module.
- `docs/` — project knowledge, research, decisions, module flows, history.
- `docs/90-shared/10-decisions-history/bug-reports/` — isolated daily bug reports and audit logs (`YYYY-MM-DD_<module>_audit.md`).
- `docs/90-shared/10-decisions-history/iadr/` — implementation learning and progression decision records (`DECISION-NNN-<Title>.md`).

The agent should not assume every Markdown file in `docs/` is a skill. Skills live under `.agents/skills/<skill-name>/SKILL.md`.

When a workflow or skill says to inspect project documentation, read the relevant files from `docs/` before deciding.

**Documentation policy (important — do not "fix" this):** `/docs/` is **intentionally local-only and NOT
version-controlled** (`.gitignore` → *"Documentation (Local Working Files)"*). That is a deliberate decision,
not an oversight. Because there is no git history inside `docs/`, **never silently overwrite**: record
decisions as new immutable records (supersede + link back), move wholesale-superseded docs verbatim to
`docs/99-history/` with a note in its `README.md`, and register every new decision in **both** its folder index
and `docs/90-shared/10-decisions-history/00-decisions-timeline.md`. Full rules:
`docs/90-shared/30-templates/00-how-docs-work.md`.

### Instruction precedence

When instructions conflict:
1. Safety, security, platform/tool constraints win.
2. Explicit user instructions for the current task win.
3. This `AGENTS.md` applies repository-wide.
4. A matching workflow controls that activity.
5. A matching skill controls that specialized procedure.
6. `docs/` provides project-specific knowledge and context.
7. The `docs/90-shared/10-decisions-history/bug-reports/` and `docs/90-shared/10-decisions-history/iadr/` document meaningful bugs, post-mortems, and learnings.

Do not silently ignore conflicts — state the conflict and apply the highest-priority rule.

---

## 1. Project Overview

A **multi-tenant SaaS + B2C marketplace** for salons (Fresha-style). Built as a **pnpm monorepo** with **Turborepo**.

- **Backend:** Node.js + TypeScript + Express 5
- **Database:** PostgreSQL + Drizzle (ORM)
- **Validation:** Zod
- **Auth:** JWT (stateless) + opaque refresh tokens (stateful, hashed at rest)
- **API:** OpenAPI 3.1 generated from Zod schemas, served via Scalar UI at `/docs` in every module — and `/docs` at root for research/docs/task docs

---

## 2. Monorepo Structure

```
apps/
  api/                          # The Express API application (entry point)
    src/
      app.ts                # Creates the Express app (middleware order matters)
      main.ts                # Bootstrap entry
      server.ts                # HTTP server
      boostrap/                # env, shutdown
      config/                # app config
      http/
        middlewares/          # error handling, not-found, logging, auth
        routes/             # health, docs, module mounting
      tests/
configs/
  typescript-config/             # Shared TS configs (base, app, library, test)
infrastructure/
  docker/                # docker-compose
packages/
  infrastructure/
    config/                # @salon/config — env validation
    database/                  # @salon/database
      src/
        client.ts                # Drizzle client wrapper, pool
        database.ts                # Drizzle instance + schema
        schema/
          business/                # tables, FK relations
          RBAC/                   # RBAC tables (dir is RBAC/)
          identity/                # user tables, sessions, refresh token hashes
          customer/
          appointment/
          payment/                 # payments, payment_transactions, refunds
          notification/            # notifications, notification_deliveries, preferences
          review/                  # reviews, review_responses
          media/                   # media_files, service_media
          audit/                   # audit_logs
          shared/                  # id + timestamp helpers
          .../                    # etc.
    events/                  # @salon/events — EMPTY package (src/index.ts is 0 bytes; NO event bus)
    shared/                 # @salon/shared — errors, base repository, utilities
  modules/
    identity/           # @salon/identity — auth, sessions, token rotation (Pattern A reference)
    business/           # @salon/business — tenants, memberships
    branch/             # @salon/branch — locations, opening hours
    service/            # @salon/service — catalog, categories, branch matrix
    staff/              # @salon/staff — profiles, schedules, allocations, portfolio
    rbac/               # @salon/rbac — custom roles, permission matrix, branch context
    customer/           # @salon/customer — CRM, notes, tags, B2C favourites
    appointment/        # @salon/appointment — booking engine, allocations, FSM
    payment/            # @salon/payment — cash capture/refund ONLY (no Stripe/deposits yet)
    review/              # @salon/review — STUB (export {}); tables migrated
    notification/       # @salon/notification — STUB (export {}); tables migrated
    marketplace/        # @salon/marketplace — STUB (export {}); owns NO tables yet
    media/              # @salon/media — not built; tables migrated
    inventory/          # @salon/inventory — not built (deferred)
    administration/      # @salon/administration — STUB (deferred)
    analytics/           # @salon/analytics — STUB (deferred)
    ...
  shared/                 # @salon/shared — errors, repository base
  testing/                # @salon/testing — test utilities
```

---

## 3. Module Architecture Pattern

```
packages/modules/<module-name>/src
  api/
    controllers/                # HTTP controllers (parse req.body, call use cases, respond)
    dtos/                  # Zod schemas for request validation
    docs/                    # OpenAPI registry (zod-to-openapi)
    middlewares/          # module-specific middleware (e.g. branch-scoped auth)
  application/
    ports/                # Interfaces (repositories, services) — the contract inside the module
    use-cases/        # Business logic classes with execute() method
  domain/
    entities/              # Domain entities
  infrastructure/
    repositories/          # Drizzle implementation of ports
    services/               # Concrete services (JwtService, TokenBuilderService)
  index.ts                   # Module factory: wires everything, exports router + expose
```

But: the project is pragmatic. Existing modules may use Clean Architecture, Hexagonal, layered, or pragmatic. **Do not assume every new module must use the same architecture.**

Before implementing a module:
1. Inspect neighbouring/related modules.
2. Read relevant docs.
3. Identify the **simplest** architecture that fits the work.
4. Preserve **existing conventions** unless there is a concrete reason to change.
5. If your choice of architecture materially changes the design / is genuinely ambiguous, **stop and ask the user** before choosing.

### Core Rule: Top-to-Bottom Vertical Slices Only
All feature implementation, module creation, and teaching MUST strictly follow **Top-to-Bottom (Outside-In) Vertical Slicing**. Never implement horizontally across layers. For the exact procedure and feedback loop requirements, follow [.agents/skills/module-implementation/SKILL.md](file:///.agents/skills/module-implementation/SKILL.md).


---

## 4. Module Lifecycle & Execution Phases

Build each module deliberately, one logical module and vertical slice at a time. Never rush or combine phases. Follow the `/build-module` workflow.

### Phase 1 — Understand & Plan
- Inspect existing code, tests, configuration, and docs.
- Determine dependencies and module order.
- Consult relevant Fresha/external behavior via `source-of-truth` skill.
- Identify security, concurrency, and operational edge cases. State what is out of scope.

### Phase 2 — Core Implementation (Vertical Slices)
- Follow **Top-to-Bottom Vertical Slicing** per [.agents/skills/module-implementation/SKILL.md](file:///.agents/skills/module-implementation/SKILL.md).
- Keep business logic strictly at the app/domain boundary.
- Implement Fresha-style business logic and invariants (tenant isolation, duration checks, IDOR protection).
- **Money is never floating point.** It is stored as `numeric(10,2)` and declared by API schemas as a
  validated **decimal string** (e.g. `defaultPrice: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/)`, payment
  `moneyString = z.string()`). Arithmetic happens in **integer minor units** inside
  `packages/modules/payment/src/domain/services/payment-amount.ts` — client payloads are strings, not cents.
- Comment standards: explain the *why* for non-obvious design decisions.

### Phase 3 — Review & Edge Cases
- Review logic, data boundaries, concurrency, and error paths via `security-review` skill.
- Fix meaningful edge cases *before* writing tests.

### Phase 4 & 5 — Tests, Integration & Refinements
- Use `testing` skill and `/test-module` workflow.
- Write minimal unit + API integration tests covering important business, concurrency, and failure edge cases.
- Run `pnpm check` and `pnpm test`. Fix real bugs discovered by tests.

### Phase 6 — Documentation (Gated)
- **Permission Gate**: STOP and ask the user for explicit permission before creating docs.
- When approved, follow `module-documentation` skill and `/document-module` workflow:
  - Write/update module flow docs (`docs/20-backend/30-implementation/10-workflows/<module>/BUSINESS_WORKFLOW.md`, `TECHNICAL_ARCHITECTURE.md`).
  - Create isolated daily bug audit in `docs/90-shared/10-decisions-history/bug-reports/YYYY-MM-DD_<module>_audit.md`.
  - Create learning decision record in `docs/90-shared/10-decisions-history/iadr/DECISION-NNN-<Title>.md`.
  - Update README indexes in both directories.

### Permission Gate — Module Boundaries
Never start the next module without explicit permission from the user.

---

## 5. Architectural invariants (do not violate)

- **`req.body` / request headers** ONLY in `apps/api/controllers`.
- **SQL queries** live ONLY in `packages/infrastructure/database` or `packages/modules/*/infrastructure/repositories`.
- **Business logic** ONLY in `packages/modules/*/application/use-cases`.
- **Domain entities** ONLY in `packages/modules/*/domain/entities`.

### Module Isolation & Database Boundaries (STRICT INVARIANT)
- **A repository MUST ONLY query tables owned by its own module.**
  - Under NO circumstances may a repository in `packages/modules/<module-A>/src/infrastructure/repositories/*` import or execute SQL queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `JOIN`) against database tables owned by `<module-B>`.
  - Directly importing foreign tables (e.g. querying `services`, `staff_members`, `opening_hours` inside `appointment.repository.ts`) is strictly forbidden.
  - **SINGLE SANCTIONED EXCEPTION — `@salon/marketplace` (DECISION-006).** Marketplace is a read-oriented
    (Pattern C) discovery surface and may perform **read-only, tenant-scoped** queries over foreign tables
    (`businesses`, `branches`, `services`, `staff_members`, `reviews`). It must never write to them. This
    exception belongs to Marketplace only; no other module may claim it. See
    `docs/90-shared/10-decisions-history/iadr/DECISION-006-Marketplace-Read-Only-Cross-Module-Access.md`.
- **Cross-module interactions MUST go through Domain Ports and Query Services.**
  - When Module A requires data, snapshots, or validation from Module B:
    1. Module A defines a domain/query port interface in `application/ports/` (e.g. `IServiceQueryPort`, `IStaffQueryPort`, `IBranchQueryPort`).
    2. Module B implements and exports a query service fulfilling that contract (e.g. `StaffQueryService`, `CustomerQueryService`).
    3. The application Use Case in Module A calls the port to retrieve snapshots/state BEFORE invoking its own repository.
    4. Repositories in Module A only receive resolved DTOs and write solely to Module A's tables.
    5. Wiring between modules is done strictly via Dependency Injection in `apps/api/src/http/routes/index.ts`.
- **Precedent**: Follow the standard demonstrated in `@salon/customer` and `@salon/staff`.

### Error handling
- **Client-facing errors** MUST extend `AppError` from `@salon/shared` (forbidden, unauthorized, etc.).
- **Invariant failures** MUST throw plain `Error`, **not UnauthorizedError**.
- **Never leak internal details** to the end-user.

### Authentication & security
- **Short-lived access tokens** (15 min, stateless), **refresh tokens** opaque at rest.
- Refresh token rotation has to be atomic.

### Database migrations (STRICT — violations break every environment)
- **`db:push` is forbidden on shared databases.** It writes the live schema directly and records **nothing** in
  `drizzle.__drizzle_migrations` — that is precisely how dev and test drifted apart on 2026-09-25. The only
  supported flow is `pnpm db:generate <name>` → `pnpm db:migrate`. (`db:push` refuses to run unless
  `ALLOW_DB_PUSH=1` is set explicitly.)
- **Every migration ships as three things:** `NNNN_name.sql` **+** `NNNN_name_snapshot.json` **+** a
  `_journal.json` entry. `packages/infrastructure/database/tests/migration-integrity.test.ts` enforces this —
  an orphaned migration, a duplicate timestamp or a missing snapshot fails `pnpm test`.
- **The journal is the source of truth for what has run.** Never re-order or hand-edit entries after a
  migration has been applied anywhere; never delete a committed migration file.
- **Never trust a table count as proof of parity.** On 2026-09-25 the test database had the *correct* table
  count while silently missing an index and a column. Only a structural comparison is proof:
  `pnpm --filter @salon/database db:verify` (replays the chain into a scratch database, compares schema
  objects, drops the scratch — **never** modifies the target).

---

## 6. Fresha — External docs

Use the `source-of-truth` skill when the task depends on external product/API behaviour.

Don't invent undocumented:
- endpoints
- fields
- states
- perms
- rate limits
- retries
- webhook behavior
- pagination behavior
- lifecycle rules

---

## 7. Module Roadmap

### ✅ DONE
- **Infra:** config, database (all schemas), shared errors, logger, validation
- **Auth & Identity:** register, login, logout, refresh, **refresh-token rotation with labelled CAS outcomes** (hybrid Bearer + HttpOnly refresh cookie)
- **Business & Branch:** tenant setup, business member onboarding, branch management
- **RBAC:** permission matrix, custom roles, owner bypass, `requirePermission` middleware
- **Service & Staff:** service catalog, staff schedules, allocations, portfolio
- **Customer:** CRM, profiles, notes, tags, B2C favourites
- **Appointment:** booking engine, calendar allocations, FSM status transitions

**Partially** Done
- **Payment:** cash capture (full/partial), cash refunds, list/detail, full payment auto-completes the
  appointment. **NOT implemented: Stripe checkout, deposits, gateway webhooks, card/online methods.**
- **Review / Notification / Marketplace / Media:** database tables are migrated, but the packages are stubs
  (`src/index.ts` is `export {}`). No module code exists.
- **`@salon/events`:** empty package (`src/index.ts` is 0 bytes). **There is no event bus.**

### 🎯 Working backlog — the source of truth for what's next
See **[docs/20-backend/30-implementation/BACKLOG.md](docs/20-backend/30-implementation/BACKLOG.md)** for the
prioritised backend work list.

⚠️ **The module order below is NOT a dependency graph.** Marketplace is a *capstone* (it needs a public
ingress layer, a discovery projection, a geo/search index and a review producer first). Notification needs
Redis + BullMQ — neither exists in code yet.

1. **P0 small issues & doc truth** — see BACKLOG.md
2. **P1 architecture decisions** — ~~Marketplace ownership conflict (BE-010)~~ **✅ resolved 2026-09-25 (DECISION-006: read-only, tenant-scoped, Marketplace-only exception)**; geo / search / public-ingress decisions remain open
3. **Review module** — cheapest leaf; tables already migrated; depends only on completed appointments
4. **Media module** — no listing can render without salon imagery
5. **Redis + BullMQ → Notification module** — reminders are the core product value
6. **Marketplace** — decomposed into M1–M7 in BACKLOG.md; events/outbox come **last**, not first