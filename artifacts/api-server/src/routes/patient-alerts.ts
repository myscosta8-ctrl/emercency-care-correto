import { Router } from "express";
import { db, patientAlertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });

const serializeAlert = (a: typeof patientAlertsTable.$inferSelect) => ({
  ...a,
  createdAt:     a.createdAt.toISOString(),
  deactivatedAt: a.deactivatedAt ? a.deactivatedAt.toISOString() : null,
});

const AlertTypes = ["alergia", "risco_queda", "isolamento", "critico", "retorno_72h", "outro"] as const;

const CreateAlertBody = z.object({
  type:          z.enum(AlertTypes),
  descricao:     z.string().default(""),
  createdByName: z.string().default(""),
});

const DeactivateAlertBody = z.object({
  deactivatedByName: z.string().default(""),
  motivoDesativacao: z.string().default(""),
});

function getParam(req: { params: Record<string, string | undefined> }, key: string): number {
  return parseInt(req.params[key] ?? "0", 10);
}

// GET /api/patients/:id/alerts
router.get("/", async (req, res) => {
  const patientId = getParam(req as Parameters<typeof getParam>[0], "id");
  if (!patientId) { res.status(400).json({ error: "Invalid patient ID" }); return; }

  const alerts = await db.select()
    .from(patientAlertsTable)
    .where(eq(patientAlertsTable.patientId, patientId))
    .orderBy(patientAlertsTable.createdAt);

  res.json(alerts.map(serializeAlert));
});

// POST /api/patients/:id/alerts
router.post("/", requirePermissao("editar_paciente"), async (req, res) => {
  const patientId = getParam(req as Parameters<typeof getParam>[0], "id");
  if (!patientId) { res.status(400).json({ error: "Invalid patient ID" }); return; }

  const body = CreateAlertBody.parse(req.body);

  const [alert] = await db.insert(patientAlertsTable).values({
    patientId,
    type:          body.type,
    descricao:     body.descricao,
    ativo:         true,
    createdByName: body.createdByName,
  }).returning();

  res.status(201).json(serializeAlert(alert!));
});

// PATCH /api/patients/:id/alerts/:alertId/deactivate
router.patch("/:alertId/deactivate", requirePermissao("editar_paciente"), async (req, res) => {
  const p = req as Parameters<typeof getParam>[0];
  const patientId = getParam(p, "id");
  const alertId   = getParam(p, "alertId");
  if (!patientId || !alertId) { res.status(400).json({ error: "Invalid ID" }); return; }

  const body = DeactivateAlertBody.parse(req.body);

  const [alert] = await db.update(patientAlertsTable)
    .set({
      ativo:              false,
      deactivatedAt:      new Date(),
      deactivatedByName:  body.deactivatedByName,
      motivoDesativacao:  body.motivoDesativacao,
    })
    .where(and(eq(patientAlertsTable.id, alertId), eq(patientAlertsTable.patientId, patientId)))
    .returning();

  if (!alert) { res.status(404).json({ error: "Alerta não encontrado" }); return; }
  res.json(serializeAlert(alert));
});

// DELETE /api/patients/:id/alerts/:alertId — restrito a administradores
router.delete("/:alertId", requirePermissao("editar_paciente"), async (req, res) => {
  const role = req.staff?.role ?? "";
  const isAdmin = role === "administrador" || role === "diretoria_geral";
  if (!isAdmin) { res.status(403).json({ error: "Apenas administradores podem excluir alertas permanentemente. Use desativar." }); return; }

  const p = req as Parameters<typeof getParam>[0];
  const patientId = getParam(p, "id");
  const alertId   = getParam(p, "alertId");
  if (!patientId || !alertId) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.delete(patientAlertsTable)
    .where(and(eq(patientAlertsTable.id, alertId), eq(patientAlertsTable.patientId, patientId)));

  res.status(204).send();
});

export default router;
