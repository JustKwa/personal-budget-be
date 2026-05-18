# Fixed Password Authentication

## Overview

Add authentication via a fixed password stored in an environment variable. A `/auth/login` endpoint validates the password and returns a JWT. Protected routes require a valid `Authorization: Bearer <jwt>` header. The health check (`/`) remains public.

## Approach

**Auth plugin on protected routes only.** Login is a public route under `/auth`. The `authPlugin` verifies the JWT and is applied explicitly to routes that need protection. The root `/` health check remains untouched.

## Environment Variables

- **`AUTH_PASSWORD`** — the fixed password checked by the login endpoint
- **`JWT_SECRET`** — secret key used to sign and verify JWT tokens (separate from `AUTH_PASSWORD` to allow independent rotation)
- Both declared in `wrangler.jsonc` under `vars` for local development
- For production, set via `wrangler secret put` (or Cloudflare dashboard)

## Components

### `src/auth/login.ts`

- Exports `loginRoute` (Elysia route plugin, prefix `/auth`)
- `POST /auth/login` — accepts `{ password: string }` body
- Compares `password` against `env.AUTH_PASSWORD`
- On success: signs a JWT with `env.JWT_SECRET`, expires in 24h, returns `{ token: <jwt> }`
- On failure: returns `401 { error: "Invalid credentials" }`

### `src/auth/plugin.ts`

- Exports `authPlugin` (Elysia plugin)
- Uses `onBeforeHandle` lifecycle hook to intercept requests before route handlers
- Extracts the `Authorization` header, validates the `Bearer` scheme
- Verifies the JWT using `env.JWT_SECRET`
- Returns `401 { error: "Unauthorized" }` on missing, invalid, or expired tokens
- Accesses env via Elysia context (`{ env }`) which is typed through Cloudflare adapter's `Env` type

### Type augmentation for Cloudflare `Env`

- Augment the Cloudflare Workers `Env` type to include `AUTH_PASSWORD: string` and `JWT_SECRET: string`
- This ensures TypeScript correctness when accessing env variables

### `src/routes/transactions.ts`

- Import and `.use(authPlugin)` to protect all transaction routes

### `src/index.ts`

- Mount `loginRoute` at root level (public, no auth required)
- No changes to existing routes

### `wrangler.jsonc`

- Add `AUTH_PASSWORD` and `JWT_SECRET` to `vars` for local development binding

### New dependency

- `jose` — lightweight JWT library that works in Cloudflare Workers (no Node.js crypto dependency)

## Error Responses

| Scenario | Status | Body |
|----------|--------|------|
| Login: wrong password | 401 | `{ "error": "Invalid credentials" }` |
| Login: missing password | 400 | Validation error from Elysia |
| Protected route: missing Authorization header | 401 | `{ "error": "Unauthorized" }` |
| Protected route: invalid scheme | 401 | `{ "error": "Unauthorized" }` |
| Protected route: expired/invalid JWT | 401 | `{ "error": "Unauthorized" }` |

All protected-route failures return the same response to avoid information leakage.

## What stays the same

- Transaction route logic — unchanged, only gets auth guard applied via plugin