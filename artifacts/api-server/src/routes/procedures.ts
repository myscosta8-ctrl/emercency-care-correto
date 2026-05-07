import { Router } from "express";
import { db, patientProceduresTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

const ser = (r: typeof patientProceduresTable.$inferSelect) => ({
  id: r.id, patientId: r.patientId,
  procedureName: r.procedureName, procedureType: r.procedureType,
  description: r.description, materialsUsed: r.materialsUsed,
  complications: r.complications, outcome: r.outcome,
  performedByName: r.performedByName, performedById: r.performedById,
  performedAt: r.performedAt, createdAt: r.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(patientProceduresTable)
    .where(eq(patientProceduresTable.patientId, patientId))
    .orderBy(desc(patientProceduresTable.createdAt));
  res.json(rows.map(ser));
});

router.post("/", requirePermissao("registrar_procedimento"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const b = req.body as Record<string, string>;
  if (!b.procedureName?.trim()) { res.status(400).json({ error: "Nome do procedimento é obrigatório" }); return; }
  const staff = req.staff;
  const [row] = await db.insert(patientProceduresTable).values({
    patientId, procedureName: b.procedureName.trim(),
    procedureType: b.procedureType?.trim() ?? "",
    description: b.description?.trim() ?? "",
    materialsUsed: b.materialsUsed?.trim() ?? "",
    complications: b.complications?.trim() ?? "",
    outcome: b.outcome?.trim() ?? "",
    performedByName: staff?.name ?? "", performedById: staff?.id ?? 0,
    performedAt: b.performedAt?.trim() ?? new Date().toISOString(),
  }).returning();
  res.status(201).json(ser(row));
});

export default router;
