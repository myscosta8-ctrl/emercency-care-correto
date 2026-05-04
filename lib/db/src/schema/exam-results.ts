import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const examResultsTable = pgTable("exam_results", {
  id:             serial("id").primaryKey(),
  patientId:      integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  uploadedBy:     integer("uploaded_by").notNull().default(0),

  // ── identificação do exame ─────────────────────────────────────────────────
  examName:       text("exam_name").notNull(),
  examType:       text("exam_type", { enum: ["laboratorial", "imagem"] }).notNull().default("laboratorial"),
  prioridade:     text("prioridade", { enum: ["urgente", "rotina", "eletivo"] }).notNull().default("rotina"),

  // ── resultado ──────────────────────────────────────────────────────────────
  resultText:     text("result_text").notNull().default(""),
  fileData:       text("file_data").notNull().default(""),
  fileName:       text("file_name").notNull().default(""),
  fileMime:       text("file_mime").notNull().default(""),

  // ── status e notificação ───────────────────────────────────────────────────
  status:         text("status", { enum: ["pendente", "liberado"] }).notNull().default("pendente"),
  liberadoAt:     timestamp("liberado_at"),
  notified:       boolean("notified").notNull().default(false),

  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

export type ExamResult = typeof examResultsTable.$inferSelect;
