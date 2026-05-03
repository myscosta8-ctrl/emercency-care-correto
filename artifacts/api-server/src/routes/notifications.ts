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
  updatedAt: n.updatedAt.toISOString(),
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
      types:            body.types ?? "[]",
      otherType:        body.otherType ?? "",
      diagnosis:        body.diagnosis ?? "",
      symptomOnsetDate: body.symptomOnsetDate ?? "",
      situation:        body.situation,
      responsible:      body.responsible,
      notifiedAt:       body.notifiedAt ?? "",
      updatedAt:        new Date(),
    })
    .returning();
  res.status(201).json(serializeNotif(notif));
});

router.patch("/:notificationId", async (req, res) => {
  const patientId      = Number((req.params as Params)["id"]);
  const notificationId = Number((req.params as Params)["notificationId"]);
  const body = UpdatePatientNotificationBody.parse(req.body);

  const patch: Partial<typeof patientNotificationsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.types            !== undefined) patch.types            = body.types;
  if (body.otherType        !== undefined) patch.otherType        = body.otherType;
  if (body.diagnosis        !== undefined) patch.diagnosis        = body.diagnosis;
  if (body.symptomOnsetDate !== undefined) patch.symptomOnsetDate = body.symptomOnsetDate;
  if (body.situation        !== undefined) patch.situation        = body.situation;
  if (body.responsible      !== undefined) patch.responsible      = body.responsible;
  if (body.notifiedAt       !== undefined) patch.notifiedAt       = body.notifiedAt;

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
