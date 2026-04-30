import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
