import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const pharmacyEntriesTable = pgTable("pharmacy_entries", {
  id:         serial("id").primaryKey(),
  patientId:  integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  userId:     integer("user_id").notNull().default(0),
  medication: text("medication").notNull().default(""),
  status:     text("status", { enum: ["pendente", "dispensado", "devolvido"] }).notNull().default("pendente"),
  notes:      text("notes").notNull().default(""),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

export type PharmacyEntry = typeof pharmacyEntriesTable.$inferSelect;
