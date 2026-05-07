import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const controlledSubstancesTable = pgTable("controlled_substances", {
  id:               serial("id").primaryKey(),
  patientId:        integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  medicationName:   text("medication_name").notNull().default(""),
  portariaClass:    text("portaria_class").notNull().default("B1"),
  dose:             text("dose").notNull().default(""),
  route:            text("route").notNull().default(""),
  quantity:         text("quantity").notNull().default(""),
  unit:             text("unit").notNull().default(""),
  instructions:     text("instructions").notNull().default(""),
  prescriberId:     integer("prescriber_id").notNull().default(0),
  prescriberName:   text("prescriber_name").notNull().default(""),
  prescriberCrm:    text("prescriber_crm").notNull().default(""),
  status:           text("status").notNull().default("pendente"),
  dispensedByName:  text("dispensed_by_name").notNull().default(""),
  dispensedAt:      timestamp("dispensed_at"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export type ControlledSubstance = typeof controlledSubstancesTable.$inferSelect;
