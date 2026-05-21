import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { createLoginRoute, createAuthPlugin } from "../../src/auth/setup";

const TEST_PASSWORD = "correct-password";
const TEST_JWT_SECRET = "test-jwt-secret-really-long-key-that-is-at-least-32-chars";

describe("Auth Plugin", () => {
  const loginRoute = createLoginRoute(() => TEST_PASSWORD, () => TEST_JWT_SECRET);
  const authPlugin = createAuthPlugin(() => TEST_JWT_SECRET);

  const app = new Elysia().use(authPlugin).get("/protected", () => "success");

  async function getValidToken(): Promise<string> {
    const res = await loginRoute.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: TEST_PASSWORD }),
      })
    );
    const body = await res.json();
    return body.token;
  }

  it("returns 401 without Authorization header", async () => {
    const res = await app.handle(new Request("http://localhost/protected"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 with invalid JWT", async () => {
    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: "Bearer invalid-token" },
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 with wrong scheme (not Bearer)", async () => {
    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("allows access with valid JWT from login", async () => {
    const token = await getValidToken();

    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("success");
  });
});