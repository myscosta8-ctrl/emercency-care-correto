import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", {
    enum: [
      "recepcionista", "enfermeiro", "tecnico_enfermagem", "medico",
      "assistente_social", "nutricionista", "farmaceutico", "administrador",
      "auxiliar_administrativo", "diretoria_geral",
    ],
  }).notNull(),
  email: text("email").notNull().default(""),
  active: boolean("active").notNull().default(true),
  corenCrm: text("coren_crm").notNull().default(""),
  sector: text("sector").notNull().default(""),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  accessLevels: text("access_levels").notNull().default(""),
  signature: text("signature").notNull().default(""),
  stamp: text("stamp").notNull().default(""),
  // ── setor e turno ──────────────────────────────────────────────────────────
  setoresAtuacao: text("setores_atuacao").notNull().default("todos"),
  turno: text("turno").notNull().default(""),
  consultorio: text("consultorio").notNull().default(""),
  // ── permissões individuais ─────────────────────────────────────────────────
  // JSON string: lista de ações permitidas ex: ["criar_paciente","*"]
  // null/vazio = usa padrão do cargo
  customPermissions: text("custom_permissions").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true, updatedAt: true, passwordHash: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
