import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const DEVICE_TYPES = [
  "acesso_venoso_periferico",
  "acesso_venoso_central",
  "sonda_nasoenteral",
  "sonda_nasogastrica",
  "sonda_vesical_demora",
  "cateter_arterial",
  "dreno_torax",
  "traqueostomia",
  "gastrostomia",
  "cateter_duplo_lumen",
  "dissecao_vascular",
  "outro",
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_LABELS: Record<DeviceType, string> = {
  acesso_venoso_periferico: "Acesso Venoso Periférico (AVP)",
  acesso_venoso_central:    "Acesso Venoso Central (AVC)",
  sonda_nasoenteral:        "Sonda Nasoenteral (SNE)",
  sonda_nasogastrica:       "Sonda Nasogástrica (SNG)",
  sonda_vesical_demora:     "Sonda Vesical de Demora (SVD)",
  cateter_arterial:         "Cateter Arterial",
  dreno_torax:              "Dreno de Tórax",
  traqueostomia:            "Traqueostomia",
  gastrostomia:             "Gastrostomia",
  cateter_duplo_lumen:      "Cateter de Duplo Lúmen",
  dissecao_vascular:        "Dissecção Vascular",
  outro:                    "Outro Dispositivo",
};

export const patientDevicesTable = pgTable("patient_devices", {
  id:            serial("id").primaryKey(),
  patientId:     integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  deviceType:    text("device_type").notNull(),
  insertionDate: text("insertion_date").notNull(),
  insertionSite: text("insertion_site").notNull().default(""),
  notes:         text("notes").notNull().default(""),
  removedAt:     timestamp("removed_at"),
  createdBy:     integer("created_by").notNull().default(0),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export type PatientDevice = typeof patientDevicesTable.$inferSelect;
