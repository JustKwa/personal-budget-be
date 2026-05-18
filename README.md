# Personal Budget BE

Backend API built with [ElysiaJS](https://elysiajs.com/) running on [Cloudflare Workers](https://workers.cloudflare.com/) with [D1](https://developers.cloudflare.com/d1/) (SQLite) as the database and [Drizzle ORM](https://orm.drizzle.team/) for query building.

## Getting Started

```bash
bun install
```

## Development

Start the local dev server:

```bash
bun run dev
```

The API is available at `http://localhost:8787`.

## Database

### Generate migrations

After modifying `src/db/schema.ts`, generate a new migration:

```bash
bun run db:generate
```

### Apply migrations (local)

Apply the latest migration to the local D1 database:

```bash
npx wrangler d1 execute personal-budget-db --local --file=drizzle/0000_dapper_blue_blade.sql
```

> **Important:** Migrations must be applied locally before the API will work. Missing tables cause internal server errors.

### Apply migrations (remote)

```bash
npx wrangler d1 execute personal-budget-db --remote --file=drizzle/0000_dapper_blue_blade.sql
```

### Query the local database

```bash
npx wrangler d1 execute personal-budget-db --local --command="SELECT * FROM transactions"
```

## Deploy

```bash
bun run deploy
```

## API Endpoints

| Method  | Path               | Description          |
| ------- | ------------------ | -------------------- |
| GET     | /transactions      | List all transactions |
| POST    | /transactions      | Create a transaction |
| GET     | /transactions/:id  | Get a transaction     |
| PUT     | /transactions/:id  | Update a transaction |
| DELETE  | /transactions/:id  | Delete a transaction |