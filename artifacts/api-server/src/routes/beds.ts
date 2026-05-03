import { Router } from "express";
import { db, bedsTable, patientsTable } from "@workspace/db";
import { eq, inArray, and, like, sql } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router();

const SECTOR_PREFIXES: Record<string, string> = {
  sala_vermelha:          "VS",
  observacao_adulto:      "OA",
  observacao_pediatrica:  "OP",
  observacao_pre_adulto:  "PA",
};

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

const serializeBed = (
  bed: typeof bedsTable.$inferSelect,
  patient?: typeof patientsTable.$inferSelect | null,
) => ({
  id:              bed.id,
  bedId:           bed.bedId,
  sector:          bed.sector,
  bedNumber:       bed.bedNumber,
  isIsolation:     bed.isIsolation,
  isExtra:         bed.isExtra,
  extraReason:     bed.extraReason,
  isOccupied:      bed.isOccupied,
  patientId:       bed.patientId,
  admissionTime:   bed.admissionTime?.toISOString() ?? null,
  isolationActive: bed.isolationActive,
  isolationType:   bed.isolationType,
  isolationReason: bed.isolationReason,
  patient: patient ? {
    id:          patient.id,
    fullName:    patient.fullName,
    triageLevel: patient.triageLevel,
    sector:      patient.sector,
    diagnosis:   patient.diagnosis,
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

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.isOccupied !== undefined) patch["isOccupied"] = body.isOccupied;

  if ("patientId" in body) {
    const newPatientId = body.patientId ?? null;
    patch["patientId"] = newPatientId;
    if (newPatientId !== null && current.patientId !== newPatientId) {
      patch["admissionTime"] = new Date();
    }
  }

  if (body.isolationActive !== undefined) {
    patch["isolationActive"] = body.isolationActive;
    if (!body.isolationActive) {
      patch["isolationType"]   = null;
      patch["isolationReason"] = null;
    }
  }
  if ("isolationType"   in body) patch["isolationType"]   = body.isolationType ?? null;
  if ("isolationReason" in body) patch["isolationReason"] = body.isolationReason ?? null;

  if (body.isOccupied === false) {
    patch["patientId"]       = null;
    patch["admissionTime"]   = null;
    patch["isolationActive"] = false;
    patch["isolationType"]   = null;
    patch["isolationReason"] = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db
    .update(bedsTable)
    .set(patch as any)
    .where(eq(bedsTable.id, id))
    .returning();

  let patient = null;
  if (updated.patientId) {
    const [p] = await db.select().from(patientsTable).where(eq(patientsTable.id, updated.patientId));
    patient = p ?? null;
  }
  res.json(serializeBed(updated, patient));
});

router.post("/extra", requirePermissao("registrar_sinais_vitais"), async (req, res) => {
  const { sector, extra_reason } = req.body as { sector: string; extra_reason?: string };
  if (!sector || !SECTOR_PREFIXES[sector]) {
    res.status(400).json({ error: "Setor inválido" });
    return;
  }

  const prefix    = SECTOR_PREFIXES[sector]!;
  const pattern   = `${prefix}-EXT-%`;
  const existing  = await db
    .select({ bedId: bedsTable.bedId })
    .from(bedsTable)
    .where(and(eq(bedsTable.sector, sector), eq(bedsTable.isExtra, true)));

  const nextNum  = existing.length + 1;
  let   newBedId = `${prefix}-EXT-${nextNum}`;

  const allIds = await db.select({ bedId: bedsTable.bedId }).from(bedsTable)
    .where(like(bedsTable.bedId, pattern));
  const taken = new Set(allIds.map(r => r.bedId));
  let n = nextNum;
  while (taken.has(newBedId)) { n++; newBedId = `${prefix}-EXT-${n}`; }

  const maxBedNum = existing.length > 0 ? 1000 + n : 1000;

  const [bed] = await db.insert(bedsTable).values({
    bedId:       newBedId,
    sector,
    bedNumber:   maxBedNum,
    isIsolation: false,
    isExtra:     true,
    extraReason: extra_reason ?? null,
  }).returning();

  req.log.info({ action: "extra_bed_created", bedId: newBedId, sector, staffId: req.staff?.id }, "Leito extra criado");
  res.status(201).json(serializeBed(bed, null));
});

router.delete("/:id", requirePermissao("registrar_sinais_vitais"), async (req, res) => {
  const id = Number(req.params["id"]);
  const [bed] = await db.select().from(bedsTable).where(eq(bedsTable.id, id));
  if (!bed) { res.status(404).json({ error: "Leito não encontrado" }); return; }
  if (!bed.isExtra) {
    res.status(400).json({ error: "Apenas leitos extras podem ser removidos." });
    return;
  }
  if (bed.isOccupied) {
    res.status(400).json({ error: "Não é possível remover leito extra com paciente internado." });
    return;
  }
  await db.delete(bedsTable).where(eq(bedsTable.id, id));
  req.log.info({ action: "extra_bed_removed", bedId: bed.bedId, sector: bed.sector, staffId: req.staff?.id }, "Leito extra removido");
  res.status(204).end();
});

export default router;
