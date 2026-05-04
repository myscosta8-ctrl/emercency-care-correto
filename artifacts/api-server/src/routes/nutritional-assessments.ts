import { Router } from "express";
import { db, nutritionalAssessmentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type Params = Record<string, string>;

const serialize = (n: typeof nutritionalAssessmentsTable.$inferSelect) => ({
  id:             n.id,
  patientId:      n.patientId,
  userId:         n.userId,
  content:        n.content,
  structuredData: n.structuredData ?? null,
  createdAt:      n.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const rows = await db
    .select()
    .from(nutritionalAssessmentsTable)
    .where(eq(nutritionalAssessmentsTable.patientId, patientId))
    .orderBy(desc(nutritionalAssessmentsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/", requirePermissao("registrar_avaliacao_nutricional"), async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const { content, structuredData } = req.body as {
    userId?: number;
    content?: string;
    structuredData?: Record<string, unknown> | null;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "Conteúdo da avaliação é obrigatório" });
    return;
  }

  const staffId = req.staff?.id ?? 0;

  const [created] = await db
    .insert(nutritionalAssessmentsTable)
    .values({
      patientId,
      userId: staffId,
      content: content.trim(),
      structuredData: structuredData ?? null,
    })
    .returning();

  res.status(201).json(serialize(created));
});

export default router;
