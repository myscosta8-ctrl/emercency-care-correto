import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientNotificationsTable = pgTable("patient_notifications", {
  id:             serial("id").primaryKey(),
  patientId:      integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  disease:        text("disease").notNull().default(""),
  classification: text("classification").notNull().default(""),
  pdfUrl:         text("pdf_url").notNull().default(""),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export type PatientNotification = typeof patientNotificationsTable.$inferSelect;
