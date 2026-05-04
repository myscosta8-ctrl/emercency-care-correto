import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientNotificationsTable = pgTable("patient_notifications", {
  id:                  serial("id").primaryKey(),
  patientId:           integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  disease:             text("disease").notNull().default(""),
  classification:      text("classification").notNull().default(""),
  pdfUrl:              text("pdf_url").notNull().default(""),
  // ── SINAN structured fields ─────────────────────────────────────────────────
  agravoCode:          text("agravo_code").notNull().default(""),
  cid10:               text("cid10").notNull().default(""),
  dataNotificacao:     text("data_notificacao").notNull().default(""),
  dataInicioSintomas:  text("data_inicio_sintomas").notNull().default(""),
  logradouro:          text("logradouro").notNull().default(""),
  numeroEndereco:      text("numero_endereco").notNull().default(""),
  complemento:         text("complemento").notNull().default(""),
  bairro:              text("bairro").notNull().default(""),
  municipioResidencia: text("municipio_residencia").notNull().default(""),
  ufResidencia:        text("uf_residencia").notNull().default(""),
  cep:                 text("cep").notNull().default(""),
  formData:            text("form_data").notNull().default("{}"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
});

export type PatientNotification = typeof patientNotificationsTable.$inferSelect;
