import { Router } from "express";
import { db, patientNotificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  AddPatientNotificationBody,
  UpdatePatientNotificationBody,
} from "@workspace/api-zod";

const router = Router({ mergeParams: true });
type Params = Record<string, string>;

const serializeNotif = (n: typeof patientNotificationsTable.$inferSelect) => ({
  ...n,
  createdAt: n.createdAt.toISOString(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const notifications = await db
    .select()
    .from(patientNotificationsTable)
    .where(eq(patientNotificationsTable.patientId, patientId))
    .orderBy(desc(patientNotificationsTable.createdAt));
  res.json(notifications.map(serializeNotif));
});

router.post("/", async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const body = AddPatientNotificationBody.parse(req.body);
  const [notif] = await db
    .insert(patientNotificationsTable)
    .values({
      patientId,
      disease:        body.disease,
      classification: body.classification,
      pdfUrl:         "",
    })
    .returning();
  res.status(201).json(serializeNotif(notif));
});

router.patch("/:notificationId", async (req, res) => {
  const patientId      = Number((req.params as Params)["id"]);
  const notificationId = Number((req.params as Params)["notificationId"]);
  const body = UpdatePatientNotificationBody.parse(req.body);

  const patch: Partial<typeof patientNotificationsTable.$inferInsert> = {};
  if (body.disease        !== undefined) patch.disease        = body.disease;
  if (body.classification !== undefined) patch.classification = body.classification;
  if (body.pdfUrl         !== undefined) patch.pdfUrl         = body.pdfUrl;

  const [notif] = await db
    .update(patientNotificationsTable)
    .set(patch)
    .where(
      and(
        eq(patientNotificationsTable.id, notificationId),
        eq(patientNotificationsTable.patientId, patientId),
      )
    )
    .returning();
  if (!notif) { res.status(404).json({ error: "Notificação não encontrada" }); return; }
  res.json(serializeNotif(notif));
});

router.delete("/:notificationId", async (req, res) => {
  const patientId      = Number((req.params as Params)["id"]);
  const notificationId = Number((req.params as Params)["notificationId"]);
  await db.delete(patientNotificationsTable).where(
    and(
      eq(patientNotificationsTable.id, notificationId),
      eq(patientNotificationsTable.patientId, patientId),
    )
  );
  res.status(204).send();
});

export default router;
