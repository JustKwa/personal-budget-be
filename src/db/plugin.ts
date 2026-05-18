import { Elysia } from "elysia";
import { createDb } from "./index";
import { env } from "cloudflare:workers";

const { DB } = env as unknown as { DB: D1Database };

export const dbPlugin = (app: Elysia) => app.derive(() => ({ db: createDb(DB) }));