# Transactions CRUD API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready REST CRUD API for `Transaction` records using ElysiaJS on Cloudflare Workers, backed by Cloudflare D1 (SQLite) and Drizzle ORM.

**Architecture:** A single Elysia plugin (`src/routes/transactions.ts`) mounted in the main Worker entry (`src/index.ts`) exposes CRUD endpoints under `/transactions`. Drizzle ORM handles all SQL generation; D1 provides persistence. A `derive` hook injects the Drizzle client into request context so handlers remain pure business logic.

**Tech Stack:** ElysiaJS, Cloudflare Workers, Cloudflare D1, Drizzle ORM, TypeScript, Wrangler

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `drizzle-orm`, `drizzle-kit`, `wrangler`, `@cloudflare/workers-types`; update scripts |
| `tsconfig.json` | Modify | Replace `bun-types` with `@cloudflare/workers-types` |
| `wrangler.jsonc` | Create | Cloudflare Worker config + D1 database binding |
| `drizzle.config.ts` | Create | Drizzle ORM schema-to-SQL generator config |
| `src/db/schema.ts` | Create | Drizzle table definition for `transactions` |
| `src/db/index.ts` | Create | Factory function that wraps a `D1Database` into a Drizzle client |
| `src/routes/transactions.ts` | Create | Elysia plugin with all CRUD handlers |
| `src/index.ts` | Modify | Worker entrypoint: Cloudflare adapter, D1 binding, mount routes, `.compile()` |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json` (indirectly via package manager)

- [ ] **Step 1: Add runtime and dev dependencies**

Run:
```bash
bun add drizzle-orm
bun add -d drizzle-kit wrangler @cloudflare/workers-types
```

Expected: `bun.lock` updates, `node_modules` now contains `drizzle-orm`, `drizzle-kit`, `wrangler`, `@cloudflare/workers-types`.

- [ ] **Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "deps: add drizzle-orm, drizzle-kit, wrangler, workers-types"
```

---

### Task 2: Configure Project Files

**Files:**
- Create: `wrangler.jsonc`
- Modify: `tsconfig.json`
- Modify: `package.json`

- [ ] **Step 1: Create `wrangler.jsonc`**

```jsonc
{
  "name": "personal-budget-be",
  "main": "src/index.ts",
  "compatibility_date": "2025-06-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "personal-budget-db",
      "database_id": ""
    }
  ]
}
```

> Leave `database_id` empty for now. It will be filled in after creating the D1 database in Task 7.

- [ ] **Step 2: Update `tsconfig.json` types**

Replace line:
```json
    "types": ["bun-types"],
```

With:
```json
    "types": ["@cloudflare/workers-types"],
```

- [ ] **Step 3: Update `package.json` scripts**

Replace the `scripts` section:
```json
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:generate": "drizzle-kit generate"
  },
```

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc tsconfig.json package.json
git commit -m "config: add wrangler, tsconfig workers types, scripts"
```

---

### Task 3: Set Up Drizzle Schema and Config

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
```

> This config tells `drizzle-kit generate` to read `./src/db/schema.ts` and emit SQLite-compatible SQL into `./drizzle/`. No database credentials are required for generation.

- [ ] **Step 2: Create `src/db/schema.ts`**

```typescript
import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
```

> `Transaction` is inferred directly from the Drizzle schema, so the API response type stays in sync with the database.

- [ ] **Step 3: Commit**

```bash
git add drizzle.config.ts src/db/schema.ts
git commit -m "db: add drizzle config and transactions schema"
```

---

### Task 4: Create Database Client Factory

**Files:**
- Create: `src/db/index.ts`

- [ ] **Step 1: Create `src/db/index.ts`**

```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof createDb>;
```

> `createDb` takes a raw Cloudflare D1 binding and returns a typed Drizzle client. All route handlers will receive this via Elysia context injection.

- [ ] **Step 2: Commit**

```bash
git add src/db/index.ts
git commit -m "db: add D1 drizzle client factory"
```

---

### Task 5: Create Transactions Route Plugin

**Files:**
- Create: `src/routes/transactions.ts`

- [ ] **Step 1: Create `src/routes/transactions.ts`**

```typescript
import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { transactions } from "../db/schema";
import type { DB } from "../db";

export const transactionsRoute = new Elysia({ prefix: "/transactions" })
  .get("/", async ({ db }: { db: DB }) => {
    const all = await db.select().from(transactions).all();
    return all;
  })

  .post(
    "/",
    async ({ db, body }: { db: DB; body: { amount: number; description: string } }) => {
      const id = crypto.randomUUID();
      const createdAt = Date.now();

      await db
        .insert(transactions)
        .values({ id, amount: body.amount, description: body.description, createdAt })
        .run();

      return { id, amount: body.amount, description: body.description, createdAt };
    },
    {
      body: t.Object({
        amount: t.Number(),
        description: t.String(),
      }),
    }
  )

  .get("/:id", async ({ db, params, set }: { db: DB; params: { id: string }; set: any }) => {
    const tx = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, params.id))
      .get();

    if (!tx) {
      set.status = 404;
      return { error: "Transaction not found" };
    }

    return tx;
  })

  .put(
    "/:id",
    async ({
      db,
      params,
      body,
      set,
    }: {
      db: DB;
      params: { id: string };
      body: { amount: number; description: string };
      set: any;
    }) => {
      await db
        .update(transactions)
        .set({ amount: body.amount, description: body.description })
        .where(eq(transactions.id, params.id))
        .run();

      const tx = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, params.id))
        .get();

      if (!tx) {
        set.status = 404;
        return { error: "Transaction not found" };
      }

      return tx;
    },
    {
      body: t.Object({
        amount: t.Number(),
        description: t.String(),
      }),
    }
  )

  .delete("/:id", async ({ db, params }: { db: DB; params: { id: string } }) => {
    await db.delete(transactions).where(eq(transactions.id, params.id)).run();
    return { success: true };
  });
```

> Each handler destructures `db` from context (injected in `src/index.ts`). `set.status = 404` returns the correct HTTP status for missing records. `crypto.randomUUID()` is globally available in Cloudflare Workers.

- [ ] **Step 2: Commit**

```bash
git add src/routes/transactions.ts
git commit -m "feat: add transactions CRUD route plugin"
```

---

### Task 6: Update Main Entrypoint

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Rewrite `src/index.ts`**

```typescript
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { env } from "cloudflare:workers";
import { createDb } from "./db";
import { transactionsRoute } from "./routes/transactions";

const { DB } = env as unknown as { DB: D1Database };

export default new Elysia({ adapter: CloudflareAdapter })
  .derive(() => {
    const db = createDb(DB);
    return { db };
  })
  .use(transactionsRoute)
  .compile();
```

> `CloudflareAdapter` tells Elysia to compile for the Workers runtime. `.derive()` injects the Drizzle client into every request context so routes can destructure `db`. `env` from `cloudflare:workers` provides the D1 binding.

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up Cloudflare adapter, D1 binding, and transactions routes"
```

---

### Task 7: Create D1 Database and Apply Migration

**Files:**
- Modify: `wrangler.jsonc` (fill in `database_id`)

- [ ] **Step 1: Log in to Wrangler (if not already)**

Run:
```bash
bunx wrangler login
```

Expected: Opens a browser to authenticate with Cloudflare. Complete the OAuth flow.

- [ ] **Step 2: Create the D1 database**

Run:
```bash
bunx wrangler d1 create personal-budget-db
```

Expected output contains a line like:
```
database_id = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Copy that UUID.

- [ ] **Step 3: Update `wrangler.jsonc` with the database ID**

Edit `wrangler.jsonc` and replace `"database_id": ""` with the UUID from Step 2:

```jsonc
{
  "name": "personal-budget-be",
  "main": "src/index.ts",
  "compatibility_date": "2025-06-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "personal-budget-db",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ]
}
```

- [ ] **Step 4: Generate migration SQL from schema**

Run:
```bash
bunx drizzle-kit generate
```

Expected: Creates a file like `drizzle/0000_xxxx.sql` containing:
```sql
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL
);
```

- [ ] **Step 5: Apply migration to local D1**

Run:
```bash
bunx wrangler d1 execute personal-budget-db --local --file=./drizzle/0000_xxxx.sql
```

> Replace `0000_xxxx.sql` with the actual filename generated in Step 4.

Expected: Command succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc drizzle/
git commit -m "db: create D1 database, generate and apply initial migration"
```

---

### Task 8: Manual Testing

**Files:**
- None (runtime verification)

- [ ] **Step 1: Start local dev server**

Run:
```bash
bun run dev
```

Expected: Wrangler dev server starts on `http://localhost:8787`.

- [ ] **Step 2: Test `POST /transactions`**

In a new terminal, run:
```bash
curl -X POST http://localhost:8787/transactions \
  -H "Content-Type: application/json" \
  -d '{"amount": 100.50, "description": "Grocery shopping"}'
```

Expected response (approximate):
```json
{"id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","amount":100.5,"description":"Grocery shopping","createdAt":1234567890123}
```

Copy the `id` from the response.

- [ ] **Step 3: Test `GET /transactions`**

Run:
```bash
curl http://localhost:8787/transactions
```

Expected response:
```json
[{"id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","amount":100.5,"description":"Grocery shopping","createdAt":1234567890123}]
```

- [ ] **Step 4: Test `GET /transactions/:id`**

Replace `<id>` with the ID from Step 2:
```bash
curl http://localhost:8787/transactions/<id>
```

Expected response:
```json
{"id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","amount":100.5,"description":"Grocery shopping","createdAt":1234567890123}
```

- [ ] **Step 5: Test `PUT /transactions/:id`**

Replace `<id>` with the ID from Step 2:
```bash
curl -X PUT http://localhost:8787/transactions/<id> \
  -H "Content-Type: application/json" \
  -d '{"amount": 150.00, "description": "Updated grocery shopping"}'
```

Expected response:
```json
{"id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","amount":150,"description":"Updated grocery shopping","createdAt":1234567890123}
```

- [ ] **Step 6: Test `DELETE /transactions/:id`**

Replace `<id>` with the ID from Step 2:
```bash
curl -X DELETE http://localhost:8787/transactions/<id>
```

Expected response:
```json
{"success":true}
```

- [ ] **Step 7: Verify 404 on deleted resource**

Run:
```bash
curl http://localhost:8787/transactions/<id>
```

Expected: HTTP 404 with body:
```json
{"error":"Transaction not found"}
```

- [ ] **Step 8: Stop dev server**

Press `Ctrl+C` in the dev server terminal.

- [ ] **Step 9: Commit**

```bash
git commit --allow-empty -m "test: verify transactions CRUD manually via curl"
```

---

### Task 9: Deploy to Cloudflare (Optional but Recommended)

**Files:**
- None

- [ ] **Step 1: Apply migration to production D1**

Run:
```bash
bunx wrangler d1 execute personal-budget-db --file=./drizzle/0000_xxxx.sql
```

> Replace `0000_xxxx.sql` with the actual filename from Task 7.

- [ ] **Step 2: Deploy the Worker**

Run:
```bash
bun run deploy
```

Expected: Wrangler bundles and deploys the Worker. Output contains the production URL.

- [ ] **Step 3: Verify on production**

Run the same curl commands from Task 8 against the production URL.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "deploy: deploy transactions API to Cloudflare Workers"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Full CRUD (GET list, POST, GET single, PUT, DELETE) → Task 5
- [x] Transaction schema (id, amount, description, createdAt) → Task 3
- [x] UUID generation on create → Task 5 (`crypto.randomUUID()`)
- [x] createdAt auto-generation → Task 5 (`Date.now()`)
- [x] 404 for missing records → Task 5 (`set.status = 404`)
- [x] D1 persistence → Tasks 3, 4, 7
- [x] Drizzle ORM integration → Tasks 3, 4
- [x] Cloudflare Workers deployment → Tasks 2, 6, 9
- [x] Manual testing steps → Task 8

**2. Placeholder scan:**
- No "TBD", "TODO", "implement later", or vague instructions found.
- Every code block contains complete, runnable code.
- Every command has expected output described.

**3. Type consistency:**
- `DB` type defined in `src/db/index.ts` and used consistently in `src/routes/transactions.ts`.
- `Transaction` type inferred from Drizzle schema in `src/db/schema.ts`.
- `env.DB` cast to `{ DB: D1Database }` matches the `createDb` parameter type.
- Property names (`amount`, `description`, `createdAt`, `id`) match the spec exactly.

**4. Scope check:**
- Plan covers exactly one subsystem: transactions CRUD API.
- No unrelated refactoring included.
- Auth, pagination, and automated tests are explicitly out of scope per the design spec.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-transactions-crud-api.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
