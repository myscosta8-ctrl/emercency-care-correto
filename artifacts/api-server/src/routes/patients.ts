import { Router } from "express";
import { db, patientsTable, patientEvolutionsTable, patientPrescriptionsTable, patientTasksTable } from "@workspace/db";
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

type PatientStatus = "red" | "orange" | "yellow" | "green" | "blue";
type PatientSetor = "sala_vermelha" | "observacao_adulto" | "observacao_pediatrica" | "observacao_pre_adulto";
type InternmentStatus = "internado" | "nao_internado";

/** Full insert payload for patient creation */
function buildPatientInsert(body: typeof CreatePatientBody._type) {
  const age = body.birthDate ? ageFromBirthDate(body.birthDate) : (body.age ?? 0);
  return {
    nome:                    body.nome,
    birthDate:               body.birthDate ?? "",
    age,
    sex:                     (body.sex ?? "O") as "M" | "F" | "O",
    motherName:              body.motherName ?? "",
    cns:                     body.cns ?? "",
    cpf:                     body.cpf ?? "",
    rg:                      body.rg ?? "",
    weight:                  body.weight ?? 0,
    height:                  body.height ?? 0,
    phone:                   body.phone ?? "",
    email:                   body.email ?? "",
    guardianName:            "",
    street:                  body.street ?? "",
    addressNumber:           body.addressNumber ?? "",
    addressComplement:       body.addressComplement ?? "",
    neighborhood:            body.neighborhood ?? "",
    city:                    body.city ?? "",
    addressState:            body.addressState ?? "",
    zipCode:                 body.zipCode ?? "",
    status:                  (body.status ?? "green") as PatientStatus,
    setor:                   body.setor as PatientSetor,
    internmentStatus:        (body.internmentStatus ?? "nao_internado") as InternmentStatus,
    bed:                     body.bed ?? "",
    diagnosis:               body.diagnosis ?? "",
    symptoms:                body.symptoms ?? "",
    symptomOnsetDate:        body.symptomOnsetDate ?? "",
    heartRate:               body.heartRate ?? 0,
    respiratoryRate:         body.respiratoryRate ?? 0,
    glucose:                 body.glucose ?? 0,
    spO2:                    body.spO2 ?? 0,
    temperature:             body.temperature ?? 0,
    systolicBp:              body.systolicBp ?? 0,
    diastolicBp:             body.diastolicBp ?? 0,
    nurse:                   body.responsibleProfessional ?? "",
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

/** Partial patch payload for patient update (only sets provided fields) */
function buildPatientPatch(body: typeof UpdatePatientBody._type): Partial<typeof patientsTable.$inferInsert> {
  const patch: Partial<typeof patientsTable.$inferInsert> = {};
  if (body.nome              !== undefined) patch.nome              = body.nome;
  if (body.birthDate         !== undefined) {
    patch.birthDate = body.birthDate;
    patch.age = ageFromBirthDate(body.birthDate);
  }
  if (body.age               !== undefined) patch.age               = body.age;
  if (body.sex               !== undefined) patch.sex               = body.sex as "M" | "F" | "O";
  if (body.motherName        !== undefined) patch.motherName        = body.motherName;
  if (body.cns               !== undefined) patch.cns               = body.cns;
  if (body.cpf               !== undefined) patch.cpf               = body.cpf;
  if (body.rg                !== undefined) patch.rg                = body.rg;
  if (body.weight            !== undefined) patch.weight            = body.weight;
  if (body.height            !== undefined) patch.height            = body.height;
  if (body.phone             !== undefined) patch.phone             = body.phone;
  if (body.email             !== undefined) patch.email             = body.email;
  if (body.street            !== undefined) patch.street            = body.street;
  if (body.addressNumber     !== undefined) patch.addressNumber     = body.addressNumber;
  if (body.addressComplement !== undefined) patch.addressComplement = body.addressComplement;
  if (body.neighborhood      !== undefined) patch.neighborhood      = body.neighborhood;
  if (body.city              !== undefined) patch.city              = body.city;
  if (body.addressState      !== undefined) patch.addressState      = body.addressState;
  if (body.zipCode           !== undefined) patch.zipCode           = body.zipCode;
  if (body.status            !== undefined) patch.status            = body.status as PatientStatus;
  if (body.setor             !== undefined) patch.setor             = body.setor as PatientSetor;
  if (body.internmentStatus  !== undefined) patch.internmentStatus  = body.internmentStatus as InternmentStatus;
  if (body.bed               !== undefined) patch.bed               = body.bed;
  if (body.diagnosis         !== undefined) patch.diagnosis         = body.diagnosis;
  if (body.symptoms          !== undefined) patch.symptoms          = body.symptoms;
  if (body.symptomOnsetDate  !== undefined) patch.symptomOnsetDate  = body.symptomOnsetDate;
  if (body.heartRate         !== undefined) patch.heartRate         = body.heartRate;
  if (body.respiratoryRate   !== undefined) patch.respiratoryRate   = body.respiratoryRate;
  if (body.glucose           !== undefined) patch.glucose           = body.glucose;
  if (body.spO2              !== undefined) patch.spO2              = body.spO2;
  if (body.temperature       !== undefined) patch.temperature       = body.temperature;
  if (body.systolicBp        !== undefined) patch.systolicBp        = body.systolicBp;
  if (body.diastolicBp       !== undefined) patch.diastolicBp       = body.diastolicBp;
  if (body.attendanceDate          !== undefined) patch.attendanceDate          = body.attendanceDate;
  if (body.attendanceTime          !== undefined) patch.attendanceTime          = body.attendanceTime;
  if (body.healthUnit              !== undefined) patch.healthUnit              = body.healthUnit;
  if (body.responsibleProfessional !== undefined) {
    patch.responsibleProfessional = body.responsibleProfessional;
    patch.nurse = body.responsibleProfessional;
  }
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
    .select({ status: patientsTable.status, count: sql<number>`count(*)::int` })
    .from(patientsTable)
    .groupBy(patientsTable.status);

  const summary = { total: 0, red: 0, orange: 0, yellow: 0, green: 0, blue: 0 };
  for (const row of rows) {
    summary.total += row.count;
    if (row.status === "red")         summary.red    = row.count;
    else if (row.status === "orange") summary.orange = row.count;
    else if (row.status === "yellow") summary.yellow = row.count;
    else if (row.status === "green")  summary.green  = row.count;
    else if (row.status === "blue")   summary.blue   = row.count;
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
  const data = buildPatientInsert(body);
  const responsible = data.responsibleProfessional;

  const [patient] = await db.insert(patientsTable).values({
    ...data,
    createdBy: responsible,
    updatedBy: responsible,
    updatedAt: new Date(),
  }).returning();

  await db.insert(patientEvolutionsTable).values({
    patientId:       patient.id,
    heartRate:       body.heartRate ?? null,
    respiratoryRate: body.respiratoryRate ?? null,
    glucose:         body.glucose ?? null,
    spO2:            body.spO2 ?? null,
    temperature:     body.temperature ?? null,
    systolicBp:      body.systolicBp ?? null,
    diastolicBp:     body.diastolicBp ?? null,
    responsible:     responsible,
    note:            "Admissão inicial",
    subjective:      "",
    assessment:      "",
    plan:            "",
  });

  res.status(201).json(serialize(patient));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdatePatientParams.parse({ id: Number(req.params.id) });
  const body    = UpdatePatientBody.parse(req.body);
  const patch   = buildPatientPatch(body);

  const [patient] = await db.update(patientsTable).set({
    ...patch,
    updatedBy: patch.responsibleProfessional ?? "",
    updatedAt: new Date(),
  }).where(eq(patientsTable.id, id)).returning();

  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

router.put("/:id/status", async (req, res) => {
  const { id }     = UpdatePatientStatusParams.parse({ id: Number(req.params.id) });
  const { status } = UpdatePatientStatusBody.parse(req.body);
  const [patient]  = await db.update(patientsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

router.post("/:id/vitals", async (req, res) => {
  const { id } = RecordPatientVitalsParams.parse({ id: Number(req.params.id) });
  const body   = RecordPatientVitalsBody.parse(req.body);

  const updateData: Partial<typeof patientsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.heartRate       !== undefined) updateData.heartRate       = body.heartRate;
  if (body.respiratoryRate !== undefined) updateData.respiratoryRate = body.respiratoryRate;
  if (body.glucose         !== undefined) updateData.glucose         = body.glucose;
  if (body.spO2            !== undefined) updateData.spO2            = body.spO2;
  if (body.temperature     !== undefined) updateData.temperature     = body.temperature;
  if (body.systolicBp      !== undefined) updateData.systolicBp      = body.systolicBp;
  if (body.diastolicBp     !== undefined) updateData.diastolicBp     = body.diastolicBp;
  if (body.responsible)                   updateData.nurse           = body.responsible;

  const [patient] = await db.update(patientsTable).set(updateData).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  await db.insert(patientEvolutionsTable).values({
    patientId:         id,
    heartRate:         body.heartRate ?? null,
    respiratoryRate:   body.respiratoryRate ?? null,
    glucose:           body.glucose ?? null,
    spO2:              body.spO2 ?? null,
    temperature:       body.temperature ?? null,
    systolicBp:        body.systolicBp ?? null,
    diastolicBp:       body.diastolicBp ?? null,
    responsible:       body.responsible,
    note:              body.note              ?? "",
    subjective:        body.subjective        ?? "",
    assessment:        body.assessment        ?? "",
    plan:              body.plan              ?? "",
    painScale:         body.painScale         ?? null,
    consciousnessLevel: body.consciousnessLevel ?? null,
    generalCondition:  body.generalCondition  ?? null,
    createdBy:         body.responsible,
  });

  res.json(serialize(patient));
});

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
  const body   = req.body as { note: string; author: string };
  const [entry] = await db.insert(patientEvolutionsTable).values({
    patientId:   id,
    note:        body.note ?? "",
    responsible: body.author ?? "",
    subjective:  "",
    assessment:  "",
    plan:        "",
    createdBy:   body.author ?? "",
  }).returning();
  res.status(201).json(serializeEvolution(entry));
});

router.get("/:id/prescriptions", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const prescriptions = await db.select()
    .from(patientPrescriptionsTable)
    .where(eq(patientPrescriptionsTable.patientId, id))
    .orderBy(desc(patientPrescriptionsTable.createdAt));
  res.json(prescriptions.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  })));
});

router.post("/:id/prescriptions", async (req, res) => {
  const { id } = AddPatientPrescriptionParams.parse({ id: Number(req.params.id) });
  const body   = AddPatientPrescriptionBody.parse(req.body);
  const [prescription] = await db.insert(patientPrescriptionsTable).values({
    patientId:     id,
    items:         body.items,
    status:        "pendente",
    responsible:   body.responsible,
    scheduledTime: body.scheduledTime ?? "",
    notes:         body.notes ?? "",
    updatedAt:     new Date(),
  }).returning();
  res.status(201).json({
    ...prescription,
    createdAt: prescription.createdAt.toISOString(),
    updatedAt: prescription.updatedAt.toISOString(),
  });
});

router.put("/:id/prescriptions/:prescriptionId/status", async (req, res) => {
  const { id, prescriptionId } = UpdatePrescriptionStatusParams.parse({
    id: Number(req.params.id),
    prescriptionId: Number(req.params.prescriptionId),
  });
  const body = UpdatePrescriptionStatusBody.parse(req.body);
  const [prescription] = await db.update(patientPrescriptionsTable)
    .set({
      status:        body.status as "pendente" | "em_andamento" | "concluido",
      ...(body.responsible   ? { responsible:   body.responsible   } : {}),
      ...(body.scheduledTime ? { scheduledTime: body.scheduledTime } : {}),
      updatedAt: new Date(),
    })
    .where(eq(patientPrescriptionsTable.id, prescriptionId))
    .returning();
  if (!prescription) { res.status(404).json({ error: "Prescrição não encontrada" }); return; }
  res.json({
    ...prescription,
    createdAt: prescription.createdAt.toISOString(),
    updatedAt: prescription.updatedAt.toISOString(),
  });
});

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
    patientId:  id,
    items:      body.items,
    status:     "pendente",
    responsible: body.responsible,
    notes:      body.notes ?? "",
    updatedAt:  new Date(),
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

router.delete("/:id", async (req, res) => {
  const { id } = DeletePatientParams.parse({ id: Number(req.params.id) });
  await db.delete(patientsTable).where(eq(patientsTable.id, id));
  res.status(204).send();
});

export default router;
