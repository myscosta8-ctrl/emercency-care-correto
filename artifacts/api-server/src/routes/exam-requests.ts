import { Router } from "express";
import { requirePermissao } from "../middleware/require-auth";
import { db, patientExamRequestsTable, patientsTable } from "@workspace/db";
import { eq, desc, and, ne } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const QueryParams = z.object({
  status:   z.enum(["solicitado", "coletado", "laudado", "all"]).optional(),
  priority: z.enum(["urgente", "rotina", "eletivo"]).optional(),
});

const PRIORITY_ORDER: Record<string, number> = { urgente: 0, rotina: 1, eletivo: 2 };

router.get("/", requirePermissao("registrar_exames"), async (req, res) => {
  const query = QueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params", details: query.error.flatten() });
    return;
  }

  const { status, priority } = query.data;

  const conditions = [];

  if (status === "all") {
  } else if (status === "solicitado" || status === "coletado" || status === "laudado") {
    conditions.push(eq(patientExamRequestsTable.status, status));
  } else {
    conditions.push(ne(patientExamRequestsTable.status, "laudado"));
  }

  if (priority) conditions.push(eq(patientExamRequestsTable.prioridade, priority));

  const rows = await db
    .select({
      id:                 patientExamRequestsTable.id,
      patientId:          patientExamRequestsTable.patientId,
      prescriptionId:     patientExamRequestsTable.prescriptionId,
      laboratoriais:      patientExamRequestsTable.laboratoriais,
      imagem:             patientExamRequestsTable.imagem,
      prioridade:         patientExamRequestsTable.prioridade,
      justificativa:      patientExamRequestsTable.justificativa,
      status:             patientExamRequestsTable.status,
      resultText:         patientExamRequestsTable.resultText,
      resultFileName:     patientExamRequestsTable.resultFileName,
      resultFileMime:     patientExamRequestsTable.resultFileMime,
      createdAt:          patientExamRequestsTable.createdAt,
      patientName:        patientsTable.fullName,
      patientBed:         patientsTable.bed,
      patientTriageLevel: patientsTable.triageLevel,
      patientCareStatus:  patientsTable.careStatus,
    })
    .from(patientExamRequestsTable)
    .innerJoin(patientsTable, eq(patientExamRequestsTable.patientId, patientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(patientExamRequestsTable.createdAt));

  const sorted = [...rows].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.prioridade] ?? 99;
    const pb = PRIORITY_ORDER[b.prioridade] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  res.json(sorted.map(r => ({
    ...r,
    laboratoriais: r.laboratoriais as string[],
    imagem:        r.imagem as string[],
    createdAt:     r.createdAt.toISOString(),
  })));
});

export default router;
