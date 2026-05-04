import { Router } from "express";
import { db } from "@workspace/db";
import { requirePermissao } from "../middleware/require-auth";
import {
  patientsTable,
  staffTable,
  patientEvolutionsTable,
  patientPrescriptionsTable,
  vitalsTable,
  patientDevicesTable,
  patientNotificationsTable,
  patientTasksTable,
  socialNotesTable,
  nutritionalAssessmentsTable,
  pharmacyEntriesTable,
  transfersTable,
  patientExamRequestsTable,
} from "@workspace/db";

const router = Router();

router.get("/export", requirePermissao("admin"), async (req, res) => {
  const [
    patients,
    staff,
    evolutions,
    prescriptions,
    vitals,
    devices,
    notifications,
    tasks,
    socialNotes,
    nutritional,
    pharmacy,
    transfers,
    examRequests,
  ] = await Promise.all([
    db.select().from(patientsTable),
    db.select().from(staffTable),
    db.select().from(patientEvolutionsTable),
    db.select().from(patientPrescriptionsTable),
    db.select().from(vitalsTable),
    db.select().from(patientDevicesTable),
    db.select().from(patientNotificationsTable),
    db.select().from(patientTasksTable),
    db.select().from(socialNotesTable),
    db.select().from(nutritionalAssessmentsTable),
    db.select().from(pharmacyEntriesTable),
    db.select().from(transfersTable),
    db.select().from(patientExamRequestsTable),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    counts: {
      patients: patients.length,
      staff: staff.length,
      evolutions: evolutions.length,
      prescriptions: prescriptions.length,
      vitals: vitals.length,
      devices: devices.length,
      notifications: notifications.length,
      tasks: tasks.length,
      socialNotes: socialNotes.length,
      nutritional: nutritional.length,
      pharmacy: pharmacy.length,
      transfers: transfers.length,
      examRequests: examRequests.length,
    },
    data: {
      patients,
      staff: staff.map(s => ({ ...s, passwordHash: "***" })),
      evolutions,
      prescriptions,
      vitals,
      devices,
      notifications,
      tasks,
      socialNotes,
      nutritional,
      pharmacy,
      transfers,
      examRequests,
    },
  };

  const filename = `backup_upa_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json(payload);
});

export default router;
