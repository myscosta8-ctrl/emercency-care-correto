import { Router } from "express";
import { db, patientsTable, patientEvolutionsTable, patientPrescriptionsTable, patientTasksTable, vitalsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  CreatePatientBody,
  UpdatePatientBody,
  GetPatientParams,
  UpdatePatientParams,
  DeletePatientParams,
  UpdatePatientStatusParams,
  UpdatePatientStatusBody,
  RecordPatientVitalsParams,
  RecordPatientVitalsBody,
  GetPatientVitalsParams,
  AddPatientPrescriptionParams,
  AddPatientPrescriptionBody,
  UpdatePrescriptionStatusParams,
  UpdatePrescriptionStatusBody,
  AddPatientTaskParams,
  AddPatientTaskBody,
  UpdateTaskStatusParams,
  UpdateTaskStatusBody,
} from "@workspace/api-zod";

const router = Router();

// ── CPF validation ─────────────────────────────────────────────────────────────
function validateCPF(cpf: string): boolean {
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

// ── helpers ───────────────────────────────────────────────────────────────────

const serialize = (p: typeof patientsTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

const serializeEvolution = (e: typeof patientEvolutionsTable.$inferSelect) => ({
  ...e,
  createdAt: e.createdAt.toISOString(),
});

const serializeVitals = (v: typeof vitalsTable.$inferSelect) => ({
  ...v,
  createdAt: v.createdAt.toISOString(),
});

function ageFromBirthDate(birthDate: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

type TriageLevel   = "red" | "orange" | "yellow" | "green" | "blue";
type PatientSector = "sala_vermelha" | "observacao_adulto" | "observacao_pediatrica" | "observacao_pre_adulto";
type InternStatus  = "internado" | "nao_internado";

/** Full insert payload for patient creation */
function buildPatientInsert(body: typeof CreatePatientBody._type) {
  const age = body.birthDate ? ageFromBirthDate(body.birthDate) : (body.age ?? 0);
  return {
    fullName:                body.full_name,
    birthDate:               body.birthDate ?? "",
    age,
    sex:                     (body.sex ?? "O") as "M" | "F" | "O",
    motherName:              body.motherName ?? "",
    cns:                     body.cns ?? "",
    cpf:                     body.cpf ?? "",
    rg:                      body.rg ?? "",
    address:                 body.address ?? "",
    phone:                   body.phone ?? "",
    email:                   body.email ?? "",
    triageLevel:             (body.triage_level ?? "green") as TriageLevel,
    sector:                  body.sector as PatientSector,
    internmentStatus:        (body.internmentStatus ?? "nao_internado") as InternStatus,
    bed:                     body.bed ?? "",
    diagnosis:               body.diagnosis ?? "",
    symptoms:                body.symptoms ?? "",
    symptomOnsetDate:        body.symptomOnsetDate ?? "",
    nurse:                   body.nurse ?? "",
    attendanceDate:          body.attendanceDate ?? "",
    attendanceTime:          body.attendanceTime ?? "",
    healthUnit:              body.healthUnit ?? "UPA Breves - Breves/PA",
    responsibleProfessional: body.responsibleProfessional ?? "",
    agravo:                  body.agravo ?? "",
    dataNotificacao:         body.dataNotificacao ?? "",
    municipioNotificacao:    body.municipioNotificacao ?? "",
    codigoIbge:              body.codigoIbge ?? "",
    evolucaoCaso:            body.evolucaoCaso ?? "",
    classificacaoFinal:      body.classificacaoFinal ?? "",
    criterioConfirmacao:     body.criterioConfirmacao ?? "",
  };
}

/** Partial patch payload for patient update */
function buildPatientPatch(body: typeof UpdatePatientBody._type): Partial<typeof patientsTable.$inferInsert> {
  const patch: Partial<typeof patientsTable.$inferInsert> = {};
  if (body.full_name         !== undefined) patch.fullName         = body.full_name;
  if (body.birthDate         !== undefined) {
    patch.birthDate = body.birthDate;
    patch.age = ageFromBirthDate(body.birthDate);
  }
  if (body.age               !== undefined) patch.age              = body.age;
  if (body.sex               !== undefined) patch.sex              = body.sex as "M" | "F" | "O";
  if (body.motherName        !== undefined) patch.motherName       = body.motherName;
  if (body.cns               !== undefined) patch.cns              = body.cns;
  if (body.cpf               !== undefined) patch.cpf              = body.cpf;
  if (body.rg                !== undefined) patch.rg               = body.rg;
  if (body.address           !== undefined) patch.address          = body.address;
  if (body.phone             !== undefined) patch.phone            = body.phone;
  if (body.email             !== undefined) patch.email            = body.email;
  if (body.triage_level      !== undefined) patch.triageLevel      = body.triage_level as TriageLevel;
  if (body.sector            !== undefined) patch.sector           = body.sector as PatientSector;
  if (body.internmentStatus  !== undefined) patch.internmentStatus = body.internmentStatus as InternStatus;
  if (body.bed               !== undefined) patch.bed              = body.bed;
  if (body.diagnosis         !== undefined) patch.diagnosis        = body.diagnosis;
  if (body.symptoms          !== undefined) patch.symptoms         = body.symptoms;
  if (body.symptomOnsetDate  !== undefined) patch.symptomOnsetDate = body.symptomOnsetDate;
  if (body.nurse             !== undefined) patch.nurse            = body.nurse;
  if (body.attendanceDate          !== undefined) patch.attendanceDate          = body.attendanceDate;
  if (body.attendanceTime          !== undefined) patch.attendanceTime          = body.attendanceTime;
  if (body.healthUnit              !== undefined) patch.healthUnit              = body.healthUnit;
  if (body.responsibleProfessional !== undefined) patch.responsibleProfessional = body.responsibleProfessional;
  if (body.agravo              !== undefined) patch.agravo              = body.agravo;
  if (body.dataNotificacao     !== undefined) patch.dataNotificacao     = body.dataNotificacao;
  if (body.municipioNotificacao !== undefined) patch.municipioNotificacao = body.municipioNotificacao;
  if (body.codigoIbge          !== undefined) patch.codigoIbge          = body.codigoIbge;
  if (body.evolucaoCaso        !== undefined) patch.evolucaoCaso        = body.evolucaoCaso;
  if (body.classificacaoFinal  !== undefined) patch.classificacaoFinal  = body.classificacaoFinal;
  if (body.criterioConfirmacao !== undefined) patch.criterioConfirmacao = body.criterioConfirmacao;
  return patch;
}

// ── routes ────────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const patients = await db.select().from(patientsTable).orderBy(patientsTable.createdAt);
  res.json(patients.map(serialize));
});

router.get("/summary", async (req, res) => {
  const rows = await db
    .select({ triageLevel: patientsTable.triageLevel, count: sql<number>`count(*)::int` })
    .from(patientsTable)
    .groupBy(patientsTable.triageLevel);

  const summary = { total: 0, red: 0, orange: 0, yellow: 0, green: 0, blue: 0 };
  for (const row of rows) {
    summary.total += row.count;
    if      (row.triageLevel === "red")    summary.red    = row.count;
    else if (row.triageLevel === "orange") summary.orange = row.count;
    else if (row.triageLevel === "yellow") summary.yellow = row.count;
    else if (row.triageLevel === "green")  summary.green  = row.count;
    else if (row.triageLevel === "blue")   summary.blue   = row.count;
  }
  res.json(summary);
});

router.get("/:id", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

router.post("/", async (req, res) => {
  const body = CreatePatientBody.parse(req.body);

  if (body.cpf && body.cpf.replace(/\D/g, "").length > 0) {
    if (!validateCPF(body.cpf)) {
      res.status(422).json({ error: "CPF inválido. Verifique o número informado." });
      return;
    }
  }

  const data = buildPatientInsert(body);
  const responsible = data.responsibleProfessional;

  const [patient] = await db.insert(patientsTable).values({
    ...data,
    createdBy: responsible,
    updatedBy: responsible,
    updatedAt: new Date(),
  }).returning();

  await db.insert(patientEvolutionsTable).values({
    patientId: patient.id,
    userId:    0,
    soapText:  "Admissão inicial",
  });

  res.status(201).json(serialize(patient));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdatePatientParams.parse({ id: Number(req.params.id) });
  const body    = UpdatePatientBody.parse(req.body);

  if (body.cpf && body.cpf.replace(/\D/g, "").length > 0) {
    if (!validateCPF(body.cpf)) {
      res.status(422).json({ error: "CPF inválido. Verifique o número informado." });
      return;
    }
  }

  const patch = buildPatientPatch(body);
  const [patient] = await db.update(patientsTable).set({
    ...patch,
    updatedBy: patch.responsibleProfessional ?? "",
    updatedAt: new Date(),
  }).where(eq(patientsTable.id, id)).returning();

  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

router.put("/:id/status", async (req, res) => {
  const { id }           = UpdatePatientStatusParams.parse({ id: Number(req.params.id) });
  const { triage_level } = UpdatePatientStatusBody.parse(req.body);
  const [patient] = await db.update(patientsTable)
    .set({ triageLevel: (triage_level ?? "green") as TriageLevel, updatedAt: new Date() })
    .where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

// ── vitals ────────────────────────────────────────────────────────────────────

router.get("/:id/vitals", async (req, res) => {
  const { id } = GetPatientVitalsParams.parse({ id: Number(req.params.id) });
  const vitals = await db.select()
    .from(vitalsTable)
    .where(eq(vitalsTable.patientId, id))
    .orderBy(desc(vitalsTable.createdAt));
  res.json(vitals.map(serializeVitals));
});

router.post("/:id/vitals", async (req, res) => {
  const { id } = RecordPatientVitalsParams.parse({ id: Number(req.params.id) });
  const body   = RecordPatientVitalsBody.parse(req.body);

  await db.insert(vitalsTable).values({
    patientId: id,
    userId:    0,
    bp:        body.bp      ?? "",
    hr:        body.hr      ?? 0,
    rr:        body.rr      ?? 0,
    spo2:      body.spo2    ?? 0,
    temp:      body.temp    ?? 0,
    glucose:   body.glucose ?? 0,
    note:      body.note    ?? "",
  });

  const bpParts   = (body.bp ?? "").split("/");
  const systolic  = parseInt(bpParts[0] ?? "0") || 0;
  const diastolic = parseInt(bpParts[1] ?? "0") || 0;

  // Vitals are tracked separately; no evolution entry created here

  await db.update(patientsTable).set({ updatedAt: new Date() }).where(eq(patientsTable.id, id));

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

// ── history ───────────────────────────────────────────────────────────────────

router.get("/:id/history", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const evolutions = await db.select()
    .from(patientEvolutionsTable)
    .where(eq(patientEvolutionsTable.patientId, id))
    .orderBy(desc(patientEvolutionsTable.createdAt));
  res.json(evolutions.map(serializeEvolution));
});

router.post("/:id/history", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const body   = req.body as { userId: number; soapText: string };
  const [entry] = await db.insert(patientEvolutionsTable).values({
    patientId: id,
    userId:    body.userId   ?? 0,
    soapText:  body.soapText ?? "",
  }).returning();
  res.status(201).json(serializeEvolution(entry));
});

// ── prescriptions ─────────────────────────────────────────────────────────────

router.get("/:id/prescriptions", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const prescriptions = await db.select()
    .from(patientPrescriptionsTable)
    .where(eq(patientPrescriptionsTable.patientId, id))
    .orderBy(desc(patientPrescriptionsTable.createdAt));
  res.json(prescriptions.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/:id/prescriptions", async (req, res) => {
  const { id } = AddPatientPrescriptionParams.parse({ id: Number(req.params.id) });
  const body   = AddPatientPrescriptionBody.parse(req.body);
  const [prescription] = await db.insert(patientPrescriptionsTable).values({
    patientId: id,
    userId:    body.userId,
    type:      body.type as "nursing" | "medical",
    content:   body.content,
    status:    "pendente",
  }).returning();
  res.status(201).json({
    ...prescription,
    createdAt: prescription.createdAt.toISOString(),
  });
});

router.put("/:id/prescriptions/:prescriptionId/status", async (req, res) => {
  const { id, prescriptionId } = UpdatePrescriptionStatusParams.parse({
    id: Number(req.params.id),
    prescriptionId: Number(req.params.prescriptionId),
  });
  const body = UpdatePrescriptionStatusBody.parse(req.body);
  const [prescription] = await db.update(patientPrescriptionsTable)
    .set({ status: body.status as "pendente" | "em_andamento" | "concluido" })
    .where(eq(patientPrescriptionsTable.id, prescriptionId))
    .returning();
  if (!prescription) { res.status(404).json({ error: "Prescrição não encontrada" }); return; }
  res.json({
    ...prescription,
    createdAt: prescription.createdAt.toISOString(),
  });
});

// ── tasks ─────────────────────────────────────────────────────────────────────

router.get("/:id/tasks", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const tasks  = await db.select()
    .from(patientTasksTable)
    .where(eq(patientTasksTable.patientId, id))
    .orderBy(desc(patientTasksTable.createdAt));
  res.json(tasks.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
});

router.post("/:id/tasks", async (req, res) => {
  const { id } = AddPatientTaskParams.parse({ id: Number(req.params.id) });
  const body   = AddPatientTaskBody.parse(req.body);
  const [task] = await db.insert(patientTasksTable).values({
    patientId:   id,
    items:       body.items,
    status:      "pendente",
    responsible: body.responsible,
    notes:       body.notes ?? "",
    updatedAt:   new Date(),
  }).returning();
  res.status(201).json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.put("/:id/tasks/:taskId/status", async (req, res) => {
  const { id, taskId } = UpdateTaskStatusParams.parse({
    id: Number(req.params.id),
    taskId: Number(req.params.taskId),
  });
  const body   = UpdateTaskStatusBody.parse(req.body);
  const [task] = await db.update(patientTasksTable)
    .set({ status: body.status as "pendente" | "concluido", updatedAt: new Date() })
    .where(eq(patientTasksTable.id, taskId))
    .returning();
  if (!task) { res.status(404).json({ error: "Pendência não encontrada" }); return; }
  res.json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const { id } = DeletePatientParams.parse({ id: Number(req.params.id) });
  await db.delete(patientsTable).where(eq(patientsTable.id, id));
  res.status(204).send();
});

export default router;
