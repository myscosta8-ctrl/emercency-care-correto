import { Router } from "express";
import { db, socialNotesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type Params = Record<string, string>;

const serialize = (n: typeof socialNotesTable.$inferSelect) => ({
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
    .from(socialNotesTable)
    .where(eq(socialNotesTable.patientId, patientId))
    .orderBy(desc(socialNotesTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/", requirePermissao("registrar_nota_social"), async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const { content } = req.body as { userId?: number; content?: string };

  if (!content?.trim()) {
    res.status(400).json({ error: "Conteúdo da nota é obrigatório" });
    return;
  }

  const staffId = req.staff?.id ?? 0;

  const [created] = await db
    .insert(socialNotesTable)
    .values({ patientId, userId: staffId, content: content.trim() })
    .returning();

  res.status(201).json(serialize(created));
});

export default router;
