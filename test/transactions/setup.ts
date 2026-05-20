import { Elysia, t, status } from "elysia";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { transactions, CATEGORIES } from "../../src/db/schema";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.run(`
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      created_at INTEGER NOT NULL
    )
  `);
  return drizzle(sqlite);
}

export function createTestApp() {
  const db = createTestDb();

  return new Elysia({ prefix: "/transactions" })
    .derive(() => ({ db }))
    .get("/categories", () => [...CATEGORIES])
    .get("/", async ({ db }) => {
      return await db.select().from(transactions).all();
    })
    .post(
      "/",
      async ({ db, body }) => {
        const id = crypto.randomUUID();
        const createdAt = Date.now();

        await db
          .insert(transactions)
          .values({ id, amount: body.amount, description: body.description, category: body.category, createdAt })
          .run();

        return { id, amount: body.amount, description: body.description, category: body.category, createdAt };
      },
      {
        body: t.Object({
          amount: t.Number(),
          description: t.String(),
          category: t.Union(CATEGORIES.map((c) => t.Literal(c))),
        }),
      }
    )
    .get("/:id", async ({ db, params }) => {
      const tx = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, params.id))
        .get();

      if (!tx) return status(404, { error: "Transaction not found" });

      return tx;
    })
    .put(
      "/:id",
      async ({ db, params, body }) => {
        await db
          .update(transactions)
          .set({ amount: body.amount, description: body.description, category: body.category })
          .where(eq(transactions.id, params.id))
          .run();

        const tx = await db
          .select()
          .from(transactions)
          .where(eq(transactions.id, params.id))
          .get();

        if (!tx) return status(404, { error: "Transaction not found" });

        return tx;
      },
      {
        body: t.Object({
          amount: t.Number(),
          description: t.String(),
          category: t.Union(CATEGORIES.map((c) => t.Literal(c))),
        }),
      }
    )
    .delete("/:id", async ({ db, params }) => {
      await db.delete(transactions).where(eq(transactions.id, params.id)).run();
      return { success: true };
    });
}
