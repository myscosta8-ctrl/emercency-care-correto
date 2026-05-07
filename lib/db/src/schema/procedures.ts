import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientProceduresTable = pgTable("patient_procedures", {
  id:                serial("id").primaryKey(),
  patientId:         integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  procedureName:     text("procedure_name").notNull().default(""),
  procedureType:     text("procedure_type").notNull().default(""),
  description:       text("description").notNull().default(""),
  materialsUsed:     text("materials_used").notNull().default(""),
  complications:     text("complications").notNull().default(""),
  outcome:           text("outcome").notNull().default(""),
  performedByName:   text("performed_by_name").notNull().default(""),
  performedById:     integer("performed_by_id").notNull().default(0),
  performedAt:       text("performed_at").notNull().default(""),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
});

export type PatientProcedure = typeof patientProceduresTable.$inferSelect;
