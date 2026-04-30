# Transactions CRUD API Design

**Date:** 2026-04-30  
**Topic:** Transactions CRUD API  
**Status:** Approved

## Overview

Add a RESTful CRUD API for managing `Transaction` records in the `personal-budget-be` ElysiaJS backend, backed by Cloudflare D1 (SQLite) and Drizzle ORM.

## Goals

- Provide full CRUD operations for transactions
- Persist data across deploys on Cloudflare Workers
- Keep the implementation minimal and type-safe
- Enable immediate deployment to Cloudflare

## Non-Goals

- Authentication / authorization
- Pagination, filtering, or sorting on list endpoint
- Multi-user support
- Automated test suite (manual verification for now)

## Schema

```ts
export interface Transaction {
  id: string;           // UUID v4
  amount: number;       // Can be positive (income) or negative (expense)
  description: string;
  createdAt: number;    // Unix timestamp in milliseconds
}
```

Drizzle table definition:

```ts
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

## API Endpoints

Base path: `/transactions`

| Method | Path                | Description                  | Request Body                              | Response Body        |
|--------|---------------------|------------------------------|-------------------------------------------|----------------------|
| GET    | `/transactions`     | List all transactions        | —                                         | `Transaction[]`      |
| POST   | `/transactions`     | Create a new transaction     | `{ amount: number, description: string }` | `Transaction`        |
| GET    | `/transactions/:id` | Get a single transaction     | —                                         | `Transaction`        |
| PUT    | `/transactions/:id` | Update a transaction         | `{ amount: number, description: string }` | `Transaction`        |
| DELETE | `/transactions/:id` | Delete a transaction         | —                                         | `{ success: true }`  |

**Notes:**
- `id` is auto-generated as UUID v4 on `POST`.
- `createdAt` is auto-generated as `Date.now()` on `POST`.
- `PUT` only mutates `amount` and `description`; `id` and `createdAt` are immutable.

## Error Handling

| Scenario                | HTTP Status | Response Body                                      |
|-------------------------|-------------|----------------------------------------------------|
| Validation error        | 400         | Elysia default validation error JSON               |
| Transaction not found   | 404         | `{ error: "Transaction not found" }`               |
| Database / server error | 500         | `{ error: "Internal server error" }`               |

## Architecture

```
src/
├── index.ts              # Worker entrypoint; binds D1; mounts routes
├── db/
│   ├── schema.ts         # Drizzle table definitions
│   └── index.ts          # Drizzle client factory (uses env.DB)
└── routes/
    └── transactions.ts   # Elysia plugin with all CRUD handlers
```

### Data Flow

1. Worker receives request → `src/index.ts`
2. Elysia app injects `db` (Drizzle client) into request context via `derive`
3. Request routed to `transactions` plugin in `src/routes/transactions.ts`
4. Handler executes Drizzle query against D1
5. Response returned as JSON

## Deployment

- Runs as a Cloudflare Worker
- D1 database bound via `wrangler.toml` / `wrangler.jsonc`
- Local development via `wrangler dev`
- Production deploy via `wrangler deploy`

## Dependencies to Add

- `drizzle-orm`
- `drizzle-kit` (dev, for migrations)
- `@cloudflare/workers-types` (dev)
- `wrangler` (dev)

## Migration Strategy

A single initial migration creates the `transactions` table. Run via `drizzle-kit migrate` against the D1 database.

## Future Considerations

- Add pagination to `GET /transactions` if the list grows large
- Add filtering by date range or amount
- Add authentication if the app becomes multi-user
- Add automated tests (e.g., Vitest + Miniflare) when the API stabilizes
