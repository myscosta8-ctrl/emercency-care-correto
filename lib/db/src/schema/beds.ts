import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const bedsTable = pgTable("beds", {
  id:              serial("id").primaryKey(),
  bedId:           text("bed_id").notNull().unique(),
  sector:          text("sector").notNull(),
  bedNumber:       integer("bed_number").notNull(),
  isIsolation:     boolean("is_isolation").notNull().default(false),
  isOccupied:      boolean("is_occupied").notNull().default(false),
  patientId:       integer("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  isolationActive: boolean("isolation_active").notNull().default(false),
  isolationType:   text("isolation_type"),
  isolationReason: text("isolation_reason"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export type Bed = typeof bedsTable.$inferSelect;
