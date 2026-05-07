import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientConsentsTable = pgTable("patient_consents", {
  id:                    serial("id").primaryKey(),
  patientId:             integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  consentType:           text("consent_type").notNull().default("geral"),
  title:                 text("title").notNull().default(""),
  description:           text("description").notNull().default(""),
  patientOrGuardianName: text("patient_or_guardian_name").notNull().default(""),
  guardianRelationship:  text("guardian_relationship").notNull().default(""),
  agreed:                boolean("agreed").notNull().default(false),
  professionalId:        integer("professional_id").notNull().default(0),
  professionalName:      text("professional_name").notNull().default(""),
  notes:                 text("notes").notNull().default(""),
  createdAt:             timestamp("created_at").defaultNow().notNull(),
});

export type PatientConsent = typeof patientConsentsTable.$inferSelect;
