import { Router } from "express";
import { db, pharmacyDispensationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

const ser = (r: typeof pharmacyDispensationsTable.$inferSelect) => ({
  id: r.id, patientId: r.patientId, prescriptionId: r.prescriptionId,
  medicationName: r.medicationName, quantity: r.quantity, unit: r.unit,
  batchNumber: r.batchNumber, expiryDate: r.expiryDate,
  dispensedById: r.dispensedById, dispensedByName: r.dispensedByName,
  notes: r.notes, returned: r.returned,
  returnedAt: r.returnedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(pharmacyDispensationsTable)
    .where(eq(pharmacyDispensationsTable.patientId, patientId))
    .orderBy(desc(pharmacyDispensationsTable.createdAt));
  res.json(rows.map(ser));
});

router.post("/", requirePermissao("registrar_dispensacao"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const b = req.body as Record<string, string | number>;
  if (!String(b.medicationName ?? "").trim()) {
    res.status(400).json({ error: "Medicamento é obrigatório" }); return;
  }
  const staff = req.staff;
  const [row] = await db.insert(pharmacyDispensationsTable).values({
    patientId, prescriptionId: b.prescriptionId ? Number(b.prescriptionId) : null,
    medicationName: String(b.medicationName).trim(),
    quantity: String(b.quantity ?? ""), unit: String(b.unit ?? ""),
    batchNumber: String(b.batchNumber ?? ""), expiryDate: String(b.expiryDate ?? ""),
    dispensedById: staff?.id ?? 0, dispensedByName: staff?.name ?? "",
    notes: String(b.notes ?? ""),
  }).returning();
  res.status(201).json(ser(row));
});

router.patch("/:dispId/return", requirePermissao("registrar_dispensacao"), async (req, res) => {
  const id = Number((req.params as P)["dispId"]);
  const [row] = await db.update(pharmacyDispensationsTable).set({
    returned: true, returnedAt: new Date(),
  }).where(eq(pharmacyDispensationsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Registro não encontrado" }); return; }
  res.json(ser(row));
});

export default router;
