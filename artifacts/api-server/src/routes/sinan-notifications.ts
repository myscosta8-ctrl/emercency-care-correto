/**
 * Standalone /api/notifications routes
 * POST /api/notifications  — create notification, auto-fills from patient
 * GET  /api/notifications/:id — fetch notification with merged patient data
 */

import { Router } from "express";
import { db, patientNotificationsTable, patientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── CPF validation ────────────────────────────────────────────────────────────
export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]!) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(digits[9]!)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]!) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(digits[10]!)) return false;

  return true;
}

const serializeNotif = (n: typeof patientNotificationsTable.$inferSelect) => ({
  ...n,
  createdAt: n.createdAt.toISOString(),
});

const serializePatient = (p: typeof patientsTable.$inferSelect) => ({
  id:           p.id,
  full_name:    p.fullName,
  mother_name:  p.motherName,
  birth_date:   p.birthDate,
  age:          p.age,
  sex:          p.sex,
  cpf:          p.cpf,
  rg:           p.rg,
  cns:          p.cns,
  address:      p.address,
  phone:        p.phone,
  health_unit:  p.healthUnit,
  professional: p.responsibleProfessional,
});

// ── POST /api/notifications ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const {
    patient_id,
    disease,
    classification,
    pdf_url,
  } = req.body as {
    patient_id: number;
    disease?: string;
    classification?: string;
    pdf_url?: string;
  };

  if (!patient_id) {
    res.status(400).json({ error: "patient_id é obrigatório" });
    return;
  }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, patient_id));

  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado" });
    return;
  }

  const resolvedDisease        = disease        ?? patient.diagnosis          ?? "";
  const resolvedClassification = classification ?? patient.classificacaoFinal ?? "";

  const [notif] = await db
    .insert(patientNotificationsTable)
    .values({
      patientId:      patient_id,
      disease:        resolvedDisease,
      classification: resolvedClassification,
      pdfUrl:         pdf_url ?? "",
    })
    .returning();

  res.status(201).json({
    ...serializeNotif(notif),
    patient: serializePatient(patient),
  });
});

// ── GET /api/notifications/:id ────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [notif] = await db
    .select()
    .from(patientNotificationsTable)
    .where(eq(patientNotificationsTable.id, id));

  if (!notif) { res.status(404).json({ error: "Notificação não encontrada" }); return; }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, notif.patientId));

  res.json({
    ...serializeNotif(notif),
    patient: patient ? serializePatient(patient) : null,
  });
});

export { router as sinanNotificationsRouter };
export default router;
