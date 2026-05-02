import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientEvolutionsTable = pgTable("patient_evolutions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  heartRate: integer("heart_rate"),
  respiratoryRate: integer("respiratory_rate"),
  glucose: real("glucose"),
  systolicBp: integer("systolic_bp"),
  diastolicBp: integer("diastolic_bp"),
  spO2: integer("sp_o2"),
  temperature: real("temperature"),
  painScale: integer("pain_scale"),
  consciousnessLevel: text("consciousness_level"),
  generalCondition: text("general_condition"),
  subjective: text("subjective").notNull().default(""),
  assessment: text("assessment").notNull().default(""),
  plan: text("plan").notNull().default(""),
  responsible: text("responsible").notNull().default(""),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PatientEvolution = typeof patientEvolutionsTable.$inferSelect;
