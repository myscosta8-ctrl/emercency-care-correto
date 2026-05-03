import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

const serialize = (a: typeof auditLogTable.$inferSelect) => ({
  id: a.id,
  usuario: a.usuario,
  acao: a.acao,
  detalhes: a.detalhes ?? null,
  ip: a.ip ?? null,
  criadoEm: a.criadoEm.toISOString(),
});

router.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 200), 500);
  const rows = await db
    .select()
    .from(auditLogTable)
    .orderBy(desc(auditLogTable.criadoEm))
    .limit(limit);
  res.json(rows.map(serialize));
});

router.post("/", async (req, res) => {
  const { usuario, acao, detalhes } = req.body as {
    usuario: string;
    acao: string;
    detalhes?: string;
  };

  if (!usuario || !acao) {
    res.status(400).json({ error: "usuario e acao são obrigatórios" });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    null;

  const [created] = await db
    .insert(auditLogTable)
    .values({ usuario, acao, detalhes: detalhes ?? null, ip })
    .returning();

  res.status(201).json(serialize(created));
});

export default router;
