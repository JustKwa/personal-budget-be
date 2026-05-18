import { describe, expect, it } from "bun:test";
import { createLoginRoute } from "../../src/auth/setup";

const TEST_PASSWORD = "correct-password";
const TEST_JWT_SECRET = "test-jwt-secret-really-long-key-that-is-at-least-32-chars";

describe("POST /auth/login", () => {
  const loginRoute = createLoginRoute(TEST_PASSWORD, TEST_JWT_SECRET);

  it("returns a token on valid password", async () => {
    const res = await loginRoute.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: TEST_PASSWORD }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(typeof body.token).toBe("string");
  });

  it("returns 401 on wrong password", async () => {
    const res = await loginRoute.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid credentials" });
  });

  it("returns 422 on missing password in body", async () => {
    const res = await loginRoute.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(422);
  });
});