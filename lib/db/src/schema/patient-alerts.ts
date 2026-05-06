import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const patientAlertsTable = pgTable("patient_alerts", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),

  type: text("type", {
    enum: ["alergia", "risco_queda", "isolamento", "critico", "retorno_72h", "outro"],
  }).notNull(),

  descricao: text("descricao").notNull().default(""),
  ativo: boolean("ativo").notNull().default(true),

  createdAt:        timestamp("created_at").defaultNow().notNull(),
  createdByName:    text("created_by_name").notNull().default(""),

  deactivatedAt:       timestamp("deactivated_at"),
  deactivatedByName:   text("deactivated_by_name").notNull().default(""),
  motivoDesativacao:   text("motivo_desativacao").notNull().default(""),
});

export type PatientAlert = typeof patientAlertsTable.$inferSelect;
