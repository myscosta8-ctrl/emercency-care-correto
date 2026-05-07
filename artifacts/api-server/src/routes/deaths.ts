import { Router } from "express";
import { db, patientDeathsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

const ser = (r: typeof patientDeathsTable.$inferSelect) => ({
  id: r.id, patientId: r.patientId, deathDate: r.deathDate, deathTime: r.deathTime,
  cause1a: r.cause1a, cause1b: r.cause1b, cause1c: r.cause1c, cause2: r.cause2,
  icd: r.icd, typeOfDeath: r.typeOfDeath,
  physicianId: r.physicianId, physicianName: r.physicianName, physicianCrm: r.physicianCrm,
  witnessName: r.witnessName, notes: r.notes, createdAt: r.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(patientDeathsTable)
    .where(eq(patientDeathsTable.patientId, patientId));
  res.json(rows.map(ser));
});

router.post("/", requirePermissao("registrar_obito"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const b = req.body as Record<string, string>;
  if (!b.deathDate) { res.status(400).json({ error: "Data do óbito é obrigatória" }); return; }
  const staff = req.staff;
  const [row] = await db.insert(patientDeathsTable).values({
    patientId, deathDate: b.deathDate, deathTime: b.deathTime ?? "",
    cause1a: b.cause1a ?? "", cause1b: b.cause1b ?? "", cause1c: b.cause1c ?? "",
    cause2: b.cause2 ?? "", icd: b.icd ?? "",
    typeOfDeath: b.typeOfDeath ?? "natural",
    physicianId: staff?.id ?? 0, physicianName: staff?.name ?? "",
    physicianCrm: b.physicianCrm ?? "", witnessName: b.witnessName ?? "",
    notes: b.notes ?? "",
  }).returning();
  res.status(201).json(ser(row));
});

export default router;
