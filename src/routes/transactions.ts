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
