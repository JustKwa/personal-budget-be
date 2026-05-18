import { eq } from "drizzle-orm";
import { Elysia, status, t } from "elysia";
import { dbPlugin } from "../db/plugin";
import { transactions } from "../db/schema";

export const transactionsRoute = new Elysia({ prefix: "/transactions" })
  .use(dbPlugin)
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
        .set({ amount: body.amount, description: body.description })
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
      }),
    }
  )
  .delete("/:id", async ({ db, params }) => {
    await db.delete(transactions).where(eq(transactions.id, params.id)).run();
    return { success: true };
  });
