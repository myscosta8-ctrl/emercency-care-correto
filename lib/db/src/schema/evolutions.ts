import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientEvolutionsTable = pgTable("patient_evolutions", {
  id:                   serial("id").primaryKey(),
  patientId:            integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  userId:               integer("user_id").notNull().default(0),
  soapText:             text("soap_text").notNull().default(""),
  professionalCategory: text("professional_category").notNull().default("geral"),
  structuredData:       jsonb("structured_data"),
  invalidado:           boolean("invalidado").notNull().default(false),
  motivoInvalidacao:    text("motivo_invalidacao").notNull().default(""),
  finalizado:           boolean("finalizado").notNull().default(false),
  finalizadoAt:         timestamp("finalizado_at"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

export type PatientEvolution = typeof patientEvolutionsTable.$inferSelect;
