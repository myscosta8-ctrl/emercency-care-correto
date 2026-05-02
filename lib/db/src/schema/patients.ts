import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  bed: text("bed").notNull().default(""),
  diagnosis: text("diagnosis").notNull().default(""),
  heartRate: integer("heart_rate").notNull().default(0),
  respiratoryRate: integer("respiratory_rate").notNull().default(0),
  glucose: real("glucose").notNull().default(0),
  spO2: integer("sp_o2").notNull().default(0),
  temperature: real("temperature").notNull().default(0),
  systolicBp: integer("systolic_bp").notNull().default(0),
  diastolicBp: integer("diastolic_bp").notNull().default(0),
  status: text("status", { enum: ["red", "orange", "yellow", "green", "blue"] }).notNull(),
  sector: text("sector").notNull(),
  nurse: text("nurse").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
