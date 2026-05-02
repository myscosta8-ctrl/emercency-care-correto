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
  AddVitalsParams,
  AddVitalsBody,
  CreatePatientPrescriptionParams,
  CreatePatientPrescriptionBody,
  UpdatePrescriptionStatusParams,
  UpdatePrescriptionStatusBody,
  CreatePatientTaskParams,
  CreatePatientTaskBody,
  UpdateTaskStatusParams,
  UpdateTaskStatusBody,
} from "@workspace/api-zod";

const router = Router();

const serialize = (p: typeof patientsTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

const serializeEvolution = (e: typeof patientEvolutionsTable.$inferSelect) => ({
  ...e,
  createdAt: e.createdAt.toISOString(),
});

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
    if (row.status === "red") summary.red = row.count;
    else if (row.status === "orange") summary.orange = row.count;
    else if (row.status === "yellow") summary.yellow = row.count;
    else if (row.status === "green") summary.green = row.count;
    else if (row.status === "blue") summary.blue = row.count;
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
  const [patient] = await db.insert(patientsTable).values({
    name: body.name,
    age: body.age,
    status: body.status,
    sector: body.sector,
    internmentStatus: body.internmentStatus,
    bed: body.bed ?? "",
    diagnosis: body.diagnosis ?? "",
    heartRate: body.heartRate ?? 0,
    respiratoryRate: body.respiratoryRate ?? 0,
    glucose: body.glucose ?? 0,
    spO2: body.spO2 ?? 0,
    temperature: body.temperature ?? 0,
    systolicBp: body.systolicBp ?? 0,
    diastolicBp: body.diastolicBp ?? 0,
    nurse: body.nurse ?? "",
    updatedAt: new Date(),
  }).returning();

  await db.insert(patientEvolutionsTable).values({
    patientId: patient.id,
    heartRate: body.heartRate ?? null,
    respiratoryRate: body.respiratoryRate ?? null,
    glucose: body.glucose ?? null,
    spO2: body.spO2 ?? null,
    temperature: body.temperature ?? null,
    systolicBp: body.systolicBp ?? null,
    diastolicBp: body.diastolicBp ?? null,
    responsible: body.nurse ?? "",
    note: "Admissão inicial",
    subjective: "",
    assessment: "",
    plan: "",
  });

  res.status(201).json(serialize(patient));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdatePatientParams.parse({ id: Number(req.params.id) });
  const body = UpdatePatientBody.parse(req.body);
  const [patient] = await db.update(patientsTable).set({
    name: body.name,
    age: body.age,
    status: body.status,
    sector: body.sector,
    internmentStatus: body.internmentStatus,
    bed: body.bed ?? "",
    diagnosis: body.diagnosis ?? "",
    heartRate: body.heartRate ?? 0,
    respiratoryRate: body.respiratoryRate ?? 0,
    glucose: body.glucose ?? 0,
    spO2: body.spO2 ?? 0,
    temperature: body.temperature ?? 0,
    systolicBp: body.systolicBp ?? 0,
    diastolicBp: body.diastolicBp ?? 0,
    nurse: body.nurse ?? "",
    updatedAt: new Date(),
  }).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

router.patch("/:id/status", async (req, res) => {
  const { id } = UpdatePatientStatusParams.parse({ id: Number(req.params.id) });
  const { status } = UpdatePatientStatusBody.parse(req.body);
  const [patient] = await db.update(patientsTable).set({ status, updatedAt: new Date() }).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

router.post("/:id/vitals", async (req, res) => {
  const { id } = AddVitalsParams.parse({ id: Number(req.params.id) });
  const body = AddVitalsBody.parse(req.body);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.heartRate !== undefined) updateData.heartRate = body.heartRate;
  if (body.respiratoryRate !== undefined) updateData.respiratoryRate = body.respiratoryRate;
  if (body.glucose !== undefined) updateData.glucose = body.glucose;
  if (body.spO2 !== undefined) updateData.spO2 = body.spO2;
  if (body.temperature !== undefined) updateData.temperature = body.temperature;
  if (body.systolicBp !== undefined) updateData.systolicBp = body.systolicBp;
  if (body.diastolicBp !== undefined) updateData.diastolicBp = body.diastolicBp;
  if (body.responsible) updateData.nurse = body.responsible;

  const [patient] = await db.update(patientsTable).set(updateData).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  await db.insert(patientEvolutionsTable).values({
    patientId: id,
    heartRate: body.heartRate ?? null,
    respiratoryRate: body.respiratoryRate ?? null,
    glucose: body.glucose ?? null,
    spO2: body.spO2 ?? null,
    temperature: body.temperature ?? null,
    systolicBp: body.systolicBp ?? null,
    diastolicBp: body.diastolicBp ?? null,
    painScale: body.painScale ?? null,
    consciousnessLevel: body.consciousnessLevel ?? null,
    generalCondition: body.generalCondition ?? null,
    subjective: body.subjective ?? "",
    assessment: body.assessment ?? "",
    plan: body.plan ?? "",
    responsible: body.responsible,
    note: body.note ?? "",
  });

  res.json(serialize(patient));
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
  const { id } = CreatePatientPrescriptionParams.parse({ id: Number(req.params.id) });
  const body = CreatePatientPrescriptionBody.parse(req.body);
  const [prescription] = await db.insert(patientPrescriptionsTable).values({
    patientId: id,
    items: body.items,
    status: body.status ?? "pendente",
    responsible: body.responsible,
    scheduledTime: body.scheduledTime ?? "",
    notes: body.notes ?? "",
    updatedAt: new Date(),
  }).returning();
  res.status(201).json({
    ...prescription,
    createdAt: prescription.createdAt.toISOString(),
    updatedAt: prescription.updatedAt.toISOString(),
  });
});

router.patch("/:id/prescriptions/:prescriptionId", async (req, res) => {
  const { id, prescriptionId } = UpdatePrescriptionStatusParams.parse({
    id: Number(req.params.id),
    prescriptionId: Number(req.params.prescriptionId),
  });
  const body = UpdatePrescriptionStatusBody.parse(req.body);
  const [prescription] = await db.update(patientPrescriptionsTable)
    .set({
      status: body.status,
      ...(body.responsible ? { responsible: body.responsible } : {}),
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
  const tasks = await db.select()
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
  const { id } = CreatePatientTaskParams.parse({ id: Number(req.params.id) });
  const body = CreatePatientTaskBody.parse(req.body);
  const [task] = await db.insert(patientTasksTable).values({
    patientId: id,
    items: body.items,
    status: body.status ?? "pendente",
    responsible: body.responsible,
    notes: body.notes ?? "",
    updatedAt: new Date(),
  }).returning();
  res.status(201).json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.patch("/:id/tasks/:taskId", async (req, res) => {
  const { id, taskId } = UpdateTaskStatusParams.parse({
    id: Number(req.params.id),
    taskId: Number(req.params.taskId),
  });
  const body = UpdateTaskStatusBody.parse(req.body);
  const [task] = await db.update(patientTasksTable)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(patientTasksTable.id, taskId))
    .returning();
  if (!task) { res.status(404).json({ error: "Pendência não encontrada" }); return; }
  res.json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.get("/:id/history", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const evolutions = await db.select()
    .from(patientEvolutionsTable)
    .where(eq(patientEvolutionsTable.patientId, id))
    .orderBy(desc(patientEvolutionsTable.createdAt));
  res.json(evolutions.map(serializeEvolution));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeletePatientParams.parse({ id: Number(req.params.id) });
  await db.delete(patientsTable).where(eq(patientsTable.id, id));
  res.status(204).send();
});

export default router;
