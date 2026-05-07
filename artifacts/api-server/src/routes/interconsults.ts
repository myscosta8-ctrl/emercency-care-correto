import { Router } from "express";
import { db, interconsultsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

const ser = (r: typeof interconsultsTable.$inferSelect) => ({
  id: r.id, patientId: r.patientId,
  requestingSpecialty: r.requestingSpecialty, requestedSpecialty: r.requestedSpecialty,
  reason: r.reason, urgency: r.urgency, status: r.status, response: r.response,
  requestedById: r.requestedById, requestedByName: r.requestedByName,
  respondedById: r.respondedById, respondedByName: r.respondedByName,
  requestedAt: r.requestedAt.toISOString(),
  respondedAt: r.respondedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(interconsultsTable)
    .where(eq(interconsultsTable.patientId, patientId))
    .orderBy(desc(interconsultsTable.createdAt));
  res.json(rows.map(ser));
});

router.post("/", requirePermissao("registrar_interconsulta"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const b = req.body as Record<string, string>;
  if (!b.requestedSpecialty?.trim()) { res.status(400).json({ error: "Especialidade solicitada é obrigatória" }); return; }
  const staff = req.staff;
  const [row] = await db.insert(interconsultsTable).values({
    patientId, requestingSpecialty: b.requestingSpecialty?.trim() ?? "",
    requestedSpecialty: b.requestedSpecialty.trim(),
    reason: b.reason?.trim() ?? "", urgency: b.urgency ?? "eletivo",
    status: "solicitado",
    requestedById: staff?.id ?? 0, requestedByName: staff?.name ?? "",
  }).returning();
  res.status(201).json(ser(row));
});

router.patch("/:interconsultId/respond", requirePermissao("registrar_interconsulta"), async (req, res) => {
  const id = Number((req.params as P)["interconsultId"]);
  const { response } = req.body as { response?: string };
  const staff = req.staff;
  const [row] = await db.update(interconsultsTable).set({
    status: "respondido", response: response?.trim() ?? "",
    respondedById: staff?.id ?? 0, respondedByName: staff?.name ?? "",
    respondedAt: new Date(),
  }).where(eq(interconsultsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Interconsulta não encontrada" }); return; }
  res.json(ser(row));
});

export default router;
