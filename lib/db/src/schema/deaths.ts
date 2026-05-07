import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const patientDeathsTable = pgTable("patient_deaths", {
  id:             serial("id").primaryKey(),
  patientId:      integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  deathDate:      text("death_date").notNull().default(""),
  deathTime:      text("death_time").notNull().default(""),
  cause1a:        text("cause_1a").notNull().default(""),
  cause1b:        text("cause_1b").notNull().default(""),
  cause1c:        text("cause_1c").notNull().default(""),
  cause2:         text("cause_2").notNull().default(""),
  icd:            text("icd").notNull().default(""),
  typeOfDeath:    text("type_of_death").notNull().default("natural"),
  physicianId:    integer("physician_id").notNull().default(0),
  physicianName:  text("physician_name").notNull().default(""),
  physicianCrm:   text("physician_crm").notNull().default(""),
  witnessName:    text("witness_name").notNull().default(""),
  notes:          text("notes").notNull().default(""),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export type PatientDeath = typeof patientDeathsTable.$inferSelect;
