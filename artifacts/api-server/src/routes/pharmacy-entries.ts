import { Router } from "express";
import { db, pharmacyEntriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });

type PharmacyStatus = "pendente" | "dispensado" | "devolvido";

const serialize = (n: typeof pharmacyEntriesTable.$inferSelect) => ({
  id:         n.id,
  patientId:  n.patientId,
  userId:     n.userId,
  medication: n.medication,
  status:     n.status,
  notes:      n.notes,
  createdAt:  n.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number(req.params["id"]);
  const rows = await db
    .select()
    .from(pharmacyEntriesTable)
    .where(eq(pharmacyEntriesTable.patientId, patientId))
    .orderBy(desc(pharmacyEntriesTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/", async (req, res) => {
  const patientId = Number(req.params["id"]);
  const { userId, medication, status, notes } = req.body as {
    userId?:     number;
    medication?: string;
    status?:     PharmacyStatus;
    notes?:      string;
  };

  if (!medication?.trim()) {
    res.status(400).json({ error: "Nome do medicamento é obrigatório" });
    return;
  }

  const validStatuses: PharmacyStatus[] = ["pendente", "dispensado", "devolvido"];
  const safeStatus: PharmacyStatus = validStatuses.includes(status as PharmacyStatus)
    ? (status as PharmacyStatus)
    : "pendente";

  const [created] = await db
    .insert(pharmacyEntriesTable)
    .values({
      patientId,
      userId:     userId ?? 0,
      medication: medication.trim(),
      status:     safeStatus,
      notes:      notes?.trim() ?? "",
    })
    .returning();

  res.status(201).json(serialize(created));
});

router.patch("/:entryId/status", async (req, res) => {
  const entryId = Number(req.params["entryId"]);
  const { status } = req.body as { status?: PharmacyStatus };

  const validStatuses: PharmacyStatus[] = ["pendente", "dispensado", "devolvido"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: "Status inválido" });
    return;
  }

  const [updated] = await db
    .update(pharmacyEntriesTable)
    .set({ status })
    .where(eq(pharmacyEntriesTable.id, entryId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Registro não encontrado" }); return; }
  res.json(serialize(updated));
});

export default router;
