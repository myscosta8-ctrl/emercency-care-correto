import { Router } from "express";
import { db, patientsTable, patientEvolutionsTable } from "@workspace/db";
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
} from "@workspace/api-zod";

const router = Router();

const serialize = (p: typeof patientsTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

const serializeEvolution = (e: typeof patientEvolutionsTable.$inferSelect) => ({
  id: e.id,
  patientId: e.patientId,
  ...(e.heartRate != null ? { heartRate: e.heartRate } : {}),
  ...(e.respiratoryRate != null ? { respiratoryRate: e.respiratoryRate } : {}),
  ...(e.glucose != null ? { glucose: e.glucose } : {}),
  responsible: e.responsible,
  note: e.note,
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
    bed: body.bed ?? "",
    diagnosis: body.diagnosis ?? "",
    heartRate: body.heartRate ?? 0,
    respiratoryRate: body.respiratoryRate ?? 0,
    glucose: body.glucose ?? 0,
    nurse: body.nurse ?? "",
    updatedAt: new Date(),
  }).returning();

  await db.insert(patientEvolutionsTable).values({
    patientId: patient.id,
    heartRate: body.heartRate ?? null,
    respiratoryRate: body.respiratoryRate ?? null,
    glucose: body.glucose ?? null,
    responsible: body.nurse ?? "",
    note: "Admissão inicial",
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
    bed: body.bed ?? "",
    diagnosis: body.diagnosis ?? "",
    heartRate: body.heartRate ?? 0,
    respiratoryRate: body.respiratoryRate ?? 0,
    glucose: body.glucose ?? 0,
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
  if (body.responsible) updateData.nurse = body.responsible;

  const [patient] = await db.update(patientsTable).set(updateData).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  await db.insert(patientEvolutionsTable).values({
    patientId: id,
    heartRate: body.heartRate ?? null,
    respiratoryRate: body.respiratoryRate ?? null,
    glucose: body.glucose ?? null,
    responsible: body.responsible,
    note: body.note ?? "",
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

router.delete("/:id", async (req, res) => {
  const { id } = DeletePatientParams.parse({ id: Number(req.params.id) });
  await db.delete(patientsTable).where(eq(patientsTable.id, id));
  res.status(204).send();
});

export default router;
