import { cors } from "@elysia/cors";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { loginRoute } from "./auth";
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
  .use(loginRoute)
  .use(transactionsRoute)
  .compile();
