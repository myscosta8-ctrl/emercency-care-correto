import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { patientPrescriptionsTable } from "./prescriptions";

export const patientExamRequestsTable = pgTable("patient_exam_requests", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id, { onDelete: "cascade" }),
  prescriptionId: integer("prescription_id")
    .references(() => patientPrescriptionsTable.id, { onDelete: "set null" }),
  laboratoriais: jsonb("laboratoriais").notNull().default([]),
  imagem: jsonb("imagem").notNull().default([]),
  prioridade: text("prioridade", { enum: ["urgente", "rotina", "eletivo"] })
    .notNull()
    .default("rotina"),
  justificativa: text("justificativa").notNull().default(""),
  status: text("status", { enum: ["solicitado", "coletado", "laudado"] })
    .notNull()
    .default("solicitado"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
