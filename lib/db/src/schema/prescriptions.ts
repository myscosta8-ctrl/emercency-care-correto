import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientPrescriptionsTable = pgTable("patient_prescriptions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().default(0),
  type: text("type", { enum: ["nursing", "medical"] }).notNull().default("nursing"),
  content: text("content").notNull().default(""),
  status: text("status", { enum: ["pendente", "em_andamento", "concluido"] })
    .notNull()
    .default("pendente"),
  invalidado: boolean("invalidado").notNull().default(false),
  motivoInvalidacao: text("motivo_invalidacao").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
