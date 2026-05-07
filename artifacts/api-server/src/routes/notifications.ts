import { Router } from "express";
import { db, patientNotificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  AddPatientNotificationBody,
  UpdatePatientNotificationBody,
} from "@workspace/api-zod";
import { requirePermissao } from "../middleware/require-auth";

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

router.post("/", requirePermissao("registrar_evolucao"), async (req, res) => {
  const patientId = Number((req.params as Params)["id"]);
  const body = AddPatientNotificationBody.parse(req.body);
  const [notif] = await db
    .insert(patientNotificationsTable)
    .values({
      patientId,
      disease:             body.disease,
      classification:      body.classification,
      pdfUrl:              "",
      agravoCode:          body.agravoCode          ?? "",
      cid10:               body.cid10               ?? "",
      dataNotificacao:     body.dataNotificacao      ?? "",
      dataInicioSintomas:  body.dataInicioSintomas   ?? "",
      logradouro:          body.logradouro           ?? "",
      numeroEndereco:      body.numeroEndereco        ?? "",
      complemento:         body.complemento          ?? "",
      bairro:              body.bairro               ?? "",
      municipioResidencia: body.municipioResidencia  ?? "",
      ufResidencia:        body.ufResidencia         ?? "",
      cep:                 body.cep                  ?? "",
      formData:            body.formData             ?? "{}",
    })
    .returning();
  res.status(201).json(serializeNotif(notif));
});

router.put("/:notificationId", requirePermissao("registrar_evolucao"), async (req, res) => {
  const patientId      = Number((req.params as Params)["id"]);
  const notificationId = Number((req.params as Params)["notificationId"]);
  const body = UpdatePatientNotificationBody.parse(req.body);

  const patch: Partial<typeof patientNotificationsTable.$inferInsert> = {};
  if (body.disease             !== undefined) patch.disease             = body.disease;
  if (body.classification      !== undefined) patch.classification      = body.classification;
  if (body.pdfUrl              !== undefined) patch.pdfUrl              = body.pdfUrl;
  if (body.agravoCode          !== undefined) patch.agravoCode          = body.agravoCode;
  if (body.cid10               !== undefined) patch.cid10               = body.cid10;
  if (body.dataNotificacao     !== undefined) patch.dataNotificacao     = body.dataNotificacao;
  if (body.dataInicioSintomas  !== undefined) patch.dataInicioSintomas  = body.dataInicioSintomas;
  if (body.logradouro          !== undefined) patch.logradouro          = body.logradouro;
  if (body.numeroEndereco      !== undefined) patch.numeroEndereco       = body.numeroEndereco;
  if (body.complemento         !== undefined) patch.complemento         = body.complemento;
  if (body.bairro              !== undefined) patch.bairro              = body.bairro;
  if (body.municipioResidencia !== undefined) patch.municipioResidencia  = body.municipioResidencia;
  if (body.ufResidencia        !== undefined) patch.ufResidencia        = body.ufResidencia;
  if (body.cep                 !== undefined) patch.cep                 = body.cep;
  if (body.formData            !== undefined) patch.formData            = body.formData;

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

router.delete("/:notificationId", requirePermissao("admin"), async (req, res) => {
  const role = req.staff?.role ?? "";
  const isAdmin = role === "administrador" || role === "diretoria_geral";
  if (!isAdmin) { res.status(403).json({ error: "Apenas administradores podem excluir notificações" }); return; }

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
