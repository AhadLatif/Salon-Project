# AGENTS.md — Salon Platform Project Guide

This file gives AI agents (Cline, Copilot, etc.) the ground truth about this repository. Read it before making changes. It prevents agents from rebuilding what exists or violating the architecture.

## 0. How to use this repository's agent system

This repository separates four kinds of guidance:
- `AGENTS.md` — rules that apply broadly to every task.
- `.agents/skills/` — specialized procedures used when a task matches a skill.
- `.agents/workflows/` — explicit multi-step procedures for major activities such as building, testing, documenting a module.
- `docs/` — project knowledge, research, decisions, module flows, history.
- `docs/BUGS_REPORT.md` — bug log with the established format.

The agent should not assume every Markdown file in `docs/` is a skill. Skills live under `.agents/skills/<skill-name>/SKILL.md`.

When a workflow or skill says to inspect project documentation, read the relevant files from `docs/` before deciding.

### Instruction precedence

When instructions conflict:
1. Safety, security, platform/tool constraints win.
2. Explicit user instructions for the current task win.
3. This `AGENTS.md` applies repository-wide.
4. A matching workflow controls that activity.
5. A matching skill controls that specialized procedure.
6. `docs/` provides project-specific knowledge and context.
7. The `BUGS_REPORT.md` documents meaningful bugs and fixes.

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
  api/ lenker                    # The Express API application (entry point)
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
          salon/                  # RBAC tables
          identity/                # user tables, sessions, refresh token hashes
          customer/
          appointment/
          .../                    # etc.
    events/                  # @salon/events (EventBus scaffolding)
    shared/                 # @salon/shared — errors, base repository, utilities
    testing/                # @salon/testing
  modules/
    admin/              # @salon/administration — administration module
    analytics/           # @salon/analytics — (deferred)
    appointment/        # @salon/appointment — booking engine
    notification/       # @salon/notification — SMS/email
    payment/            # @salon/payment — Stripe billing
    review/              # @salon/review — ratings & comments
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
    repos/                 # Drizzle implementation of ports
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

### The 7-Step Module Checklist (kept as a useful default, not a rule)

Build modules following this order:

1. **Define the PORT** (`application/ports/`)
2. **Implement the REPOSITORY** (in `infrastructure/repos/`)
3. **Write the USE CASE** in `application/use-cases/` (top-down, `execute()` reveals deps)
4. **Create the CONTROLLER** in `api/controllers/`
5. **Define the schemas** in `api/dtos/`
6. **Add the OpenAPI registry** (`api/docs/`)
7. **Wire the module factory** (`index.ts`) + mount it in `apps/api/src/http/routes/index.ts`

---

## 4. Execution Workflow & phase lifecycle

For quality, security, and learning outcomes: **build each module strictly phase-by-phase**. Never rush or combine all phases.

## 4. Module lifecycle

Each module is built deliberately and one logical module at a time.

### Phase 1 — Understand and plan
- Inspect existing code, tests, configuration, docs.
- Determine dependencies and module order
- Check relevant external docs (Fresha-style behavior)
- Identify security/operational edge cases
- Decide what is out of scope

### Phase 2 — Core implementation
- Use the module's chosen style.
- Keep *business logic* at the app/domain boundary.
- Refrain from speculative abstractions / features.
- Follow the 7-step (ports → reposs → use-cases → controllers → dtos → OpenAPI → wire and mount)
- Implement Fresha-style business logic and security edge cases (tenant time, price precision, duration checks, IDOR protection)
- Comments standard: add useful, well-written comments explaining the *why*, not shallow/AI junk.

### Phase 3 — Review and fix issues
- Review for logic, data, security, business, concurrency, integration.
- Fix *meaningful* *edge cases* *before* the tests.

### Phase 4 — Tests and integration
- Use the `testing` skill.
- Inspect before writing tests.
- Write minimal unit + API tests that cover *important* failure/security/business/retry edge cases.

### Phase 5 — Test fixes + refinements
- Run `pnpm check` and `pnpm test` as applicable.
- Fix real bugs / edge cases discovered by tests.
- Re-review security/business edge cases.

### Phase 6 — Docs
- Use `module-documentation` skill.
- Write/update module *flow docs*.
- Update `docs/BUGS_REPORT.md`.
- Log the meaningful mistakes/fixes.

### Permission gate — Documentation
After implementation + tests: **ASK the USER for Explicit permission** to create docs.

### Permission gate — Module boundaries
Only when explicitly permitted.

---

## 5. Architectural invariants (do not violate)

- **`req.body` / request headers** ONLY in `apps/api/controllers`.
- **SQL queries** live ONLY in `packages/infrastructure/database` (repos).
- **Business logic** ONLY in `packages/modules/*/application/use-cases`.
- **Domain entities** ONLY in `packages/modules/*/domain/entities`.

### Error handling
- **Client-facing errors** MUST extend `AppError` from `@salon/shared` (forbidden, unauthorized, etc.).
- **Invariant failures** MUST throw plain `Error`, **not UnauthorizedError**.
- **Never leak internal details** to the end-user.

### Authentication & security
- **Short-lived access tokens** (15 min, stateless), **refresh tokens** opaque at rest.
- Refresh token rotation has to be atomic.

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
- **Infra:** config, database(all schema), shared errors, logger, validation
- **Auth:** register, login, logout, refresh
- **Business module:** tenant setup, business member onboarding, owner RBAC grant
- **RBAC:** permission matrix, custom roles, owner bypass, `requirePermission` middleware

### 🔜 NEXT (in logical order)
1. **Customer module** — CRM, profiles, notes, media.
2. **Appointment module** — availability engine, booking calendar, locks.
3. **Marketplace module** — discovery, search by service.
4. **Payment module** — Stripe checkout, deposits, idempotency.
5. **Notification module** — event-driven reminders.
6. **Review module** — ratings & reviews.

### Key ordering principle
- **Customer before Appointment:** requires a customer *to book*.
- **Appointment requires:** branch, service, **AND active staff** — all exist.
- **Business → Branch → Service → StaffMember → Appointment** — and matches the Fresha platform.