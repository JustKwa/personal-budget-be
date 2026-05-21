import { env } from "cloudflare:workers";
import { createAuthPlugin, createLoginRoute } from "./setup";

export const authPlugin = createAuthPlugin(() => (env as unknown as { JWT_SECRET: string }).JWT_SECRET);
export const loginRoute = createLoginRoute(
  () => (env as unknown as { AUTH_PASSWORD: string }).AUTH_PASSWORD,
  () => (env as unknown as { JWT_SECRET: string }).JWT_SECRET
);