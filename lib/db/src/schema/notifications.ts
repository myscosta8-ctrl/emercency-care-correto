import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientNotificationsTable = pgTable("patient_notifications", {
  id:        serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),

  // ── tipo(s) de notificação (JSON array: dengue | covid19 | tuberculose | violencia | outros) ──
  types:     text("types").notNull().default("[]"),   // JSON string[]
  otherType: text("other_type").notNull().default(""),

  // ── dados clínicos ──────────────────────────────────────────────────────────
  diagnosis:        text("diagnosis").notNull().default(""),
  symptomOnsetDate: text("symptom_onset_date").notNull().default(""),

  // ── situação ────────────────────────────────────────────────────────────────
  situation: text("situation", { enum: ["notificado", "pendente"] }).notNull().default("pendente"),

  // ── campos SINAN (compatibilidade com schema externo) ───────────────────────
  disease:        text("disease").notNull().default(""),
  classification: text("classification").notNull().default(""),
  healthUnit:     text("health_unit").notNull().default("UPA Breves"),
  pdfUrl:         text("pdf_url").notNull().default(""),

  // ── responsável / data da notificação ───────────────────────────────────────
  responsible:  text("responsible").notNull().default(""),
  notifiedAt:   text("notified_at").notNull().default(""),  // ISO datetime string

  // ── auditoria ───────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PatientNotification = typeof patientNotificationsTable.$inferSelect;
