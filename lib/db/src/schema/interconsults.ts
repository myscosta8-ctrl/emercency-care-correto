import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const interconsultsTable = pgTable("interconsults", {
  id:                   serial("id").primaryKey(),
  patientId:            integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  requestingSpecialty:  text("requesting_specialty").notNull().default(""),
  requestedSpecialty:   text("requested_specialty").notNull().default(""),
  reason:               text("reason").notNull().default(""),
  urgency:              text("urgency").notNull().default("eletivo"),
  status:               text("status").notNull().default("solicitado"),
  response:             text("response").notNull().default(""),
  requestedById:        integer("requested_by_id").notNull().default(0),
  requestedByName:      text("requested_by_name").notNull().default(""),
  respondedById:        integer("responded_by_id").notNull().default(0),
  respondedByName:      text("responded_by_name").notNull().default(""),
  requestedAt:          timestamp("requested_at").defaultNow().notNull(),
  respondedAt:          timestamp("responded_at"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

export type Interconsult = typeof interconsultsTable.$inferSelect;
