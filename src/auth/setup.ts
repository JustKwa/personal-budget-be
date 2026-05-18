import { Elysia, t, status } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { bearer } from "@elysiajs/bearer";

export const createLoginRoute = (authPassword: string, jwtSecret: string) =>
  new Elysia({ prefix: "/auth" })
    .use(jwt({ name: "jwt", secret: jwtSecret, exp: "24h" }))
    .post(
      "/login",
      async ({ body, jwt }) => {
        if (body.password !== authPassword) {
          return status(401, { error: "Invalid credentials" });
        }
        const token = await jwt.sign({ sub: "user" });
        return { token };
      },
      {
        body: t.Object({
          password: t.String(),
        }),
      }
    );

export const createAuthPlugin = (jwtSecret: string) =>
  new Elysia({ name: "auth" })
    .use(bearer())
    .use(jwt({ name: "jwt", secret: jwtSecret, exp: "24h" }))
    .onBeforeHandle({ as: "scoped" }, async ({ bearer, jwt, status }) => {
      if (!bearer) return status(401, { error: "Unauthorized" });
      const payload = await jwt.verify(bearer);
      if (!payload) return status(401, { error: "Unauthorized" });
    });