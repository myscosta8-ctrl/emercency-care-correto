import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const carePlansTable = pgTable("care_plans", {
  id:               serial("id").primaryKey(),
  patientId:        integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  goal:             text("goal").notNull().default(""),
  interventions:    text("interventions").notNull().default(""),
  responsibleTeam:  text("responsible_team").notNull().default(""),
  targetDate:       text("target_date").notNull().default(""),
  status:           text("status").notNull().default("ativo"),
  createdById:      integer("created_by_id").notNull().default(0),
  createdByName:    text("created_by_name").notNull().default(""),
  resolvedByName:   text("resolved_by_name").notNull().default(""),
  resolvedAt:       timestamp("resolved_at"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export type CarePlan = typeof carePlansTable.$inferSelect;
