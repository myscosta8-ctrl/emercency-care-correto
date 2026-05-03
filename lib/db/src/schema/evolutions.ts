import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientEvolutionsTable = pgTable("patient_evolutions", {
  id:        serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  userId:    integer("user_id").notNull().default(0),
  soapText:  text("soap_text").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PatientEvolution = typeof patientEvolutionsTable.$inferSelect;
