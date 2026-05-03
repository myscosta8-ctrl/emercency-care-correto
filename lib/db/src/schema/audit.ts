import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  usuario: text("usuario").notNull(),
  acao: text("acao").notNull(),
  detalhes: text("detalhes"),
  ip: text("ip"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogTable).omit({ id: true, criadoEm: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogTable.$inferSelect;
