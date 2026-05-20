import { describe, expect, it } from "bun:test";
import { CATEGORIES } from "../../src/db/schema";
import { createTestApp } from "./setup";

describe("POST /transactions - category validation", () => {
  it("rejects a transaction without a category", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10, description: "test" }),
      })
    );
    expect(res.status).toBe(422);
  });

  it("rejects a transaction with an invalid category", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10, description: "test", category: "InvalidCategory" }),
      })
    );
    expect(res.status).toBe(422);
  });

  it("accepts a transaction with each valid category", async () => {
    const app = createTestApp();
    for (const category of CATEGORIES) {
      const res = await app.handle(
        new Request("http://localhost/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 10, description: `test ${category}`, category }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.category).toBe(category);
    }
  });
});

describe("PUT /transactions/:id - category validation", () => {
  it("rejects an update without a category", async () => {
    const app = createTestApp();
    const createRes = await app.handle(
      new Request("http://localhost/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10, description: "test", category: "Food" }),
      })
    );
    const created = await createRes.json();

    const res = await app.handle(
      new Request(`http://localhost/transactions/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 20, description: "updated" }),
      })
    );
    expect(res.status).toBe(422);
  });

  it("rejects an update with an invalid category", async () => {
    const app = createTestApp();
    const createRes = await app.handle(
      new Request("http://localhost/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10, description: "test", category: "Food" }),
      })
    );
    const created = await createRes.json();

    const res = await app.handle(
      new Request(`http://localhost/transactions/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 20, description: "updated", category: "InvalidCategory" }),
      })
    );
    expect(res.status).toBe(422);
  });

  it("accepts an update with a valid category", async () => {
    const app = createTestApp();
    const createRes = await app.handle(
      new Request("http://localhost/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10, description: "test", category: "Food" }),
      })
    );
    const created = await createRes.json();

    const res = await app.handle(
      new Request(`http://localhost/transactions/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 20, description: "updated", category: "Entertainment" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category).toBe("Entertainment");
  });
});
