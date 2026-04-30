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
  .onError(({ code, set }) => {
    if (code === "VALIDATION") return;
    set.status = 500;
    return { error: "Internal server error" };
  })
  .use(transactionsRoute)
  .compile();
