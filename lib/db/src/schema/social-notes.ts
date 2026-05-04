import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const socialNotesTable = pgTable("social_notes", {
  id:             serial("id").primaryKey(),
  patientId:      integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  userId:         integer("user_id").notNull().default(0),
  content:        text("content").notNull().default(""),
  structuredData: jsonb("structured_data"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export type SocialNote = typeof socialNotesTable.$inferSelect;
