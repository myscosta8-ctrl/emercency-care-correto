import { Router } from "express";
import { db, bedsTable, patientsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router();

const SEED_DATA = [
  { bedId: "VS-01", sector: "sala_vermelha",         bedNumber: 1,  isIsolation: false },
  { bedId: "VS-02", sector: "sala_vermelha",         bedNumber: 2,  isIsolation: false },
  { bedId: "VS-03", sector: "sala_vermelha",         bedNumber: 3,  isIsolation: false },
  { bedId: "VS-04", sector: "sala_vermelha",         bedNumber: 4,  isIsolation: false },

  { bedId: "OA-01", sector: "observacao_adulto",     bedNumber: 1,  isIsolation: false },
  { bedId: "OA-02", sector: "observacao_adulto",     bedNumber: 2,  isIsolation: false },
  { bedId: "OA-03", sector: "observacao_adulto",     bedNumber: 3,  isIsolation: false },
  { bedId: "OA-04", sector: "observacao_adulto",     bedNumber: 4,  isIsolation: false },
  { bedId: "OA-05", sector: "observacao_adulto",     bedNumber: 5,  isIsolation: false },
  { bedId: "OA-06", sector: "observacao_adulto",     bedNumber: 6,  isIsolation: false },
  { bedId: "OA-07", sector: "observacao_adulto",     bedNumber: 7,  isIsolation: false },
  { bedId: "OA-08", sector: "observacao_adulto",     bedNumber: 8,  isIsolation: false },
  { bedId: "OA-09", sector: "observacao_adulto",     bedNumber: 9,  isIsolation: false },
  { bedId: "OA-10", sector: "observacao_adulto",     bedNumber: 10, isIsolation: false },
  { bedId: "OA-11", sector: "observacao_adulto",     bedNumber: 11, isIsolation: false },
  { bedId: "OA-12", sector: "observacao_adulto",     bedNumber: 12, isIsolation: false },
  { bedId: "OA-13", sector: "observacao_adulto",     bedNumber: 13, isIsolation: false },
  { bedId: "OA-14", sector: "observacao_adulto",     bedNumber: 14, isIsolation: false },
  { bedId: "OA-15", sector: "observacao_adulto",     bedNumber: 15, isIsolation: false },
  { bedId: "OA-16", sector: "observacao_adulto",     bedNumber: 16, isIsolation: false },
  { bedId: "OA-ISO",sector: "observacao_adulto",     bedNumber: 17, isIsolation: true  },

  { bedId: "OP-01", sector: "observacao_pediatrica", bedNumber: 1,  isIsolation: false },
  { bedId: "OP-02", sector: "observacao_pediatrica", bedNumber: 2,  isIsolation: false },
  { bedId: "OP-03", sector: "observacao_pediatrica", bedNumber: 3,  isIsolation: false },
  { bedId: "OP-04", sector: "observacao_pediatrica", bedNumber: 4,  isIsolation: false },
  { bedId: "OP-05", sector: "observacao_pediatrica", bedNumber: 5,  isIsolation: false },
  { bedId: "OP-ISO",sector: "observacao_pediatrica", bedNumber: 6,  isIsolation: true  },

  { bedId: "PA-01", sector: "observacao_pre_adulto", bedNumber: 1,  isIsolation: false },
  { bedId: "PA-02", sector: "observacao_pre_adulto", bedNumber: 2,  isIsolation: false },
  { bedId: "PA-03", sector: "observacao_pre_adulto", bedNumber: 3,  isIsolation: false },
  { bedId: "PA-04", sector: "observacao_pre_adulto", bedNumber: 4,  isIsolation: false },
  { bedId: "PA-05", sector: "observacao_pre_adulto", bedNumber: 5,  isIsolation: false },
  { bedId: "PA-06", sector: "observacao_pre_adulto", bedNumber: 6,  isIsolation: false },
  { bedId: "PA-07", sector: "observacao_pre_adulto", bedNumber: 7,  isIsolation: false },
  { bedId: "PA-ISO",sector: "observacao_pre_adulto", bedNumber: 8,  isIsolation: true  },
];

async function ensureSeeded() {
  const existing = await db.select({ id: bedsTable.id }).from(bedsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(bedsTable).values(SEED_DATA);
  }
}

const serializeBed = (bed: typeof bedsTable.$inferSelect, patient?: typeof patientsTable.$inferSelect | null) => ({
  id:              bed.id,
  bedId:           bed.bedId,
  sector:          bed.sector,
  bedNumber:       bed.bedNumber,
  isIsolation:     bed.isIsolation,
  isOccupied:      bed.isOccupied,
  patientId:       bed.patientId,
  isolationActive: bed.isolationActive,
  isolationType:   bed.isolationType,
  isolationReason: bed.isolationReason,
  patient: patient ? {
    id:           patient.id,
    fullName:     patient.fullName,
    triageLevel:  patient.triageLevel,
    sector:       patient.sector,
    diagnosis:    patient.diagnosis,
  } : null,
});

router.get("/", async (req, res) => {
  await ensureSeeded();
  const beds = await db.select().from(bedsTable).orderBy(bedsTable.id);

  const patientIds = beds.filter(b => b.patientId).map(b => b.patientId!);
  const patients = patientIds.length
    ? await db.select().from(patientsTable).where(inArray(patientsTable.id, patientIds))
    : [];

  const pMap = new Map(patients.map(p => [p.id, p]));
  res.json(beds.map(b => serializeBed(b, b.patientId ? pMap.get(b.patientId) : null)));
});

router.get("/:id", async (req, res) => {
  await ensureSeeded();
  const id = Number(req.params["id"]);
  const [bed] = await db.select().from(bedsTable).where(eq(bedsTable.id, id));
  if (!bed) { res.status(404).json({ error: "Leito não encontrado" }); return; }

  let patient = null;
  if (bed.patientId) {
    const [p] = await db.select().from(patientsTable).where(eq(patientsTable.id, bed.patientId));
    patient = p ?? null;
  }
  res.json(serializeBed(bed, patient));
});

router.put("/:id", requirePermissao("registrar_sinais_vitais"), async (req, res) => {
  const id = Number(req.params["id"]);
  const body = req.body as {
    isOccupied?:      boolean;
    patientId?:       number | null;
    isolationActive?: boolean;
    isolationType?:   string | null;
    isolationReason?: string | null;
  };

  const [current] = await db.select().from(bedsTable).where(eq(bedsTable.id, id));
  if (!current) { res.status(404).json({ error: "Leito não encontrado" }); return; }

  if (body.isolationActive === true && !current.isIsolation) {
    res.status(400).json({ error: "Apenas leitos de isolamento podem ativar precaução de isolamento." });
    return;
  }

  const patch: Partial<typeof bedsTable.$inferInsert> = { updatedAt: new Date() };

  if (body.isOccupied !== undefined) patch.isOccupied = body.isOccupied;
  if ("patientId" in body)           patch.patientId  = body.patientId ?? undefined;
  if (body.isolationActive !== undefined) {
    patch.isolationActive = body.isolationActive;
    if (!body.isolationActive) {
      patch.isolationType   = null;
      patch.isolationReason = null;
    }
  }
  if ("isolationType"   in body) patch.isolationType   = body.isolationType ?? null;
  if ("isolationReason" in body) patch.isolationReason = body.isolationReason ?? null;

  if (body.isOccupied === false) {
    patch.patientId       = undefined;
    patch.isolationActive = false;
    patch.isolationType   = null;
    patch.isolationReason = null;
  }

  const [updated] = await db
    .update(bedsTable)
    .set(patch)
    .where(eq(bedsTable.id, id))
    .returning();

  let patient = null;
  if (updated.patientId) {
    const [p] = await db.select().from(patientsTable).where(eq(patientsTable.id, updated.patientId));
    patient = p ?? null;
  }
  res.json(serializeBed(updated, patient));
});

export default router;
