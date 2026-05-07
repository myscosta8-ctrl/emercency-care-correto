import { Router } from "express";
import { db, carePlansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

const ser = (r: typeof carePlansTable.$inferSelect) => ({
  id: r.id, patientId: r.patientId, goal: r.goal, interventions: r.interventions,
  responsibleTeam: r.responsibleTeam, targetDate: r.targetDate, status: r.status,
  createdById: r.createdById, createdByName: r.createdByName,
  resolvedByName: r.resolvedByName,
  resolvedAt: r.resolvedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(carePlansTable)
    .where(eq(carePlansTable.patientId, patientId))
    .orderBy(desc(carePlansTable.createdAt));
  res.json(rows.map(ser));
});

router.post("/", requirePermissao("registrar_plano_cuidados"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const b = req.body as Record<string, string>;
  if (!b.goal?.trim()) { res.status(400).json({ error: "Objetivo é obrigatório" }); return; }
  const staff = req.staff;
  const [row] = await db.insert(carePlansTable).values({
    patientId, goal: b.goal.trim(), interventions: b.interventions?.trim() ?? "",
    responsibleTeam: b.responsibleTeam?.trim() ?? "", targetDate: b.targetDate?.trim() ?? "",
    status: "ativo", createdById: staff?.id ?? 0, createdByName: staff?.name ?? "",
  }).returning();
  res.status(201).json(ser(row));
});

router.patch("/:planId/resolve", requirePermissao("registrar_plano_cuidados"), async (req, res) => {
  const id = Number((req.params as P)["planId"]);
  const staff = req.staff;
  const [row] = await db.update(carePlansTable).set({
    status: "resolvido", resolvedByName: staff?.name ?? "", resolvedAt: new Date(),
  }).where(eq(carePlansTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Plano não encontrado" }); return; }
  res.json(ser(row));
});

export default router;
