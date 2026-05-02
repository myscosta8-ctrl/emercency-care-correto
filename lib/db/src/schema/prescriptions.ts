import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientPrescriptionsTable = pgTable("patient_prescriptions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id, { onDelete: "cascade" }),
  items: text("items").notNull().default("[]"),
  status: text("status", { enum: ["pendente", "em_andamento", "concluido"] })
    .notNull()
    .default("pendente"),
  responsible: text("responsible").notNull().default(""),
  scheduledTime: text("scheduled_time").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
