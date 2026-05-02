import { Router } from "express";
import { db, patientsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreatePatientBody,
  UpdatePatientBody,
  GetPatientParams,
  UpdatePatientParams,
  DeletePatientParams,
  UpdatePatientStatusParams,
  UpdatePatientStatusBody,
} from "@workspace/api-zod";

const router = Router();

const serialize = (p: typeof patientsTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patients = await db.select().from(patientsTable).orderBy(patientsTable.createdAt);
  res.json(patients.map(serialize));
});

router.get("/summary", async (req, res) => {
  const rows = await db
    .select({
      status: patientsTable.status,
      count: sql<number>`count(*)::int`,
    })
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
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }
  res.json(serialize(patient));
});

router.post("/", async (req, res) => {
  const body = CreatePatientBody.parse(req.body);
  const [patient] = await db.insert(patientsTable).values({ ...body, updatedAt: new Date() }).returning();
  res.status(201).json(serialize(patient));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdatePatientParams.parse({ id: Number(req.params.id) });
  const body = UpdatePatientBody.parse(req.body);
  const [patient] = await db.update(patientsTable).set({ ...body, updatedAt: new Date() }).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }
  res.json(serialize(patient));
});

router.patch("/:id/status", async (req, res) => {
  const { id } = UpdatePatientStatusParams.parse({ id: Number(req.params.id) });
  const { status } = UpdatePatientStatusBody.parse(req.body);
  const [patient] = await db.update(patientsTable).set({ status, updatedAt: new Date() }).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }
  res.json(serialize(patient));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeletePatientParams.parse({ id: Number(req.params.id) });
  await db.delete(patientsTable).where(eq(patientsTable.id, id));
  res.status(204).send();
});

export default router;
