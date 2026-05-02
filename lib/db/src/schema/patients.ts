import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  bed: text("bed").notNull(),
  diagnosis: text("diagnosis").notNull(),
  heartRate: integer("heart_rate").notNull(),
  respiratoryRate: integer("respiratory_rate").notNull(),
  glucose: real("glucose").notNull(),
  status: text("status", { enum: ["red", "orange", "yellow", "green", "blue"] }).notNull(),
  sector: text("sector").notNull(),
  nurse: text("nurse").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
