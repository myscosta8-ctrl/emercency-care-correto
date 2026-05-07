import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientAllergiesTable = pgTable("patient_allergies", {
  id:              serial("id").primaryKey(),
  patientId:       integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  allergen:        text("allergen").notNull().default(""),
  reactionType:    text("reaction_type").notNull().default(""),
  severity:        text("severity").notNull().default("moderada"),
  notes:           text("notes").notNull().default(""),
  recordedByName:  text("recorded_by_name").notNull().default(""),
  recordedById:    integer("recorded_by_id").notNull().default(0),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export type PatientAllergy = typeof patientAllergiesTable.$inferSelect;
