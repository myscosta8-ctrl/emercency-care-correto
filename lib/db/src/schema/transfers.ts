import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const transfersTable = pgTable("transfers", {
  id:                  serial("id").primaryKey(),
  patientId:           integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  userId:              integer("user_id").notNull().default(0),
  destinationHospital: text("destination_hospital").notNull(),
  specialty:           text("specialty").notNull().default(""),
  reasonForTransfer:   text("reason_for_transfer").notNull().default(""),
  transferStatus:      text("transfer_status").notNull().default("Solicitado"),
  transportType:       text("transport_type").notNull().default(""),
  regulationContact:   text("regulation_contact").notNull().default(""),
  departureDatetime:   timestamp("departure_datetime"),
  arrivalConfirmation: boolean("arrival_confirmation").notNull().default(false),
  arrivalDatetime:     timestamp("arrival_datetime"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
});

export type Transfer = typeof transfersTable.$inferSelect;
