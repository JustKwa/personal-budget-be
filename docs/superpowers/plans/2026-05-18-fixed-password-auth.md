# Fixed Password Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fixed-password authentication with JWT tokens to the personal-budget-be API. A `POST /auth/login` endpoint validates credentials and returns a JWT. Protected routes require a valid `Authorization: Bearer <jwt>` header.

**Architecture:** Factory functions (`createLoginRoute`, `createAuthPlugin`) accept credentials for testability — no `cloudflare:workers` dependency in the setup module. Production exports in `src/auth/index.ts` wire the factories to env vars. The `@elysiajs/jwt` plugin handles JWT signing/verification (built on `jose`), and `@elysiajs/bearer` extracts Bearer tokens. The auth guard uses `onBeforeHandle({ as: 'scoped' })` to protect all routes in the parent instance.

**Tech Stack:** ElysiaJS, @elysiajs/jwt, @elysiajs/bearer, Cloudflare Workers, bun:test

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add @elysiajs/jwt, @elysiajs/bearer dependencies |
| `wrangler.jsonc` | Modify | Add AUTH_PASSWORD and JWT_SECRET vars for local dev |
| `src/auth/setup.ts` | Create | Factory functions for login route and auth plugin (testable, no cloudflare:workers dependency) |
| `src/auth/index.ts` | Create | Production exports reading from cloudflare:workers env |
| `test/auth/login.test.ts` | Create | Login endpoint tests (success, wrong password, missing body) |
| `test/auth/plugin.test.ts` | Create | Auth guard tests (no token, invalid token, valid token) |
| `src/routes/transactions.ts` | Modify | Add authPlugin to protect all transaction routes |
| `src/index.ts` | Modify | Mount loginRoute (public, no auth) |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json` (indirectly via package manager)

- [ ] **Step 1: Install JWT and Bearer packages**

Run:
```bash
bun add @elysiajs/jwt @elysiajs/bearer
```

Expected: `package.json` and `bun.lock` update with `@elysiajs/jwt` and `@elysiajs/bearer`.

- [ ] **Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "deps: add @elysiajs/jwt and @elysiajs/bearer"
```

---

### Task 2: Configure Environment Variables

**Files:**
- Modify: `wrangler.jsonc`

- [ ] **Step 1: Add vars section to wrangler.jsonc**

The current `wrangler.jsonc` content is:

```jsonc
{
  "name": "personal-budget-be",
  "main": "src/index.ts",
  "compatibility_date": "2025-06-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "personal-budget-db",
      "database_id": "9bc00173-af06-4ccc-a46d-65da962debbe"
    }
  ]
}
```

Add a `vars` section for local development defaults:

```jsonc
{
  "name": "personal-budget-be",
  "main": "src/index.ts",
  "compatibility_date": "2025-06-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "personal-budget-db",
      "database_id": "9bc00173-af06-4ccc-a46d-65da962debbe"
    }
  ],
  "vars": {
    "AUTH_PASSWORD": "dev-password",
    "JWT_SECRET": "dev-jwt-secret-change-me"
  }
}
```

These are development-only defaults. For production, set real secrets via `wrangler secret put AUTH_PASSWORD` and `wrangler secret put JWT_SECRET`.

- [ ] **Step 2: Commit**

```bash
git add wrangler.jsonc
git commit -m "config: add AUTH_PASSWORD and JWT_SECRET env vars"
```

---

### Task 3: Create Auth Setup Module and Login Tests (TDD)

**Files:**
- Create: `src/auth/setup.ts`
- Create: `test/auth/login.test.ts`

- [ ] **Step 1: Write the failing test for login**

Create `test/auth/login.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { createLoginRoute } from "../../src/auth/setup";

const TEST_PASSWORD = "correct-password";
const TEST_JWT_SECRET = "test-jwt-secret-really-long-key-that-is-at-least-32-chars";

describe("POST /auth/login", () => {
  const loginRoute = createLoginRoute(TEST_PASSWORD, TEST_JWT_SECRET);

  it("returns a token on valid password", async () => {
    const res = await loginRoute.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: TEST_PASSWORD }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(typeof body.token).toBe("string");
  });

  it("returns 401 on wrong password", async () => {
    const res = await loginRoute.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid credentials" });
  });

  it("returns 400 on missing password in body", async () => {
    const res = await loginRoute.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
bun test test/auth/login.test.ts
```

Expected: All three tests fail because `../../src/auth/setup` does not exist yet.

- [ ] **Step 3: Implement the auth setup module**

Create `src/auth/setup.ts`:

```typescript
import { Elysia, t, status } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { bearer } from "@elysiajs/bearer";

export const createLoginRoute = (authPassword: string, jwtSecret: string) =>
  new Elysia({ prefix: "/auth" })
    .use(jwt({ name: "jwt", secret: jwtSecret, exp: "24h" }))
    .post(
      "/login",
      async ({ body, jwt }) => {
        if (body.password !== authPassword) {
          return status(401, { error: "Invalid credentials" });
        }
        const token = await jwt.sign({ sub: "user" });
        return { token };
      },
      {
        body: t.Object({
          password: t.String(),
        }),
      }
    );

export const createAuthPlugin = (jwtSecret: string) =>
  new Elysia({ name: "auth" })
    .use(bearer())
    .use(jwt({ name: "jwt", secret: jwtSecret, exp: "24h" }))
    .onBeforeHandle({ as: "scoped" }, async ({ bearer, jwt, status }) => {
      if (!bearer) return status(401, { error: "Unauthorized" });
      const payload = await jwt.verify(bearer);
      if (!payload) return status(401, { error: "Unauthorized" });
    });
```

- [ ] **Step 4: Run login tests to verify they pass**

Run:
```bash
bun test test/auth/login.test.ts
```

Expected: All three tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/auth/setup.ts test/auth/login.test.ts
git commit -m "feat: add login route with JWT token generation"
```

---

### Task 4: Create Auth Plugin Tests (TDD)

**Files:**
- Create: `test/auth/plugin.test.ts`

- [ ] **Step 1: Write the failing tests for auth plugin**

Create `test/auth/plugin.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { createLoginRoute, createAuthPlugin } from "../../src/auth/setup";

const TEST_PASSWORD = "correct-password";
const TEST_JWT_SECRET = "test-jwt-secret-really-long-key-that-is-at-least-32-chars";

describe("Auth Plugin", () => {
  const loginRoute = createLoginRoute(TEST_PASSWORD, TEST_JWT_SECRET);
  const authPlugin = createAuthPlugin(TEST_JWT_SECRET);

  const app = new Elysia().use(authPlugin).get("/protected", () => "success");

  async function getValidToken(): Promise<string> {
    const res = await loginRoute.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: TEST_PASSWORD }),
      })
    );
    const body = await res.json();
    return body.token;
  }

  it("returns 401 without Authorization header", async () => {
    const res = await app.handle(new Request("http://localhost/protected"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 with invalid JWT", async () => {
    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: "Bearer invalid-token" },
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 with wrong scheme (not Bearer)", async () => {
    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("allows access with valid JWT from login", async () => {
    const token = await getValidToken();

    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("success");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run:
```bash
bun test test/auth/plugin.test.ts
```

Expected: All four tests pass. (The auth plugin implementation already exists from Task 3.)

- [ ] **Step 3: Run all tests together**

Run:
```bash
bun test test/auth/
```

Expected: All login and plugin tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/auth/plugin.test.ts
git commit -m "test: add auth plugin tests"
```

---

### Task 5: Create Production Auth Module

**Files:**
- Create: `src/auth/index.ts`

- [ ] **Step 1: Create production exports**

Create `src/auth/index.ts`:

```typescript
import { env } from "cloudflare:workers";
import { createAuthPlugin, createLoginRoute } from "./setup";

const { AUTH_PASSWORD, JWT_SECRET } = env as unknown as {
  AUTH_PASSWORD: string;
  JWT_SECRET: string;
};

export const authPlugin = createAuthPlugin(JWT_SECRET);
export const loginRoute = createLoginRoute(AUTH_PASSWORD, JWT_SECRET);
```

This follows the same pattern as `src/db/plugin.ts` — importing env from `cloudflare:workers` and destructuring the needed bindings.

- [ ] **Step 2: Commit**

```bash
git add src/auth/index.ts
git commit -m "feat: add production auth exports with cloudflare env"
```

---

### Task 6: Wire Up Routes

**Files:**
- Modify: `src/routes/transactions.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add authPlugin to transactions route**

The current `src/routes/transactions.ts` starts with:

```typescript
import { eq } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { dbPlugin } from "../db/plugin";
import { transactions } from "../db/schema";

export const transactionsRoute = new Elysia({ prefix: "/transactions" })
  .use(dbPlugin)
```

Add the auth import and `.use(authPlugin)` before `.use(dbPlugin)`:

```typescript
import { eq } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { authPlugin } from "../auth";
import { dbPlugin } from "../db/plugin";
import { transactions } from "../db/schema";

export const transactionsRoute = new Elysia({ prefix: "/transactions" })
  .use(authPlugin)
  .use(dbPlugin)
```

The rest of the file remains unchanged. `authPlugin` is placed first so its scoped `onBeforeHandle` guard applies to all transaction routes.

- [ ] **Step 2: Mount loginRoute in main app**

The current `src/index.ts` is:

```typescript
import { cors } from "@elysia/cors";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { dbPlugin } from "./db/plugin";
import { transactionsRoute } from "./routes/transactions";
import openapi from "@elysia/openapi";

export default new Elysia({ adapter: CloudflareAdapter })
  .use(dbPlugin)
  .use(cors())
  .use(openapi())
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") return;
    console.error(`[${code}]`, error);
    set.status = 500;
    return { error: "Internal server error", detail: (error as Error).message };
  })
  .get('/', () => "Okay")
  .use(transactionsRoute)
  .compile();
```

Add the `loginRoute` import and mount it before `transactionsRoute`:

```typescript
import { cors } from "@elysia/cors";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { authPlugin } from "./auth";
import { dbPlugin } from "./db/plugin";
import { loginRoute } from "./auth";
import { transactionsRoute } from "./routes/transactions";
import openapi from "@elysia/openapi";

export default new Elysia({ adapter: CloudflareAdapter })
  .use(dbPlugin)
  .use(cors())
  .use(openapi())
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") return;
    console.error(`[${code}]`, error);
    set.status = 500;
    return { error: "Internal server error", detail: (error as Error).message };
  })
  .get('/', () => "Okay")
  .use(loginRoute)
  .use(transactionsRoute)
  .compile();
```

Wait, that imports `authPlugin` and `loginRoute` separately but `authPlugin` is only used in `transactionsRoute`. Let me fix this — `authPlugin` should NOT be imported in `index.ts`, only `loginRoute` is needed there. `authPlugin` is imported in `transactionsRoute`.

Correct `src/index.ts`:

```typescript
import { cors } from "@elysia/cors";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { dbPlugin } from "./db/plugin";
import { loginRoute } from "./auth";
import { transactionsRoute } from "./routes/transactions";
import openapi from "@elysia/openapi";

export default new Elysia({ adapter: CloudflareAdapter })
  .use(dbPlugin)
  .use(cors())
  .use(openapi())
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") return;
    console.error(`[${code}]`, error);
    set.status = 500;
    return { error: "Internal server error", detail: (error as Error).message };
  })
  .get('/', () => "Okay")
  .use(loginRoute)
  .use(transactionsRoute)
  .compile();
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/transactions.ts src/index.ts
git commit -m "feat: wire up auth - protect transactions, mount login route"
```

---

### Task 7: Manual Verification

**Files:**
- None (runtime verification)

- [ ] **Step 1: Start local dev server**

Run:
```bash
bun run dev
```

Expected: Wrangler dev server starts on `http://localhost:8787`.

- [ ] **Step 2: Verify health check still works (no auth)**

```bash
curl http://localhost:8787/
```

Expected: `"Okay"`

- [ ] **Step 3: Verify transactions require auth (returns 401)**

```bash
curl http://localhost:8787/transactions
```

Expected: HTTP 401 with body `{"error":"Unauthorized"}`

- [ ] **Step 4: Verify login with wrong password returns 401**

```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "wrong-password"}'
```

Expected: HTTP 401 with body `{"error":"Invalid credentials"}`

- [ ] **Step 5: Verify login with correct password returns token**

```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "dev-password"}'
```

Expected: HTTP 200 with body `{"token":"<jwt-string>"}`. Copy the token value.

- [ ] **Step 6: Verify transactions work with valid token**

Replace `<token>` with the token from Step 5:

```bash
curl http://localhost:8787/transactions \
  -H "Authorization: Bearer <token>"
```

Expected: HTTP 200 with transactions list (may be empty array `[]`).

- [ ] **Step 7: Stop dev server**

Press `Ctrl+C` in the dev server terminal.

- [ ] **Step 8: Commit**

```bash
git commit --allow-empty -m "test: verify auth manually via curl"
```

---

### Task 8: Set Production Secrets

**Files:**
- None (Cloudflare config)

- [ ] **Step 1: Set AUTH_PASSWORD production secret**

```bash
bunx wrangler secret put AUTH_PASSWORD
```

When prompted, enter the production password. This stores it encrypted in Cloudflare.

- [ ] **Step 2: Set JWT_SECRET production secret**

```bash
bunx wrangler secret put JWT_SECRET
```

When prompted, enter a strong random string (at least 32 characters). This stores it encrypted in Cloudflare.

> **Important:** Never commit real secrets to `wrangler.jsonc`. The `vars` section contains development defaults only. Production secrets are managed via `wrangler secret put`.

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] `POST /auth/login` endpoint accepts `{ password }` and validates against `AUTH_PASSWORD` → Task 3
- [x] Login returns JWT with 24h expiry on success → Task 3 (`exp: "24h"` in JWT config)
- [x] Login returns 401 on wrong password → Task 3
- [x] Login returns 400 on missing body (Elysia validation) → Task 3
- [x] `authPlugin` with `onBeforeHandle` guard → Task 3
- [x] Guard checks Bearer token from Authorization header → Task 3 (via `@elysiajs/bearer`)
- [x] Guard verifies JWT using `JWT_SECRET` → Task 3
- [x] Guard returns 401 with `{ error: "Unauthorized" }` for missing/invalid/expired tokens → Task 3
- [x] Transactions route protected with `authPlugin` → Task 6
- [x] Health check `/` remains public → Task 6 (not modified, loginRoute mounted separately)
- [x] Login route mounted at `/auth/login` (public, no auth) → Task 6
- [x] Environment variables `AUTH_PASSWORD` and `JWT_SECRET` in `wrangler.jsonc` → Task 2
- [x] Production secrets via `wrangler secret put` → Task 8

**2. Placeholder scan:**
- No "TBD", "TODO", "implement later", or vague instructions found.
- Every code block contains complete, runnable code.
- Every command has expected output described.

**3. Type consistency:**
- `createLoginRoute(authPassword: string, jwtSecret: string)` — used consistently across setup, tests, and index.ts
- `createAuthPlugin(jwtSecret: string)` — used consistently across setup, tests, and transactions route
- `authPlugin` export from `src/auth/index.ts` — imported in `src/routes/transactions.ts`
- `loginRoute` export from `src/auth/index.ts` — imported in `src/index.ts`
- JWT config `{ name: "jwt", secret: jwtSecret, exp: "24h" }` — same config in both login and auth plugin factories (same secret enables cross-verification)
- Error response shapes match spec: `{ error: "Invalid credentials" }` for login, `{ error: "Unauthorized" }` for auth guard

**4. Scope check:**
- Plan covers exactly one feature: fixed-password authentication with JWT
- No unrelated refactoring included
- Production secret setup (Task 8) is included for completeness but is a simple operational step