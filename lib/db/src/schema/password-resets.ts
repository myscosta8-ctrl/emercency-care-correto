import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const passwordResetsTable = pgTable("password_resets", {
  id:        text("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt:    timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordReset = typeof passwordResetsTable.$inferSelect;
