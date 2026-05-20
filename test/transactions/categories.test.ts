import { describe, expect, it } from "bun:test";
import { CATEGORIES } from "../../src/db/schema";
import { createTestApp } from "./setup";

describe("GET /transactions/categories", () => {
  it("returns the full list of categories", async () => {
    const app = createTestApp();
    const res = await app.handle(new Request("http://localhost/transactions/categories"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([...CATEGORIES]);
  });
});
