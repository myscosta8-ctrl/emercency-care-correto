import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vitalsTable = pgTable("vitals", {
  id:        serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  userId:    integer("user_id").notNull().default(0),
  bp:        text("bp").notNull().default(""),
  hr:        integer("hr").notNull().default(0),
  rr:        integer("rr").notNull().default(0),
  spo2:      integer("spo2").notNull().default(0),
  temp:      real("temp").notNull().default(0),
  glucose:   real("glucose").notNull().default(0),
  note:      text("note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVitalsSchema = createInsertSchema(vitalsTable).omit({ id: true, createdAt: true });
export type InsertVitals = z.infer<typeof insertVitalsSchema>;
export type Vitals = typeof vitalsTable.$inferSelect;
