import { Router } from "express";
import { db, internalNotificationsTable } from "@workspace/db";
import { eq, desc, or, isNull } from "drizzle-orm";

const router = Router();

const ser = (r: typeof internalNotificationsTable.$inferSelect) => ({
  id: r.id, senderId: r.senderId, senderName: r.senderName,
  recipientId: r.recipientId, patientId: r.patientId, patientName: r.patientName,
  type: r.type, title: r.title, message: r.message,
  readAt: r.readAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
});

// GET /api/internal-notifications — get my notifications (for current staff)
router.get("/", async (req, res) => {
  const staffId = req.staff?.id ?? 0;
  const rows = await db.select().from(internalNotificationsTable)
    .where(or(eq(internalNotificationsTable.recipientId, staffId), isNull(internalNotificationsTable.recipientId)))
    .orderBy(desc(internalNotificationsTable.createdAt))
    .limit(50);
  res.json(rows.map(ser));
});

// POST /api/internal-notifications — send a notification
router.post("/", async (req, res) => {
  const b = req.body as Record<string, string | number | null>;
  if (!String(b.title ?? "").trim() || !String(b.message ?? "").trim()) {
    res.status(400).json({ error: "Título e mensagem são obrigatórios" }); return;
  }
  const staff = req.staff;
  const [row] = await db.insert(internalNotificationsTable).values({
    senderId: staff?.id ?? 0, senderName: staff?.name ?? "Sistema",
    recipientId: b.recipientId ? Number(b.recipientId) : null,
    patientId: b.patientId ? Number(b.patientId) : null,
    patientName: String(b.patientName ?? ""),
    type: String(b.type ?? "observacao"),
    title: String(b.title).trim(), message: String(b.message).trim(),
  }).returning();
  res.status(201).json(ser(row));
});

// PATCH /api/internal-notifications/:id/read
router.patch("/:notifId/read", async (req, res) => {
  const id = Number(req.params["notifId"]);
  const [row] = await db.update(internalNotificationsTable)
    .set({ readAt: new Date() })
    .where(eq(internalNotificationsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Notificação não encontrada" }); return; }
  res.json(ser(row));
});

export default router;
