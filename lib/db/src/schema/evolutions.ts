import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientEvolutionsTable = pgTable("patient_evolutions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  heartRate: integer("heart_rate"),
  respiratoryRate: integer("respiratory_rate"),
  glucose: real("glucose"),
  responsible: text("responsible").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PatientEvolution = typeof patientEvolutionsTable.$inferSelect;
