import { Router } from "express";
import { db, patientConsentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

const ser = (r: typeof patientConsentsTable.$inferSelect) => ({
  id: r.id, patientId: r.patientId, consentType: r.consentType,
  title: r.title, description: r.description,
  patientOrGuardianName: r.patientOrGuardianName,
  guardianRelationship: r.guardianRelationship, agreed: r.agreed,
  professionalId: r.professionalId, professionalName: r.professionalName,
  notes: r.notes, createdAt: r.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(patientConsentsTable)
    .where(eq(patientConsentsTable.patientId, patientId))
    .orderBy(desc(patientConsentsTable.createdAt));
  res.json(rows.map(ser));
});

router.post("/", requirePermissao("registrar_consentimento"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const { consentType, title, description, patientOrGuardianName, guardianRelationship, agreed, notes } =
    req.body as Record<string, string | boolean>;
  if (!patientOrGuardianName) { res.status(400).json({ error: "Nome do paciente/responsável é obrigatório" }); return; }
  const staff = req.staff;
  const [row] = await db.insert(patientConsentsTable).values({
    patientId, consentType: String(consentType ?? "geral"),
    title: String(title ?? ""), description: String(description ?? ""),
    patientOrGuardianName: String(patientOrGuardianName),
    guardianRelationship: String(guardianRelationship ?? ""),
    agreed: agreed === true || agreed === "true",
    professionalId: staff?.id ?? 0, professionalName: staff?.name ?? "",
    notes: String(notes ?? ""),
  }).returning();
  res.status(201).json(ser(row));
});

export default router;
