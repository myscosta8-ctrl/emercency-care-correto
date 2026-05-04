import { Router } from "express";
import { db, patientDevicesTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";
import { z } from "zod";

const router = Router({ mergeParams: true });
type Params = Record<string, string>;

const serialize = (d: typeof patientDevicesTable.$inferSelect) => ({
  id:            d.id,
  patientId:     d.patientId,
  deviceType:    d.deviceType,
  insertionDate: d.insertionDate,
  insertionSite: d.insertionSite,
  notes:         d.notes,
  removedAt:     d.removedAt ? d.removedAt.toISOString() : null,
  createdBy:     d.createdBy,
  createdAt:     d.createdAt.toISOString(),
  updatedAt:     d.updatedAt.toISOString(),
});

const AddDeviceBody = z.object({
  deviceType:    z.string().min(1),
  insertionDate: z.string().min(1),
  insertionSite: z.string().default(""),
  notes:         z.string().default(""),
  createdBy:     z.number().int().default(0),
});

const UpdateDeviceBody = z.object({
  insertionSite: z.string().optional(),
  notes:         z.string().optional(),
  removedAt:     z.string().nullable().optional(),
});

router.get("/", async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const onlyActive = req.query["active"] === "true";

  const query = db
    .select()
    .from(patientDevicesTable)
    .where(
      onlyActive
        ? and(eq(patientDevicesTable.patientId, patientId), isNull(patientDevicesTable.removedAt))
        : eq(patientDevicesTable.patientId, patientId)
    )
    .orderBy(desc(patientDevicesTable.createdAt));

  const rows = await query;
  res.json(rows.map(serialize));
});

router.post("/", requirePermissao("registrar_evolucao"), async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const body = AddDeviceBody.parse(req.body);

  const [row] = await db
    .insert(patientDevicesTable)
    .values({
      patientId,
      deviceType:    body.deviceType,
      insertionDate: body.insertionDate,
      insertionSite: body.insertionSite,
      notes:         body.notes,
      createdBy:     body.createdBy,
    })
    .returning();

  res.status(201).json(serialize(row));
});

router.put("/:deviceId", requirePermissao("registrar_evolucao"), async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const deviceId  = Number((req.params as Params)["deviceId"]);
  const body = UpdateDeviceBody.parse(req.body);

  const patch: Partial<typeof patientDevicesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.insertionSite !== undefined) patch.insertionSite = body.insertionSite;
  if (body.notes         !== undefined) patch.notes         = body.notes;
  if (body.removedAt     !== undefined) {
    patch.removedAt = body.removedAt ? new Date(body.removedAt) : null;
  }

  const [updated] = await db
    .update(patientDevicesTable)
    .set(patch)
    .where(and(
      eq(patientDevicesTable.id, deviceId),
      eq(patientDevicesTable.patientId, patientId),
    ))
    .returning();

  if (!updated) { res.status(404).json({ error: "Dispositivo não encontrado" }); return; }
  res.json(serialize(updated));
});

router.delete("/:deviceId", requirePermissao("registrar_evolucao"), async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const deviceId  = Number((req.params as Params)["deviceId"]);
  await db
    .delete(patientDevicesTable)
    .where(and(
      eq(patientDevicesTable.id, deviceId),
      eq(patientDevicesTable.patientId, patientId),
    ));
  res.status(204).send();
});

export default router;
