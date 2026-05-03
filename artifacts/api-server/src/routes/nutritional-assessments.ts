import { Router } from "express";
import { db, nutritionalAssessmentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });
type Params = Record<string, string>;

const serialize = (n: typeof nutritionalAssessmentsTable.$inferSelect) => ({
  id:        n.id,
  patientId: n.patientId,
  userId:    n.userId,
  content:   n.content,
  createdAt: n.createdAt.toISOString(),
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

router.post("/", async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const { userId, content } = req.body as { userId?: number; content?: string };

  if (!content?.trim()) {
    res.status(400).json({ error: "Conteúdo da avaliação é obrigatório" });
    return;
  }

  const [created] = await db
    .insert(nutritionalAssessmentsTable)
    .values({ patientId, userId: userId ?? 0, content: content.trim() })
    .returning();

  res.status(201).json(serialize(created));
});

export default router;
