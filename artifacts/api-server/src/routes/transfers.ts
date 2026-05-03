import { Router } from "express";
import { db, transfersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });
type Params = Record<string, string>;

const serialize = (t: typeof transfersTable.$inferSelect) => ({
  id:                  t.id,
  patientId:           t.patientId,
  userId:              t.userId,
  destinationHospital: t.destinationHospital,
  specialty:           t.specialty,
  reasonForTransfer:   t.reasonForTransfer,
  transferStatus:      t.transferStatus,
  transportType:       t.transportType,
  regulationContact:   t.regulationContact,
  departureDatetime:   t.departureDatetime?.toISOString() ?? null,
  arrivalConfirmation: t.arrivalConfirmation,
  arrivalDatetime:     t.arrivalDatetime?.toISOString() ?? null,
  createdAt:           t.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const rows = await db
    .select()
    .from(transfersTable)
    .where(eq(transfersTable.patientId, patientId))
    .orderBy(desc(transfersTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/", async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const body = req.body as {
    userId?:              number;
    destinationHospital?: string;
    specialty?:           string;
    reasonForTransfer?:   string;
    transferStatus?:      string;
    transportType?:       string;
    regulationContact?:   string;
    departureDatetime?:   string;
    arrivalConfirmation?: boolean;
    arrivalDatetime?:     string;
  };

  if (!body.destinationHospital?.trim()) {
    res.status(400).json({ error: "Hospital de destino é obrigatório" });
    return;
  }
  if (!body.reasonForTransfer?.trim()) {
    res.status(400).json({ error: "Motivo do encaminhamento é obrigatório" });
    return;
  }

  const validStatuses = ["Solicitado", "Autorizado", "Em transferência", "Transferido", "Recusado"];
  const safeStatus = validStatuses.includes(body.transferStatus ?? "") ? body.transferStatus! : "Solicitado";

  const [created] = await db
    .insert(transfersTable)
    .values({
      patientId,
      userId:              body.userId ?? 0,
      destinationHospital: body.destinationHospital.trim(),
      specialty:           body.specialty?.trim() ?? "",
      reasonForTransfer:   body.reasonForTransfer.trim(),
      transferStatus:      safeStatus,
      transportType:       body.transportType?.trim() ?? "",
      regulationContact:   body.regulationContact?.trim() ?? "",
      departureDatetime:   body.departureDatetime ? new Date(body.departureDatetime) : null,
      arrivalConfirmation: body.arrivalConfirmation ?? false,
      arrivalDatetime:     body.arrivalDatetime ? new Date(body.arrivalDatetime) : null,
    })
    .returning();

  res.status(201).json(serialize(created));
});

router.patch("/:transferId", async (req, res) => {
  const transferId = Number((req.params as Params)["transferId"]);
  const body = req.body as {
    transferStatus?:      string;
    arrivalConfirmation?: boolean;
    arrivalDatetime?:     string;
    regulationContact?:   string;
    departureDatetime?:   string;
  };

  const updates: Partial<typeof transfersTable.$inferInsert> = {};
  if (body.transferStatus) {
    const validStatuses = ["Solicitado", "Autorizado", "Em transferência", "Transferido", "Recusado"];
    if (validStatuses.includes(body.transferStatus)) updates.transferStatus = body.transferStatus;
  }
  if (body.arrivalConfirmation !== undefined) updates.arrivalConfirmation = body.arrivalConfirmation;
  if (body.arrivalDatetime)   updates.arrivalDatetime   = new Date(body.arrivalDatetime);
  if (body.regulationContact !== undefined) updates.regulationContact = body.regulationContact;
  if (body.departureDatetime) updates.departureDatetime = new Date(body.departureDatetime);

  const [updated] = await db
    .update(transfersTable)
    .set(updates)
    .where(eq(transfersTable.id, transferId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Transferência não encontrada" }); return; }
  res.json(serialize(updated));
});

export default router;
