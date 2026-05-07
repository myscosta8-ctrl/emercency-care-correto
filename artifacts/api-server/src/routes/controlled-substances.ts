import { Router } from "express";
import { db, controlledSubstancesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

const ser = (r: typeof controlledSubstancesTable.$inferSelect) => ({
  id: r.id, patientId: r.patientId, medicationName: r.medicationName,
  portariaClass: r.portariaClass, dose: r.dose, route: r.route,
  quantity: r.quantity, unit: r.unit, instructions: r.instructions,
  prescriberId: r.prescriberId, prescriberName: r.prescriberName, prescriberCrm: r.prescriberCrm,
  status: r.status, dispensedByName: r.dispensedByName,
  dispensedAt: r.dispensedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(controlledSubstancesTable)
    .where(eq(controlledSubstancesTable.patientId, patientId))
    .orderBy(desc(controlledSubstancesTable.createdAt));
  res.json(rows.map(ser));
});

router.post("/", requirePermissao("registrar_medicamento_controlado"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const b = req.body as Record<string, string>;
  if (!b.medicationName?.trim()) { res.status(400).json({ error: "Medicamento é obrigatório" }); return; }
  const staff = req.staff;
  const [row] = await db.insert(controlledSubstancesTable).values({
    patientId, medicationName: b.medicationName.trim(),
    portariaClass: b.portariaClass ?? "B1", dose: b.dose?.trim() ?? "",
    route: b.route?.trim() ?? "", quantity: b.quantity?.trim() ?? "",
    unit: b.unit?.trim() ?? "", instructions: b.instructions?.trim() ?? "",
    prescriberId: staff?.id ?? 0, prescriberName: staff?.name ?? "",
    prescriberCrm: b.prescriberCrm?.trim() ?? "",
  }).returning();
  res.status(201).json(ser(row));
});

router.patch("/:csId/dispense", requirePermissao("registrar_dispensacao"), async (req, res) => {
  const id = Number((req.params as P)["csId"]);
  const staff = req.staff;
  const [row] = await db.update(controlledSubstancesTable).set({
    status: "dispensado", dispensedByName: staff?.name ?? "", dispensedAt: new Date(),
  }).where(eq(controlledSubstancesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Registro não encontrado" }); return; }
  res.json(ser(row));
});

export default router;
