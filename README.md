# Salon Platform

A multi-tenant SaaS and B2C marketplace backend for salon management, appointment scheduling, and client discovery. Built with Node.js, Express 5, TypeScript, and PostgreSQL in a modular monorepo.

---

## Overview

The platform provides a unified backend powering both business operations and client-facing booking flows:

- **Business Management**: Multi-tenant salon administration, branch configuration, staff management, service catalog, opening hours, and calendar scheduling.
- **Client Marketplace**: Salon and service discovery, real-time availability checks, online booking, and verified reviews.
- **Enterprise Core**: Strict tenant isolation, atomic state transitions, stateless JWT + hashed refresh token authentication, and comprehensive auditability.

---

## Architecture

The project is structured as a **modular monolith** managed via Turborepo and pnpm workspaces:

```text
salon-project/
├── apps/
│   └── api/                  # Express 5 API gateway & HTTP runtime
├── packages/
│   ├── infrastructure/       # Foundational packages
│   │   ├── config/           # Environment configuration & Zod schemas
│   │   ├── database/         # Drizzle ORM schema, migrations & client
│   │   ├── events/           # Event bus infrastructure
│   │   ├── logger/           # Structured logging (Pino)
│   │   └── validation/       # Shared validation utilities
│   ├── modules/              # Domain modules
│   │   ├── identity/         # Authentication, tokens & sessions
│   │   ├── business/         # Business profiles & ownership
│   │   ├── branch/           # Locations & operating schedules
│   │   ├── service/          # Service catalogs & categories
│   │   ├── staff/            # Staff profiles, rosters & assignments
│   │   ├── customer/         # Client records & CRM
│   │   ├── appointment/      # Booking engine & calendar
│   │   ├── payment/          # Transactions & Stripe integration
│   │   └── marketplace/      # Public discovery & search
│   ├── shared/               # Domain errors, results & base abstractions
│   └── testing/              # Test utilities, mocks & factories
```

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime & Language** | Node.js (>= 24), TypeScript |
| **HTTP Framework** | Express 5 |
| **Database & ORM** | PostgreSQL, Drizzle ORM |
| **Workspace & Build** | pnpm Workspaces, Turborepo |
| **Validation & Docs** | Zod, OpenAPI 3.1, Scalar |
| **Linting & Code Quality** | Biome, Dependency Cruiser |
| **Testing** | Vitest, Supertest |

---

## Getting Started

### Prerequisites

- **Node.js**: `v24.16.0` or higher
- **pnpm**: `v11.5.0` or higher
- **PostgreSQL**: `v16` or higher

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/salon-project.git
   cd salon-project
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Update `.env` with your PostgreSQL database credentials.*

4. **Setup database:**
   ```bash
   pnpm --filter @salon/database db:push
   ```

5. **Start development server:**
   ```bash
   pnpm dev
   ```

The API will be available at `http://localhost:3000`.

---

## Interactive API Documentation

Interactive OpenAPI documentation is served via Scalar UI at:

```
http://localhost:3000/docs
```

---

## Development Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Start the API server in watch mode |
| `pnpm build` | Build all packages and applications |
| `pnpm test` | Run test suites across the monorepo |
| `pnpm test:watch` | Run tests in interactive watch mode |
| `pnpm check` | Run typechecking, Biome checks, and dependency rules |
| `pnpm format` | Auto-format codebase with Biome |
| `pnpm depcruise` | Verify module boundary and architectural constraints |

---

## License

Private and proprietary. All rights reserved.