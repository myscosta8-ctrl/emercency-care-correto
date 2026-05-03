import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["recepcionista", "enfermeiro", "tecnico_enfermagem", "medico", "assistente_social", "nutricionista", "farmaceutico", "administrador"] }).notNull(),
  email: text("email").notNull().default(""),
  active: boolean("active").notNull().default(true),
  corenCrm: text("coren_crm").notNull().default(""),
  sector: text("sector").notNull().default(""),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  accessLevels: text("access_levels").notNull().default(""),
  signature: text("signature").notNull().default(""),
  stamp: text("stamp").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true, updatedAt: true, passwordHash: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
