import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const pharmacyDispensationsTable = pgTable("pharmacy_dispensations", {
  id:               serial("id").primaryKey(),
  patientId:        integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  prescriptionId:   integer("prescription_id"),
  medicationName:   text("medication_name").notNull().default(""),
  quantity:         text("quantity").notNull().default(""),
  unit:             text("unit").notNull().default(""),
  batchNumber:      text("batch_number").notNull().default(""),
  expiryDate:       text("expiry_date").notNull().default(""),
  dispensedById:    integer("dispensed_by_id").notNull().default(0),
  dispensedByName:  text("dispensed_by_name").notNull().default(""),
  notes:            text("notes").notNull().default(""),
  returned:         boolean("returned").notNull().default(false),
  returnedAt:       timestamp("returned_at"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export type PharmacyDispensation = typeof pharmacyDispensationsTable.$inferSelect;
