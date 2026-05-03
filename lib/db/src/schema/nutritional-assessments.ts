import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const nutritionalAssessmentsTable = pgTable("nutritional_assessments", {
  id:        serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  userId:    integer("user_id").notNull().default(0),
  content:   text("content").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NutritionalAssessment = typeof nutritionalAssessmentsTable.$inferSelect;
