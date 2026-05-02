import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),

  // ── identificação ───────────────────────────────────────────────────────────
  name:         text("name").notNull(),
  birthDate:    text("birth_date").notNull().default(""),
  age:          integer("age").notNull().default(0),
  sex:          text("sex", { enum: ["M", "F", "O"] }).notNull().default("O"),
  motherName:   text("mother_name").notNull().default(""),

  // ── documentos ──────────────────────────────────────────────────────────────
  cns:          text("cns").notNull().default(""),
  cpf:          text("cpf").notNull().default(""),
  rg:           text("rg").notNull().default(""),

  // ── dados físicos ────────────────────────────────────────────────────────────
  weight:       real("weight").notNull().default(0),
  height:       real("height").notNull().default(0),

  // ── contato ─────────────────────────────────────────────────────────────────
  phone:        text("phone").notNull().default(""),
  email:        text("email").notNull().default(""),
  guardianName: text("guardian_name").notNull().default(""),

  // ── endereço ────────────────────────────────────────────────────────────────
  street:             text("street").notNull().default(""),
  addressNumber:      text("address_number").notNull().default(""),
  addressComplement:  text("address_complement").notNull().default(""),
  neighborhood:       text("neighborhood").notNull().default(""),
  city:           text("city").notNull().default(""),
  addressState:   text("address_state").notNull().default(""),
  zipCode:        text("zip_code").notNull().default(""),

  // ── clínico ─────────────────────────────────────────────────────────────────
  bed:                text("bed").notNull().default(""),
  diagnosis:          text("diagnosis").notNull().default(""),
  symptoms:           text("symptoms").notNull().default(""),
  symptomOnsetDate:   text("symptom_onset_date").notNull().default(""),
  heartRate:        integer("heart_rate").notNull().default(0),
  respiratoryRate:  integer("respiratory_rate").notNull().default(0),
  glucose:          real("glucose").notNull().default(0),
  spO2:             integer("sp_o2").notNull().default(0),
  temperature:      real("temperature").notNull().default(0),
  systolicBp:       integer("systolic_bp").notNull().default(0),
  diastolicBp:      integer("diastolic_bp").notNull().default(0),
  status:           text("status", { enum: ["red", "orange", "yellow", "green", "blue"] }).notNull(),
  sector:           text("sector").notNull(),
  internmentStatus: text("internment_status", { enum: ["internado", "nao_internado"] }).notNull().default("nao_internado"),
  nurse:            text("nurse").notNull().default(""),

  // ── auditoria ───────────────────────────────────────────────────────────────
  createdBy: text("created_by").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
