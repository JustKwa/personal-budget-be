import { env } from "cloudflare:workers";
import { createAuthPlugin, createLoginRoute } from "./setup";

const { AUTH_PASSWORD, JWT_SECRET } = env as unknown as {
  AUTH_PASSWORD: string;
  JWT_SECRET: string;
};

export const authPlugin = createAuthPlugin(JWT_SECRET);
export const loginRoute = createLoginRoute(AUTH_PASSWORD, JWT_SECRET);
