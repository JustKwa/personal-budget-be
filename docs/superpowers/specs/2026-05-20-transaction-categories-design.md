# Transaction Categories

## Context

Add a `category` field to transactions so users can classify each transaction. Categories are predefined and stored as a string enum in the database.

## Decisions

- **Predefined categories**: Users cannot create custom categories. Adding new categories requires a code change and deploy.
- **In-code enum**: Categories are defined as a TypeScript string union type, validated by Elysia at the API layer. No separate `categories` DB table.
- **Required field**: Every transaction must have a category.
- **Production-safe migration**: Existing rows will default to `"Other"`.

## Schema

### `Category` type (in `src/db/schema.ts`)

```typescript
export const CATEGORIES = [
  "Housing",
  "Food",
  "Transportation",
  "Entertainment",
  "Healthcare",
  "Utilities",
  "Shopping",
  "Education",
  "Savings",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];
```

### `transactions` table change

Add column:

```sql
ALTER TABLE transactions ADD COLUMN category TEXT NOT NULL DEFAULT 'Other';
```

The `DEFAULT 'Other'` ensures existing production rows get a valid value.

### Drizzle schema update

```typescript
category: text("category", { enum: CATEGORIES }).notNull().default("Other"),
```

## API Changes

### `POST /transactions`

Request body now requires `category`:

```json
{
  "amount": 50.0,
  "description": "Grocery run",
  "category": "Food"
}
```

Validation uses Elysia's `t.Literal(...)` or `t.Union` of literals matching `CATEGORIES`.

### `PUT /transactions/:id`

Request body now requires `category` alongside `amount` and `description`.

### `GET /transactions` and `GET /transactions/:id`

Responses now include `category` field.

### `GET /transactions/categories`

New endpoint. Returns the list of valid categories as a JSON array:

```json
["Housing", "Food", "Transportation", "Entertainment", "Healthcare", "Utilities", "Shopping", "Education", "Savings", "Other"]
```

## Files Changed

- `src/db/schema.ts` — add `CATEGORIES`, `Category` type, `category` column
- `src/routes/transactions.ts` — update body validation, add `category` to insert/update, add `/categories` endpoint
- `drizzle/<new-migration>.sql` — generated migration adding `category` column

## Out of Scope

- Nested categories or subcategories
- User-defined categories
- Filtering transactions by category (can be added later)