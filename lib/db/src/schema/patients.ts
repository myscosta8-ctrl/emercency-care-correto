import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),

  // ── identificadores únicos ──────────────────────────────────────────────────
  prontuarioNumber:  text("prontuario_number").notNull().default(""),
  atendimentoNumber: text("atendimento_number").notNull().default(""),

  // ── identificação ──────────────────────────────────────────────────────────
  fullName:     text("full_name").notNull(),
  birthDate:    text("birth_date").notNull().default(""),
  age:          integer("age").notNull().default(0),
  sex:          text("sex", { enum: ["M", "F", "O"] }).notNull().default("O"),
  motherName:   text("mother_name").notNull().default(""),

  // ── documentos ─────────────────────────────────────────────────────────────
  cns:          text("cns").notNull().default(""),
  cpf:          text("cpf").notNull().default(""),
  rg:           text("rg").notNull().default(""),

  // ── endereço / contato ─────────────────────────────────────────────────────
  address:      text("address").notNull().default(""),
  phone:        text("phone").notNull().default(""),
  email:        text("email").notNull().default(""),

  // ── localização na UPA ─────────────────────────────────────────────────────
  sector:       text("sector", { enum: ["triagem", "sala_vermelha", "observacao_adulto", "observacao_pediatrica", "observacao_pre_adulto"] }).notNull(),
  bed:          text("bed").notNull().default(""),

  // ── triagem / status de fluxo ──────────────────────────────────────────────
  triageLevel:      text("triage_level", { enum: ["red", "orange", "yellow", "green", "blue"] }).notNull(),
  internmentStatus: text("internment_status", { enum: ["internado", "nao_internado"] }).notNull().default("nao_internado"),
  careStatus:       text("care_status", {
    enum: [
      "Em Triagem",
      "Aguardando Atendimento",
      "Em Atendimento (Cons. 1)",
      "Em Atendimento (Cons. 2)",
      "Em Medicação",
      "Aguardando Exames",
      "Aguardando Reavaliação",
      "Em Observação",
      "Internado",
      "Em Transferência",
      "Alta",
    ],
  }).notNull().default("Em Triagem"),
  careStatusChangedAt: timestamp("care_status_changed_at").defaultNow().notNull(),

  // ── clínico ────────────────────────────────────────────────────────────────
  diagnosis:        text("diagnosis").notNull().default(""),
  symptoms:         text("symptoms").notNull().default(""),
  symptomOnsetDate: text("symptom_onset_date").notNull().default(""),

  // ── atendimento ────────────────────────────────────────────────────────────
  attendanceDate:          text("attendance_date").notNull().default(""),
  attendanceTime:          text("attendance_time").notNull().default(""),
  healthUnit:              text("health_unit").notNull().default("UPA Breves - Breves/PA"),
  responsibleProfessional: text("responsible_professional").notNull().default(""),
  nurse:                   text("nurse").notNull().default(""),

  // ── notificação sinan ──────────────────────────────────────────────────────
  agravo:               text("agravo").notNull().default(""),
  dataNotificacao:      text("data_notificacao").notNull().default(""),
  municipioNotificacao: text("municipio_notificacao").notNull().default(""),
  codigoIbge:           text("codigo_ibge").notNull().default(""),
  evolucaoCaso:         text("evolucao_caso").notNull().default(""),
  classificacaoFinal:   text("classificacao_final").notNull().default(""),
  criterioConfirmacao:  text("criterio_confirmacao").notNull().default(""),

  // ── arquivo (alta / transferência) ────────────────────────────────────────
  archivedAt:     timestamp("archived_at"),
  archiveReason:  text("archive_reason").notNull().default(""),

  // ── auditoria ──────────────────────────────────────────────────────────────
  createdBy: text("created_by").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
