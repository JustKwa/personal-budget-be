import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const CATEGORIES = [
  "Groceries",
  "Housing",
  "Food",
  "Beverages",
  "Transportation",
  "Entertainment",
  "Healthcare",
  "Utilities",
  "Savings",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull().default("Other"),
  createdAt: integer("created_at").notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
