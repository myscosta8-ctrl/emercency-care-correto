import { Router } from "express";
import { db, patientAllergiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

const ser = (r: typeof patientAllergiesTable.$inferSelect) => ({
  id: r.id, patientId: r.patientId, allergen: r.allergen,
  reactionType: r.reactionType, severity: r.severity, notes: r.notes,
  recordedByName: r.recordedByName, recordedById: r.recordedById,
  createdAt: r.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(patientAllergiesTable)
    .where(eq(patientAllergiesTable.patientId, patientId))
    .orderBy(desc(patientAllergiesTable.createdAt));
  res.json(rows.map(ser));
});

router.post("/", requirePermissao("registrar_alergia"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const { allergen, reactionType, severity, notes } = req.body as Record<string, string>;
  if (!allergen?.trim()) { res.status(400).json({ error: "Alergeno é obrigatório" }); return; }
  const staff = req.staff;
  const [row] = await db.insert(patientAllergiesTable).values({
    patientId, allergen: allergen.trim(),
    reactionType: reactionType?.trim() ?? "",
    severity: (["leve","moderada","grave"].includes(severity) ? severity : "moderada") as "leve"|"moderada"|"grave",
    notes: notes?.trim() ?? "",
    recordedByName: staff?.name ?? "", recordedById: staff?.id ?? 0,
  }).returning();
  res.status(201).json(ser(row));
});

router.delete("/:allergyId", requirePermissao("registrar_alergia"), async (req, res) => {
  const id = Number((req.params as P)["allergyId"]);
  await db.delete(patientAllergiesTable).where(eq(patientAllergiesTable.id, id));
  res.status(204).end();
});

export default router;
