# Fixed Password Authentication

## Overview

Add authentication via a fixed password stored in an environment variable. All routes except the health check (`/`) require a valid `Authorization: Bearer <password>` header. Invalid or missing credentials return `401 Unauthorized`.

## Approach

**Auth plugin on protected routes only.** An Elysia plugin (`authPlugin`) wraps the auth check logic and is applied explicitly to routes that need protection. The root `/` health check remains untouched.

## Environment Variable

- **`AUTH_PASSWORD`** — the fixed password, configured as a Cloudflare Workers env var
- Declared in `wrangler.jsonc` under `vars` for local development and type safety
- For production, set via `wrangler secret put AUTH_PASSWORD` (or Cloudflare dashboard)

## Components

### `src/auth/plugin.ts`

- Exports `authPlugin` (Elysia plugin)
- Uses `onBeforeHandle` lifecycle hook to intercept requests before route handlers
- Extracts the `Authorization` header, validates the `Bearer` scheme
- Compares the provided token against `env.AUTH_PASSWORD`
- Returns `401 { error: "Unauthorized" }` on missing or invalid credentials
- Accesses env via Elysia context (`{ env }`) which is typed through Cloudflare adapter's `Env` type

### Type augmentation for Cloudflare `Env`

- Augment the Cloudflare Workers `Env` type to include `AUTH_PASSWORD: string`
- This ensures TypeScript correctness when accessing `env.AUTH_PASSWORD`

### `src/routes/transactions.ts`

- Import and `.use(authPlugin)` to protect all transaction routes

### `wrangler.jsonc`

- Add `"AUTH_PASSWORD"` to `vars` array for local development binding

## Error Responses

| Scenario | Status | Body |
|----------|--------|------|
| Missing Authorization header | 401 | `{ "error": "Unauthorized" }` |
| Invalid scheme (not Bearer) | 401 | `{ "error": "Unauthorized" }` |
| Wrong password | 401 | `{ "error": "Unauthorized" }` |

All failure cases return the same response to avoid information leakage.

## What stays the same

- `src/index.ts` — no auth plugin at root level, `/` remains public
- Transaction route logic — unchanged, only gets auth guard applied via plugin