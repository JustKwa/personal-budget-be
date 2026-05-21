import { Elysia, t, status } from "elysia";
import { bearer } from "@elysiajs/bearer";
import { SignJWT, jwtVerify } from "jose";

export const createLoginRoute = (getAuthPassword: () => string, getJwtSecret: () => string) =>
  new Elysia({ prefix: "/auth" })
    .post(
      "/login",
      async ({ body }) => {
        if (body.password !== getAuthPassword()) {
          return status(401, { error: "Invalid credentials" });
        }
        const token = await new SignJWT({ sub: "user" })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("24h")
          .sign(new TextEncoder().encode(getJwtSecret()));
        return { token };
      },
      {
        body: t.Object({
          password: t.String(),
        }),
      }
    );

export const createAuthPlugin = (getJwtSecret: () => string) =>
  new Elysia({ name: "auth" })
    .use(bearer())
    .onBeforeHandle({ as: "scoped" }, async ({ bearer, status }) => {
      if (!bearer) return status(401, { error: "Unauthorized" });
      try {
        await jwtVerify(bearer, new TextEncoder().encode(getJwtSecret()));
      } catch {
        return status(401, { error: "Unauthorized" });
      }
    });