import { Router } from "express";
import { requirePermissao } from "../middleware/require-auth";
import { db, pool, patientsTable, patientEvolutionsTable, patientPrescriptionsTable, patientTasksTable, vitalsTable, examResultsTable, patientExamRequestsTable, staffTable } from "@workspace/db";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  CreatePatientBody,
  UpdatePatientBody,
  GetPatientParams,
  UpdatePatientParams,
  DeletePatientParams,
  UpdatePatientStatusParams,
  UpdatePatientStatusBody,
  RecordPatientVitalsParams,
  RecordPatientVitalsBody,
  GetPatientVitalsParams,
  AddPatientPrescriptionParams,
  AddPatientPrescriptionBody,
  UpdatePrescriptionStatusParams,
  UpdatePrescriptionStatusBody,
  AddPatientTaskParams,
  AddPatientTaskBody,
  UpdateTaskStatusParams,
  UpdateTaskStatusBody,
  AddPatientExamRequestParams,
  AddPatientExamRequestBody,
  UpdateExamRequestStatusParams,
  UpdateExamRequestStatusBody,
  ListPatientsQueryParams,
} from "@workspace/api-zod";

const router = Router();

// ── CPF validation ─────────────────────────────────────────────────────────────
function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]!) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(digits[9]!)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]!) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(digits[10]!)) return false;
  return true;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const serialize = (p: typeof patientsTable.$inferSelect) => ({
  ...p,
  // snake_case aliases to match OpenAPI spec and generated TypeScript types
  full_name:    p.fullName,
  triage_level: p.triageLevel,
  careStatus:   p.careStatus,
  careStatusChangedAt: p.careStatusChangedAt.toISOString(),
  createdAt:    p.createdAt.toISOString(),
  updatedAt:    p.updatedAt.toISOString(),
});

const serializeEvolution = (e: typeof patientEvolutionsTable.$inferSelect) => ({
  ...e,
  createdAt: e.createdAt.toISOString(),
});

const serializeVitals = (v: typeof vitalsTable.$inferSelect) => ({
  ...v,
  createdAt: v.createdAt.toISOString(),
});

function ageFromBirthDate(birthDate: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

type TriageLevel   = "red" | "orange" | "yellow" | "green" | "blue";
type PatientSector = "triagem" | "sala_vermelha" | "observacao_adulto" | "observacao_pediatrica" | "observacao_pre_adulto";
type InternStatus  = "internado" | "nao_internado";
type CareStatus    = "Em Triagem" | "Aguardando Atendimento" | "Em Atendimento (Cons. 1)" | "Em Atendimento (Cons. 2)" | "Em Observação" | "Internado" | "Em Transferência" | "Alta";

const CARE_STATUSES: CareStatus[] = [
  "Em Triagem", "Aguardando Atendimento", "Em Atendimento (Cons. 1)", "Em Atendimento (Cons. 2)", "Em Observação", "Internado", "Em Transferência", "Alta",
];

function generateProntuarioNumber(id: number): string {
  const year = new Date().getFullYear();
  return `PRN-${year}-${String(id).padStart(5, "0")}`;
}

function generateAtendimentoNumber(id: number): string {
  const year = new Date().getFullYear();
  const seq = Date.now() % 100000;
  const seqStr = String(seq).padStart(5, "0");
  return `ATD-${year}-${String(id).padStart(4, "0")}${seqStr.slice(-1)}`;
}

/** Full insert payload for patient creation */
function buildPatientInsert(body: typeof CreatePatientBody._type) {
  const age = body.birthDate ? ageFromBirthDate(body.birthDate) : (body.age ?? 0);
  const rawCareStatus = (body as Record<string, unknown>).care_status as string | undefined;
  const careStatus = (CARE_STATUSES.includes(rawCareStatus as CareStatus) ? rawCareStatus : "Em Triagem") as CareStatus;
  return {
    fullName:                body.full_name,
    birthDate:               body.birthDate ?? "",
    age,
    sex:                     (body.sex ?? "O") as "M" | "F" | "O",
    motherName:              body.motherName ?? "",
    cns:                     body.cns ?? "",
    cpf:                     body.cpf ?? "",
    rg:                      body.rg ?? "",
    address:                 body.address ?? "",
    phone:                   body.phone ?? "",
    email:                   body.email ?? "",
    triageLevel:             (body.triage_level ?? "green") as TriageLevel,
    sector:                  body.sector as PatientSector,
    internmentStatus:        (body.internmentStatus ?? "nao_internado") as InternStatus,
    careStatus,
    careStatusChangedAt:     new Date(),
    bed:                     body.bed ?? "",
    diagnosis:               body.diagnosis ?? "",
    symptoms:                body.symptoms ?? "",
    symptomOnsetDate:        body.symptomOnsetDate ?? "",
    nurse:                   body.nurse ?? "",
    attendanceDate:          body.attendanceDate ?? "",
    attendanceTime:          body.attendanceTime ?? "",
    healthUnit:              body.healthUnit ?? "UPA Breves - Breves/PA",
    responsibleProfessional: body.responsibleProfessional ?? "",
    agravo:                  body.agravo ?? "",
    dataNotificacao:         body.dataNotificacao ?? "",
    municipioNotificacao:    body.municipioNotificacao ?? "",
    codigoIbge:              body.codigoIbge ?? "",
    evolucaoCaso:            body.evolucaoCaso ?? "",
    classificacaoFinal:      body.classificacaoFinal ?? "",
    criterioConfirmacao:     body.criterioConfirmacao ?? "",
  };
}

/** Partial patch payload for patient update */
function buildPatientPatch(body: typeof UpdatePatientBody._type): Partial<typeof patientsTable.$inferInsert> {
  const patch: Partial<typeof patientsTable.$inferInsert> = {};
  if (body.full_name         !== undefined) patch.fullName         = body.full_name;
  if (body.birthDate         !== undefined) {
    patch.birthDate = body.birthDate;
    patch.age = ageFromBirthDate(body.birthDate);
  }
  if (body.age               !== undefined) patch.age              = body.age;
  if (body.sex               !== undefined) patch.sex              = body.sex as "M" | "F" | "O";
  if (body.motherName        !== undefined) patch.motherName       = body.motherName;
  if (body.cns               !== undefined) patch.cns              = body.cns;
  if (body.cpf               !== undefined) patch.cpf              = body.cpf;
  if (body.rg                !== undefined) patch.rg               = body.rg;
  if (body.address           !== undefined) patch.address          = body.address;
  if (body.phone             !== undefined) patch.phone            = body.phone;
  if (body.email             !== undefined) patch.email            = body.email;
  if (body.triage_level      !== undefined) patch.triageLevel      = body.triage_level as TriageLevel;
  if (body.sector            !== undefined) patch.sector           = body.sector as PatientSector;
  if (body.internmentStatus  !== undefined) patch.internmentStatus = body.internmentStatus as InternStatus;
  const rawCs = (body as Record<string, unknown>).care_status as string | undefined;
  if (rawCs !== undefined && CARE_STATUSES.includes(rawCs as CareStatus)) {
    patch.careStatus = rawCs as CareStatus;
    patch.careStatusChangedAt = new Date();
  }
  if (body.bed               !== undefined) patch.bed              = body.bed;
  if (body.diagnosis         !== undefined) patch.diagnosis        = body.diagnosis;
  if (body.symptoms          !== undefined) patch.symptoms         = body.symptoms;
  if (body.symptomOnsetDate  !== undefined) patch.symptomOnsetDate = body.symptomOnsetDate;
  if (body.nurse             !== undefined) patch.nurse            = body.nurse;
  if (body.attendanceDate          !== undefined) patch.attendanceDate          = body.attendanceDate;
  if (body.attendanceTime          !== undefined) patch.attendanceTime          = body.attendanceTime;
  if (body.healthUnit              !== undefined) patch.healthUnit              = body.healthUnit;
  if (body.responsibleProfessional !== undefined) patch.responsibleProfessional = body.responsibleProfessional;
  if (body.agravo              !== undefined) patch.agravo              = body.agravo;
  if (body.dataNotificacao     !== undefined) patch.dataNotificacao     = body.dataNotificacao;
  if (body.municipioNotificacao !== undefined) patch.municipioNotificacao = body.municipioNotificacao;
  if (body.codigoIbge          !== undefined) patch.codigoIbge          = body.codigoIbge;
  if (body.evolucaoCaso        !== undefined) patch.evolucaoCaso        = body.evolucaoCaso;
  if (body.classificacaoFinal  !== undefined) patch.classificacaoFinal  = body.classificacaoFinal;
  if (body.criterioConfirmacao !== undefined) patch.criterioConfirmacao = body.criterioConfirmacao;
  return patch;
}

// ── routes ────────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const parsed = ListPatientsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
    return;
  }
  const { exam, examType, examStatus, examPriority } = parsed.data;

  const hasExamFilter = exam || examType || examStatus || examPriority;

  if (!hasExamFilter) {
    const patients = await db.select().from(patientsTable).orderBy(patientsTable.createdAt);
    res.json(patients.map(serialize));
    return;
  }

  // Build parameterized conditions for exam_requests
  const conditions: string[] = [];
  const values: string[] = [];

  // Default to "pending" (solicitado or coletado) when no explicit status is provided
  // so that `exam=Hemograma` returns patients with *pending* exam, not completed ones
  if (examStatus) {
    conditions.push(`er.status = $${values.length + 1}`);
    values.push(examStatus);
  } else {
    conditions.push(`er.status != 'laudado'`);
  }

  if (examPriority) {
    conditions.push(`er.prioridade = $${values.length + 1}`);
    values.push(examPriority);
  }

  if (exam) {
    if (examType === "imagem") {
      conditions.push(`er.imagem @> $${values.length + 1}::jsonb`);
      values.push(JSON.stringify([exam]));
    } else if (examType === "laboratorial") {
      conditions.push(`er.laboratoriais @> $${values.length + 1}::jsonb`);
      values.push(JSON.stringify([exam]));
    } else {
      // Match either array
      conditions.push(`(er.laboratoriais @> $${values.length + 1}::jsonb OR er.imagem @> $${values.length + 1}::jsonb)`);
      values.push(JSON.stringify([exam]));
    }
  } else if (examType) {
    if (examType === "imagem") {
      conditions.push(`jsonb_array_length(er.imagem) > 0`);
    } else {
      conditions.push(`jsonb_array_length(er.laboratoriais) > 0`);
    }
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  // Fetch patient IDs with distinct match, then fetch their matching exam requests
  const matchingRows = await pool.query(
    `SELECT DISTINCT patient_id FROM patient_exam_requests er ${whereClause}`,
    values,
  );
  const matchingIds = (matchingRows.rows as { patient_id: number }[]).map(r => r.patient_id);

  if (matchingIds.length === 0) {
    res.json([]);
    return;
  }

  // Fetch patient records
  const patients = await db.select().from(patientsTable)
    .where(inArray(patientsTable.id, matchingIds))
    .orderBy(patientsTable.createdAt);

  // Fetch the matching pending exam requests for each patient
  const examRows = await pool.query(
    `SELECT id, patient_id, laboratoriais, imagem, prioridade, status, created_at
     FROM patient_exam_requests er
     ${whereClause}
     AND er.patient_id = ANY($${values.length + 1}::int[])
     ORDER BY created_at DESC`,
    [...values, `{${matchingIds.join(",")}}`],
  );

  type ExamRow = {
    id: number;
    patient_id: number;
    laboratoriais: string[];
    imagem: string[];
    prioridade: string;
    status: string;
    created_at: string;
  };

  // Group exam requests by patient id
  const examsByPatient = new Map<number, ExamRow[]>();
  for (const row of examRows.rows as ExamRow[]) {
    const list = examsByPatient.get(row.patient_id) ?? [];
    list.push(row);
    examsByPatient.set(row.patient_id, list);
  }

  res.json(patients.map(p => ({
    ...serialize(p),
    pendingExams: (examsByPatient.get(p.id) ?? []).map(e => ({
      id:           e.id,
      laboratoriais: e.laboratoriais as string[],
      imagem:       e.imagem as string[],
      prioridade:   e.prioridade,
      status:       e.status,
      createdAt:    e.created_at,
    })),
  })));
});

router.get("/summary", async (req, res) => {
  const rows = await db
    .select({ triageLevel: patientsTable.triageLevel, count: sql<number>`count(*)::int` })
    .from(patientsTable)
    .where(sql`${patientsTable.careStatus} != 'Alta'`)
    .groupBy(patientsTable.triageLevel);

  const summary = { total: 0, red: 0, orange: 0, yellow: 0, green: 0, blue: 0 };
  for (const row of rows) {
    summary.total += row.count;
    if      (row.triageLevel === "red")    summary.red    = row.count;
    else if (row.triageLevel === "orange") summary.orange = row.count;
    else if (row.triageLevel === "yellow") summary.yellow = row.count;
    else if (row.triageLevel === "green")  summary.green  = row.count;
    else if (row.triageLevel === "blue")   summary.blue   = row.count;
  }
  res.json(summary);
});

// GET /patients/previous-visits?cpf=xxx&excludeId=yyy
// Returns Alta'd patients with that CPF (previous visits of the same person)
router.get("/previous-visits", async (req, res) => {
  const { cpf, excludeId } = req.query;
  if (!cpf || typeof cpf !== "string" || !cpf.trim()) {
    res.json([]);
    return;
  }
  const excluded = excludeId ? parseInt(excludeId as string, 10) : 0;
  const results = await db.select()
    .from(patientsTable)
    .where(
      and(
        eq(patientsTable.cpf, cpf.trim()),
        eq(patientsTable.careStatus, "Alta"),
        excluded > 0 ? sql`${patientsTable.id} != ${excluded}` : sql`true`,
      )
    )
    .orderBy(desc(patientsTable.createdAt))
    .limit(20);
  res.json(results.map(serialize));
});

router.get("/:id", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

router.post("/", requirePermissao("criar_paciente"), async (req, res) => {
  const body = CreatePatientBody.parse(req.body);

  if (body.cpf && body.cpf.replace(/\D/g, "").length > 0) {
    if (!validateCPF(body.cpf)) {
      res.status(422).json({ error: "CPF inválido. Verifique o número informado." });
      return;
    }
  }

  const data = buildPatientInsert(body);
  const responsible = data.responsibleProfessional;

  const [patientRaw] = await db.insert(patientsTable).values({
    ...data,
    createdBy: responsible,
    updatedBy: responsible,
    updatedAt: new Date(),
  }).returning();

  const prontuarioNumber  = generateProntuarioNumber(patientRaw.id);
  const atendimentoNumber = generateAtendimentoNumber(patientRaw.id);
  const [patient] = await db.update(patientsTable)
    .set({ prontuarioNumber, atendimentoNumber })
    .where(eq(patientsTable.id, patientRaw.id))
    .returning();

  await db.insert(patientEvolutionsTable).values({
    patientId: patient.id,
    userId:    0,
    soapText:  `Admissão inicial — Prontuário: ${prontuarioNumber} | Atendimento: ${atendimentoNumber}`,
  });

  res.status(201).json(serialize(patient));
});

router.put("/:id", requirePermissao("editar_paciente"), async (req, res) => {
  const { id } = UpdatePatientParams.parse({ id: Number(req.params.id) });
  const body    = UpdatePatientBody.parse(req.body);

  if (body.cpf && body.cpf.replace(/\D/g, "").length > 0) {
    if (!validateCPF(body.cpf)) {
      res.status(422).json({ error: "CPF inválido. Verifique o número informado." });
      return;
    }
  }

  const patch = buildPatientPatch(body);
  const [patient] = await db.update(patientsTable).set({
    ...patch,
    updatedBy: patch.responsibleProfessional ?? "",
    updatedAt: new Date(),
  }).where(eq(patientsTable.id, id)).returning();

  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

router.put("/:id/status", requirePermissao("mudar_setor"), async (req, res) => {
  const { id }              = UpdatePatientStatusParams.parse({ id: Number(req.params.id) });
  const { triage_level, care_status, user_id } = UpdatePatientStatusBody.parse(req.body);

  const [current] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!current) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  const newCareStatus = care_status && CARE_STATUSES.includes(care_status as CareStatus)
    ? care_status as CareStatus : undefined;

  const patch: Partial<typeof patientsTable.$inferInsert> = { updatedAt: new Date() };
  if (triage_level)   patch.triageLevel = triage_level as TriageLevel;
  if (newCareStatus)  {
    patch.careStatus = newCareStatus;
    patch.careStatusChangedAt = new Date();
  }

  const [patient] = await db.update(patientsTable)
    .set(patch)
    .where(eq(patientsTable.id, id)).returning();

  // Sumário de Alta automático
  if (newCareStatus === "Alta") {
    const rxRows = await db.select()
      .from(patientPrescriptionsTable)
      .where(and(eq(patientPrescriptionsTable.patientId, id), eq(patientPrescriptionsTable.invalidado, false)))
      .orderBy(desc(patientPrescriptionsTable.createdAt));

    const admissaoEvol = await db.select()
      .from(patientEvolutionsTable)
      .where(eq(patientEvolutionsTable.patientId, id))
      .orderBy(patientEvolutionsTable.createdAt)
      .limit(1);

    const admissaoDate = admissaoEvol[0]?.createdAt ?? new Date();
    const agora = new Date();
    const diffMs = agora.getTime() - admissaoDate.getTime();
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffMins  = Math.floor((diffMs % 3_600_000) / 60_000);
    const tempoPermanencia = diffHours > 0
      ? `${diffHours}h ${diffMins}min`
      : `${diffMins} minutos`;

    const fmtDate = (d: Date) =>
      d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const rxAtivo = rxRows.filter(r => r.status !== "concluido");
    const rxLinhas = rxAtivo.length > 0
      ? rxAtivo.map(r => `  • [${r.type === "medical" ? "Médica" : "Enfermagem"}] ${r.content.slice(0, 120)}${r.content.length > 120 ? "…" : ""}`).join("\n")
      : "  (nenhuma prescrição ativa)";

    const soapText = [
      `╔══ SUMÁRIO DE ALTA ══╗`,
      `Paciente : ${current.fullName}`,
      `Prontuário: ${current.prontuarioNumber ?? "—"}  |  Atendimento: ${current.atendimentoNumber ?? "—"}`,
      `Admissão : ${fmtDate(admissaoDate)}`,
      `Alta     : ${fmtDate(agora)}`,
      `Permanência: ${tempoPermanencia}`,
      `Diagnóstico: ${current.diagnosis ?? "Não informado"}`,
      `Triagem  : ${current.triageLevel?.toUpperCase() ?? "—"}`,
      ``,
      `Prescrições na alta:`,
      rxLinhas,
      `╚═══════════════════╝`,
    ].join("\n");

    await db.insert(patientEvolutionsTable).values({
      patientId: id,
      userId:    user_id ?? 0,
      soapText,
    });

    req.log.info({ action: "patient_alta", patientId: id, staffId: user_id, tempoPermanencia }, "Paciente recebeu Alta — Sumário registrado");
  }

  // Audit log
  const changes: string[] = [];
  if (triage_level && triage_level !== current.triageLevel)
    changes.push(`Triagem: ${current.triageLevel} → ${triage_level}`);
  if (newCareStatus && newCareStatus !== current.careStatus)
    changes.push(`Status: ${current.careStatus} → ${newCareStatus}`);

  if (changes.length > 0 && newCareStatus !== "Alta") {
    await db.insert(patientEvolutionsTable).values({
      patientId: id,
      userId:    user_id ?? 0,
      soapText:  `[Reclassificação] ${changes.join(" | ")}`,
    });
    req.log.info({ action: "patient_reclassified", patientId: id, staffId: user_id, changes }, "Paciente reclassificado");
  }

  res.json(serialize(patient));
});

// ── vitals ────────────────────────────────────────────────────────────────────

router.get("/:id/vitals", async (req, res) => {
  const { id } = GetPatientVitalsParams.parse({ id: Number(req.params.id) });
  const vitals = await db.select()
    .from(vitalsTable)
    .where(eq(vitalsTable.patientId, id))
    .orderBy(desc(vitalsTable.createdAt));
  res.json(vitals.map(serializeVitals));
});

router.post("/:id/vitals", requirePermissao("registrar_sinais_vitais"), async (req, res) => {
  const { id } = RecordPatientVitalsParams.parse({ id: Number(req.params.id) });
  const body   = RecordPatientVitalsBody.parse(req.body);

  await db.insert(vitalsTable).values({
    patientId: id,
    userId:    0,
    bp:        body.bp      ?? "",
    hr:        body.hr      ?? 0,
    rr:        body.rr      ?? 0,
    spo2:      body.spo2    ?? 0,
    temp:      body.temp    ?? 0,
    glucose:   body.glucose ?? 0,
    note:      body.note    ?? "",
  });

  const bpParts   = (body.bp ?? "").split("/");
  const systolic  = parseInt(bpParts[0] ?? "0") || 0;
  const diastolic = parseInt(bpParts[1] ?? "0") || 0;

  // Vitals are tracked separately; no evolution entry created here

  await db.update(patientsTable).set({ updatedAt: new Date() }).where(eq(patientsTable.id, id));

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }
  res.json(serialize(patient));
});

// ── history ───────────────────────────────────────────────────────────────────

router.get("/:id/history", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const evolutions = await db.select()
    .from(patientEvolutionsTable)
    .where(eq(patientEvolutionsTable.patientId, id))
    .orderBy(desc(patientEvolutionsTable.createdAt));
  res.json(evolutions.map(serializeEvolution));
});

router.post("/:id/history", requirePermissao("registrar_evolucao"), async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const body = req.body as {
    userId: number;
    soapText: string;
    professionalCategory?: string;
    structuredData?: Record<string, unknown> | null;
  };
  const [entry] = await db.insert(patientEvolutionsTable).values({
    patientId:            id,
    userId:               body.userId   ?? 0,
    soapText:             body.soapText ?? "",
    professionalCategory: body.professionalCategory ?? "geral",
    structuredData:       body.structuredData ?? null,
  }).returning();
  res.status(201).json(serializeEvolution(entry));
});

// ── prescriptions ─────────────────────────────────────────────────────────────

router.get("/:id/prescriptions", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const prescriptions = await db.select()
    .from(patientPrescriptionsTable)
    .where(eq(patientPrescriptionsTable.patientId, id))
    .orderBy(desc(patientPrescriptionsTable.createdAt));
  res.json(prescriptions.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/:id/prescriptions", requirePermissao("registrar_prescricao"), async (req, res) => {
  const { id } = AddPatientPrescriptionParams.parse({ id: Number(req.params.id) });
  const body   = AddPatientPrescriptionBody.parse(req.body);
  const [prescription] = await db.insert(patientPrescriptionsTable).values({
    patientId: id,
    userId:    body.userId,
    type:      body.type as "nursing" | "medical",
    content:   body.content,
    status:    "pendente",
  }).returning();
  res.status(201).json({
    ...prescription,
    createdAt: prescription.createdAt.toISOString(),
  });
});

router.put("/:id/prescriptions/:prescriptionId/status", requirePermissao("registrar_prescricao"), async (req, res) => {
  const { id, prescriptionId } = UpdatePrescriptionStatusParams.parse({
    id: Number(req.params.id),
    prescriptionId: Number(req.params.prescriptionId),
  });
  const body = UpdatePrescriptionStatusBody.parse(req.body);
  const [prescription] = await db.update(patientPrescriptionsTable)
    .set({ status: body.status as "pendente" | "em_andamento" | "concluido" })
    .where(eq(patientPrescriptionsTable.id, prescriptionId))
    .returning();
  if (!prescription) { res.status(404).json({ error: "Prescrição não encontrada" }); return; }
  res.json({
    ...prescription,
    createdAt: prescription.createdAt.toISOString(),
  });
});

// ── tasks ─────────────────────────────────────────────────────────────────────

router.get("/:id/tasks", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const tasks  = await db.select()
    .from(patientTasksTable)
    .where(eq(patientTasksTable.patientId, id))
    .orderBy(desc(patientTasksTable.createdAt));
  res.json(tasks.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
});

router.post("/:id/tasks", requirePermissao("editar_paciente"), async (req, res) => {
  const { id } = AddPatientTaskParams.parse({ id: Number(req.params.id) });
  const body   = AddPatientTaskBody.parse(req.body);
  const [task] = await db.insert(patientTasksTable).values({
    patientId:   id,
    items:       body.items,
    status:      "pendente",
    responsible: body.responsible,
    notes:       body.notes ?? "",
    updatedAt:   new Date(),
  }).returning();
  res.status(201).json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.put("/:id/tasks/:taskId/status", requirePermissao("editar_paciente"), async (req, res) => {
  const { id, taskId } = UpdateTaskStatusParams.parse({
    id: Number(req.params.id),
    taskId: Number(req.params.taskId),
  });
  const body   = UpdateTaskStatusBody.parse(req.body);
  const [task] = await db.update(patientTasksTable)
    .set({ status: body.status as "pendente" | "concluido", updatedAt: new Date() })
    .where(eq(patientTasksTable.id, taskId))
    .returning();
  if (!task) { res.status(404).json({ error: "Pendência não encontrada" }); return; }
  res.json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

// ── exam results ──────────────────────────────────────────────────────────────

const serializeExam = (e: typeof examResultsTable.$inferSelect) => ({
  ...e,
  liberadoAt: e.liberadoAt ? e.liberadoAt.toISOString() : null,
  createdAt:  e.createdAt.toISOString(),
  updatedAt:  e.updatedAt.toISOString(),
});

router.get("/:id/exam-results", async (req, res) => {
  const id = Number(req.params.id);
  const results = await db.select().from(examResultsTable)
    .where(eq(examResultsTable.patientId, id))
    .orderBy(desc(examResultsTable.createdAt));
  res.json(results.map(serializeExam));
});

router.post("/:id/exam-results", async (req, res) => {
  const id   = Number(req.params.id);
  const body = req.body as {
    uploadedBy?: number; examName: string;
    examType: "laboratorial" | "imagem"; prioridade?: "urgente" | "rotina" | "eletivo";
    resultText?: string; fileData?: string; fileName?: string; fileMime?: string;
  };
  const [exam] = await db.insert(examResultsTable).values({
    patientId:   id,
    uploadedBy:  body.uploadedBy ?? 0,
    examName:    body.examName,
    examType:    body.examType,
    prioridade:  body.prioridade ?? "rotina",
    resultText:  body.resultText ?? "",
    fileData:    body.fileData ?? "",
    fileName:    body.fileName ?? "",
    fileMime:    body.fileMime ?? "",
    status:      "pendente",
    notified:    false,
    updatedAt:   new Date(),
  }).returning();
  res.status(201).json(serializeExam(exam));
});

router.put("/:id/exam-results/:examId/liberar", async (req, res) => {
  const patientId = Number(req.params.id);
  const examId    = Number(req.params.examId);
  const body = req.body as {
    resultText?: string; fileData?: string; fileName?: string; fileMime?: string;
  };
  const [exam] = await db.update(examResultsTable)
    .set({
      status:     "liberado",
      liberadoAt: new Date(),
      notified:   false,
      resultText: body.resultText ?? "",
      fileData:   body.fileData ?? "",
      fileName:   body.fileName ?? "",
      fileMime:   body.fileMime ?? "",
      updatedAt:  new Date(),
    })
    .where(eq(examResultsTable.id, examId))
    .returning();
  if (!exam) { res.status(404).json({ error: "Exame não encontrado" }); return; }

  await db.insert(patientEvolutionsTable).values({
    patientId,
    userId:   body.resultText ? 0 : 0,
    soapText: `[Resultado de Exame] ${exam.examName} liberado pelo laboratório`,
  });

  res.json(serializeExam(exam));
});

router.put("/:id/exam-results/:examId/notified", async (req, res) => {
  const examId = Number(req.params.examId);
  const [exam] = await db.update(examResultsTable)
    .set({ notified: true, updatedAt: new Date() })
    .where(eq(examResultsTable.id, examId))
    .returning();
  if (!exam) { res.status(404).json({ error: "Exame não encontrado" }); return; }
  res.json(serializeExam(exam));
});

// ── exam requests ──────────────────────────────────────────────────────────────

router.get("/:id/exam-requests", async (req, res) => {
  const { id } = GetPatientParams.parse({ id: Number(req.params.id) });
  const examRequests = await db.select()
    .from(patientExamRequestsTable)
    .where(eq(patientExamRequestsTable.patientId, id))
    .orderBy(desc(patientExamRequestsTable.createdAt));
  res.json(examRequests.map(e => ({
    ...e,
    laboratoriais: e.laboratoriais as string[],
    imagem: e.imagem as string[],
    createdAt: e.createdAt.toISOString(),
  })));
});

router.post("/:id/exam-requests", requirePermissao("registrar_prescricao"), async (req, res) => {
  const { id } = AddPatientExamRequestParams.parse({ id: Number(req.params.id) });
  const body = AddPatientExamRequestBody.parse(req.body);

  if (body.prescriptionId != null) {
    const [prescription] = await db.select({ id: patientPrescriptionsTable.id })
      .from(patientPrescriptionsTable)
      .where(and(
        eq(patientPrescriptionsTable.id, body.prescriptionId),
        eq(patientPrescriptionsTable.patientId, id),
      ))
      .limit(1);
    if (!prescription) {
      res.status(422).json({ error: "Prescrição não pertence a este paciente" });
      return;
    }
  }

  const [examRequest] = await db.insert(patientExamRequestsTable).values({
    patientId:     id,
    prescriptionId: body.prescriptionId ?? null,
    laboratoriais: body.laboratoriais,
    imagem:        body.imagem,
    prioridade:    body.prioridade as "urgente" | "rotina" | "eletivo",
    justificativa: body.justificativa ?? "",
    status:        "solicitado",
  }).returning();
  res.status(201).json({
    ...examRequest,
    laboratoriais: examRequest!.laboratoriais as string[],
    imagem: examRequest!.imagem as string[],
    createdAt: examRequest!.createdAt.toISOString(),
  });
});

router.patch("/:id/exam-requests/:examRequestId/status", requirePermissao("registrar_prescricao"), async (req, res) => {
  const { id, examRequestId } = UpdateExamRequestStatusParams.parse({
    id: Number(req.params.id),
    examRequestId: Number(req.params.examRequestId),
  });
  const body = UpdateExamRequestStatusBody.parse(req.body);

  const ALLOWED_MIMES = new Set([
    "application/pdf",
    "image/png", "image/jpeg", "image/gif", "image/webp",
  ]);
  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB base64-decoded limit

  if (body.resultFileData || body.resultFileName || body.resultFileMime) {
    const hasAll = body.resultFileData && body.resultFileName && body.resultFileMime;
    if (!hasAll) {
      res.status(422).json({ error: "Para anexar um arquivo, informe nome, dados e tipo MIME juntos." });
      return;
    }
    if (!ALLOWED_MIMES.has(body.resultFileMime!)) {
      res.status(422).json({ error: "Tipo de arquivo não permitido. Use PDF, PNG, JPG, GIF ou WebP." });
      return;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(body.resultFileData!)) {
      res.status(422).json({ error: "Dados do arquivo inválidos (base64 malformado)." });
      return;
    }
    const byteLength = Math.ceil(body.resultFileData!.length * 0.75);
    if (byteLength > MAX_FILE_BYTES) {
      res.status(422).json({ error: "Arquivo muito grande. O limite é 5 MB." });
      return;
    }
  }

  const patch: Partial<typeof patientExamRequestsTable.$inferInsert> = {
    status: body.status as "solicitado" | "coletado" | "laudado",
  };

  if (body.status === "laudado") {
    if (body.resultText !== undefined)     patch.resultText     = body.resultText;
    if (body.resultFileName !== undefined) patch.resultFileName = body.resultFileName;
    if (body.resultFileData !== undefined) patch.resultFileData = body.resultFileData;
    if (body.resultFileMime !== undefined) patch.resultFileMime = body.resultFileMime;
  }

  const [examRequest] = await db.update(patientExamRequestsTable)
    .set(patch)
    .where(and(
      eq(patientExamRequestsTable.id, examRequestId),
      eq(patientExamRequestsTable.patientId, id),
    ))
    .returning();
  if (!examRequest) { res.status(404).json({ error: "Solicitação de exame não encontrada" }); return; }
  res.json({
    ...examRequest,
    laboratoriais: examRequest.laboratoriais as string[],
    imagem: examRequest.imagem as string[],
    createdAt: examRequest.createdAt.toISOString(),
  });
});

// ── invalidação ───────────────────────────────────────────────────────────────

router.patch("/:id/prescriptions/:rxId/invalidar", requirePermissao("registrar_prescricao"), async (req, res) => {
  const patientId = Number(req.params.id);
  const rxId      = Number(req.params.rxId);
  const { motivo } = req.body as { motivo?: string };
  const [rx] = await db.update(patientPrescriptionsTable)
    .set({ invalidado: true, motivoInvalidacao: motivo ?? "" })
    .where(and(eq(patientPrescriptionsTable.id, rxId), eq(patientPrescriptionsTable.patientId, patientId)))
    .returning();
  if (!rx) { res.status(404).json({ error: "Prescrição não encontrada" }); return; }
  res.json({ ok: true });
});

router.patch("/:id/evolutions/:evolId/invalidar", requirePermissao("registrar_evolucao"), async (req, res) => {
  const patientId = Number(req.params.id);
  const evolId    = Number(req.params.evolId);
  const { motivo } = req.body as { motivo?: string };
  const [evol] = await db.update(patientEvolutionsTable)
    .set({ invalidado: true, motivoInvalidacao: motivo ?? "" })
    .where(and(eq(patientEvolutionsTable.id, evolId), eq(patientEvolutionsTable.patientId, patientId)))
    .returning();
  if (!evol) { res.status(404).json({ error: "Evolução não encontrada" }); return; }
  res.json({ ok: true });
});

router.patch("/:id/exam-requests/:examId/invalidar", requirePermissao("registrar_prescricao"), async (req, res) => {
  const patientId = Number(req.params.id);
  const examId    = Number(req.params.examId);
  const { motivo } = req.body as { motivo?: string };
  const [exam] = await db.update(patientExamRequestsTable)
    .set({ invalidado: true, motivoInvalidacao: motivo ?? "" })
    .where(and(eq(patientExamRequestsTable.id, examId), eq(patientExamRequestsTable.patientId, patientId)))
    .returning();
  if (!exam) { res.status(404).json({ error: "Solicitação de exame não encontrada" }); return; }
  res.json({ ok: true });
});

// ── APAC Laudo PDF ────────────────────────────────────────────────────────────

router.get("/:id/pdf/apac", async (req, res) => {
  const patientId = Number(req.params.id);
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1);
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595; const PAGE_H = 842;
  const ML = 36; const MR = 36; const CW = PAGE_W - ML - MR;
  const NAVY   = rgb(0.06, 0.09, 0.18);
  const ACCENT = rgb(0.15, 0.35, 0.78);
  const WHITE  = rgb(1, 1, 1);
  const DARK   = rgb(0.06, 0.07, 0.12);
  const MUTED  = rgb(0.42, 0.44, 0.54);
  const BORDER = rgb(0.75, 0.77, 0.84);
  const SECBG  = rgb(0.93, 0.95, 0.97);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 36;

  // Header
  page.drawRectangle({ x: ML, y: y - 56, width: CW, height: 56, color: NAVY });
  page.drawRectangle({ x: ML, y: y - 56, width: 6, height: 56, color: ACCENT });
  page.drawText("AUTORIZAÇÃO DE PROCEDIMENTO AMBULATORIAL DE ALTA COMPLEXIDADE", {
    x: ML + 16, y: y - 18, font: bold, size: 8, color: WHITE,
  });
  page.drawText("APAC — LAUDO PARA EMISSÃO", {
    x: ML + 16, y: y - 30, font: bold, size: 11, color: rgb(0.72, 0.78, 0.96),
  });
  page.drawText("UPA 24H — BREVES / PA", {
    x: ML + 16, y: y - 46, font, size: 8, color: rgb(0.72, 0.78, 0.96),
  });
  y -= 64;

  function drawField(label: string, value: string, x: number, fy: number, w: number) {
    page.drawRectangle({ x, y: fy - 28, width: w, height: 28, color: SECBG, borderColor: BORDER, borderWidth: 0.5 });
    page.drawText(label, { x: x + 4, y: fy - 11, font: bold, size: 6.5, color: MUTED });
    page.drawText(value || "—", { x: x + 4, y: fy - 24, font, size: 9, color: DARK });
  }

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };
  const age = patient.age ? `${patient.age} anos` : "";
  const sex = patient.sex === "M" ? "Masculino" : patient.sex === "F" ? "Feminino" : "Outro";

  // Section: Identificação do Paciente
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: NAVY });
  page.drawText("I — IDENTIFICAÇÃO DO PACIENTE", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;

  drawField("Nome do Paciente", patient.fullName, ML, y, CW); y -= 28;
  const col2 = CW / 3;
  drawField("Data de Nascimento", fmtDate(patient.birthDate), ML, y, col2);
  drawField("Idade", age, ML + col2, y, col2 * 0.6);
  drawField("Sexo", sex, ML + col2 * 1.6, y, col2 * 0.8);
  drawField("CPF", patient.cpf || "—", ML + col2 * 2.4, y, col2 * 0.6); y -= 28;
  drawField("Nome da Mãe", patient.motherName || "—", ML, y, CW); y -= 28;
  drawField("CNS (Cartão Nac. Saúde)", patient.cns || "—", ML, y, col2);
  drawField("RG", patient.rg || "—", ML + col2, y, col2);
  drawField("Telefone", patient.phone || "—", ML + col2 * 2, y, col2); y -= 28;
  drawField("Endereço", patient.address || "—", ML, y, CW); y -= 28;
  y -= 6;

  // Section: Procedimento Solicitado
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: NAVY });
  page.drawText("II — PROCEDIMENTO SOLICITADO", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;

  drawField("Código do Procedimento Principal (SIGTAP)", "", ML, y, col2 * 1.5);
  drawField("Procedimento Secundário (se houver)", "", ML + col2 * 1.5, y, col2 * 1.5); y -= 28;
  drawField("Diagnóstico / Agravo", patient.diagnosis || "—", ML, y, CW * 0.7);
  drawField("CID-10", "", ML + CW * 0.7, y, CW * 0.3); y -= 28;
  y -= 6;

  // Section: Dados Clínicos
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: NAVY });
  page.drawText("III — DADOS CLÍNICOS / JUSTIFICATIVA", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;

  page.drawRectangle({ x: ML, y: y - 60, width: CW, height: 60, color: SECBG, borderColor: BORDER, borderWidth: 0.5 });
  page.drawText("Anamnese / Histórico Clínico / Justificativa da Solicitação:", { x: ML + 4, y: y - 11, font: bold, size: 6.5, color: MUTED });
  y -= 60; y -= 6;

  // Section: Profissional Solicitante
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: NAVY });
  page.drawText("IV — IDENTIFICAÇÃO DO PROFISSIONAL SOLICITANTE", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;

  const today = new Date().toLocaleDateString("pt-BR");
  drawField("Nome do Profissional", "", ML, y, col2 * 1.5);
  drawField("CRM / Registro", "", ML + col2 * 1.5, y, col2 * 0.8);
  drawField("Data", today, ML + col2 * 2.3, y, col2 * 0.7); y -= 28;
  y -= 20;

  // Signature line
  const sigX = ML + CW / 2 - 90;
  page.drawLine({ start: { x: sigX, y }, end: { x: sigX + 180, y }, thickness: 1, color: DARK });
  page.drawText("Assinatura e Carimbo do Médico Solicitante", {
    x: sigX + 90 - font.widthOfTextAtSize("Assinatura e Carimbo do Médico Solicitante", 7) / 2,
    y: y - 12, font, size: 7, color: MUTED,
  });
  y -= 30;

  // Footer
  page.drawLine({ start: { x: ML, y: 38 }, end: { x: ML + CW, y: 38 }, thickness: 0.4, color: BORDER });
  page.drawText("UPA Breves — Gestão de Pacientes  |  Documento gerado automaticamente pelo sistema", { x: ML, y: 26, font, size: 6.5, color: MUTED });

  const pdfBytes = await doc.save();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="apac-${patient.fullName.replace(/\s+/g, "-")}.pdf"`);
  res.send(Buffer.from(pdfBytes));
});

// ── Ficha de Referência PDF ───────────────────────────────────────────────────

router.get("/:id/pdf/ficha-referencia", async (req, res) => {
  const patientId = Number(req.params.id);
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1);
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595; const PAGE_H = 842;
  const ML = 36; const MR = 36; const CW = PAGE_W - ML - MR;
  const NAVY   = rgb(0.06, 0.09, 0.18);
  const ACCENT = rgb(0.15, 0.35, 0.78);
  const WHITE  = rgb(1, 1, 1);
  const DARK   = rgb(0.06, 0.07, 0.12);
  const MUTED  = rgb(0.42, 0.44, 0.54);
  const BORDER = rgb(0.75, 0.77, 0.84);
  const SECBG  = rgb(0.93, 0.95, 0.97);
  const RED_BG = rgb(0.95, 0.25, 0.20);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 36;

  // Header
  page.drawRectangle({ x: ML, y: y - 56, width: CW, height: 56, color: NAVY });
  page.drawRectangle({ x: ML, y: y - 56, width: 6, height: 56, color: ACCENT });
  page.drawText("FICHA DE REFERÊNCIA / CONTRARREFERÊNCIA", {
    x: ML + 16, y: y - 20, font: bold, size: 12, color: WHITE,
  });
  page.drawText("Regulação e Transporte  |  UPA 24H — BREVES / PA", {
    x: ML + 16, y: y - 38, font, size: 8, color: rgb(0.72, 0.78, 0.96),
  });
  y -= 64;

  function drawField(label: string, value: string, x: number, fy: number, w: number) {
    page.drawRectangle({ x, y: fy - 28, width: w, height: 28, color: SECBG, borderColor: BORDER, borderWidth: 0.5 });
    page.drawText(label, { x: x + 4, y: fy - 11, font: bold, size: 6.5, color: MUTED });
    page.drawText(value || "—", { x: x + 4, y: fy - 24, font, size: 9, color: DARK });
  }

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };
  const sex = patient.sex === "M" ? "Masculino" : patient.sex === "F" ? "Feminino" : "Outro";
  const today = new Date().toLocaleDateString("pt-BR");
  const col2 = CW / 2; const col3 = CW / 3;

  // Section: Origem / Destino
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: ACCENT });
  page.drawText("ORIGEM E DESTINO", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;
  drawField("Unidade de Origem", "UPA 24H — Breves / PA", ML, y, col2);
  drawField("Data / Hora da Referência", today, ML + col2, y, col2); y -= 28;
  drawField("Unidade de Destino (Hospital / Especialidade)", "", ML, y, col2 * 1.5);
  drawField("Município Destino", "", ML + col2 * 1.5, y, col2 * 0.5); y -= 28; y -= 6;

  // Section: Paciente
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: NAVY });
  page.drawText("I — IDENTIFICAÇÃO DO PACIENTE", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;
  drawField("Nome Completo", patient.fullName, ML, y, CW); y -= 28;
  drawField("Data de Nascimento", fmtDate(patient.birthDate), ML, y, col3);
  drawField("Sexo", sex, ML + col3, y, col3 * 0.6);
  drawField("CPF", patient.cpf || "—", ML + col3 * 1.6, y, col3 * 0.7);
  drawField("CNS", patient.cns || "—", ML + col3 * 2.3, y, col3 * 0.7); y -= 28;
  drawField("Nome da Mãe", patient.motherName || "—", ML, y, col2);
  drawField("Telefone de Contato", patient.phone || "—", ML + col2, y, col2); y -= 28;
  drawField("Endereço", patient.address || "—", ML, y, CW); y -= 28; y -= 6;

  // Section: Motivo da Referência
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: NAVY });
  page.drawText("II — MOTIVO DA REFERÊNCIA / HISTÓRICO CLÍNICO", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;
  drawField("Diagnóstico / Hipótese Diagnóstica", patient.diagnosis || "—", ML, y, CW * 0.7);
  drawField("CID-10", "", ML + CW * 0.7, y, CW * 0.3); y -= 28;

  page.drawRectangle({ x: ML, y: y - 70, width: CW, height: 70, color: SECBG, borderColor: BORDER, borderWidth: 0.5 });
  page.drawText("Histórico Clínico / Anamnese / Conduta na UPA:", { x: ML + 4, y: y - 11, font: bold, size: 6.5, color: MUTED });
  y -= 70; y -= 6;

  // Section: Sinais Vitais
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: NAVY });
  page.drawText("III — SINAIS VITAIS NA TRANSFERÊNCIA", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;
  const qcol = CW / 5;
  drawField("PA (mmHg)", "", ML, y, qcol);
  drawField("FC (bpm)", "", ML + qcol, y, qcol);
  drawField("FR (irpm)", "", ML + qcol * 2, y, qcol);
  drawField("Temp (°C)", "", ML + qcol * 3, y, qcol);
  drawField("SpO₂ (%)", "", ML + qcol * 4, y, qcol); y -= 28;
  drawField("Glasgow", "", ML, y, qcol);
  drawField("Nível de Consciência", "", ML + qcol, y, qcol * 1.5);
  drawField("Via Aérea", "", ML + qcol * 2.5, y, qcol * 1.2);
  drawField("Acesso Venoso", "", ML + qcol * 3.7, y, qcol * 1.3); y -= 28; y -= 6;

  // Section: Profissional
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: NAVY });
  page.drawText("IV — PROFISSIONAL RESPONSÁVEL PELA REFERÊNCIA", { x: ML + 6, y: y - 13, font: bold, size: 8, color: WHITE });
  y -= 18;
  drawField("Nome do Médico", "", ML, y, col2);
  drawField("CRM", "", ML + col2, y, col3 * 0.8);
  drawField("Data", today, ML + col2 + col3 * 0.8, y, CW - col2 - col3 * 0.8); y -= 28;
  y -= 24;

  const sigX = ML + CW / 2 - 100;
  page.drawLine({ start: { x: sigX, y }, end: { x: sigX + 200, y }, thickness: 1, color: DARK });
  page.drawText("Assinatura e Carimbo do Médico Responsável", {
    x: sigX + 100 - font.widthOfTextAtSize("Assinatura e Carimbo do Médico Responsável", 7) / 2,
    y: y - 12, font, size: 7, color: MUTED,
  });

  // Footer
  page.drawLine({ start: { x: ML, y: 38 }, end: { x: ML + CW, y: 38 }, thickness: 0.4, color: BORDER });
  page.drawText("UPA Breves — Gestão de Pacientes  |  Documento gerado automaticamente pelo sistema", { x: ML, y: 26, font, size: 6.5, color: MUTED });

  const pdfBytes = await doc.save();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="ficha-referencia-${patient.fullName.replace(/\s+/g, "-")}.pdf"`);
  res.send(Buffer.from(pdfBytes));
});

// ── prescription PDF ──────────────────────────────────────────────────────────

function wrapTextPdf(
  text: string,
  font: { widthOfTextAtSize: (s: string, n: number) => number },
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function buildPrescricaoPdf(
  patientName: string,
  birthDate: string | null,
  age: number | null,
  sex: string | null,
  cpf: string | null,
  content: string,
  createdAt: Date,
  authorName: string | null,
): Promise<Uint8Array> {
  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // A4 landscape (842 × 595 pt)
  const PAGE_W = 842;
  const PAGE_H = 595;
  const ML     = 50;
  const CW     = PAGE_W - ML - 50;

  const NAVY   = rgb(0.06, 0.09, 0.18);
  const ACCENT = rgb(0.15, 0.35, 0.78);
  const WHITE  = rgb(1, 1, 1);
  const LTBLUE = rgb(0.72, 0.78, 0.96);
  const DARK   = rgb(0.06, 0.07, 0.12);
  const MUTED  = rgb(0.42, 0.44, 0.54);
  const BORDER = rgb(0.80, 0.82, 0.88);
  const SECBG  = rgb(0.93, 0.95, 0.97);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y    = PAGE_H - 36;

  function drawContinuationHeader() {
    page.drawRectangle({ x: ML, y: y - 24, width: CW, height: 24, color: NAVY });
    page.drawText("UPA 24H — BREVES  |  PRESCRIÇÃO MÉDICA (continuação)", {
      x: ML + 8, y: y - 16, font: bold, size: 8, color: WHITE,
    });
    y -= 32;
  }

  function ensureSpace(needed: number) {
    if (y - needed < 50) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 36;
      drawContinuationHeader();
    }
  }

  // ── header ──────────────────────────────────────────────────────────────────
  const HDR_H = 54;
  page.drawRectangle({ x: ML, y: y - HDR_H, width: CW, height: HDR_H, color: NAVY });
  page.drawRectangle({ x: ML, y: y - HDR_H, width: 5, height: HDR_H, color: ACCENT });
  page.drawText("UPA 24H — BREVES", { x: ML + 14, y: y - 20, font: bold, size: 14, color: WHITE });
  page.drawText("PRESCRIÇÃO MÉDICA", { x: ML + 14, y: y - 36, font: bold, size: 9.5, color: LTBLUE });

  const emitida = `Emitida em: ${createdAt.toLocaleDateString("pt-BR")} ${createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  page.drawText(emitida, {
    x: ML + CW - font.widthOfTextAtSize(emitida, 6.5) - 6, y: y - HDR_H + 6,
    font, size: 6.5, color: LTBLUE,
  });
  y -= HDR_H + 10;

  // ── patient info ────────────────────────────────────────────────────────────
  const INFO_H = 36;
  page.drawRectangle({ x: ML, y: y - INFO_H, width: CW, height: INFO_H, color: SECBG, borderColor: BORDER, borderWidth: 0.5 });

  const fmtDate = (d: string | null) => {
    if (!d) return "";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };
  const ageStr = [fmtDate(birthDate), age ? `${age} anos` : ""].filter(Boolean).join(" — ");

  page.drawText("PACIENTE", { x: ML + 8, y: y - 10, font: bold, size: 6.5, color: MUTED });
  page.drawText(patientName, { x: ML + 8, y: y - 23, font: bold, size: 10.5, color: DARK });
  if (ageStr) {
    const colX = ML + CW / 2;
    page.drawText("DATA NASC. / IDADE", { x: colX, y: y - 10, font: bold, size: 6.5, color: MUTED });
    page.drawText(ageStr, { x: colX, y: y - 23, font, size: 9, color: DARK });
  }
  y -= INFO_H + 4;

  if (cpf || sex) {
    page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 22, color: rgb(0.97, 0.97, 1), borderColor: BORDER, borderWidth: 0.5 });
    let xc = ML + 8;
    if (cpf) {
      page.drawText("CPF:", { x: xc, y: y - 8, font: bold, size: 6.5, color: MUTED });
      page.drawText(cpf, { x: xc, y: y - 18, font, size: 8.5, color: DARK });
      xc += 120;
    }
    if (sex) {
      const sexStr = sex === "M" ? "Masculino" : sex === "F" ? "Feminino" : "Não inf.";
      page.drawText("SEXO:", { x: xc, y: y - 8, font: bold, size: 6.5, color: MUTED });
      page.drawText(sexStr, { x: xc, y: y - 18, font, size: 8.5, color: DARK });
    }
    y -= 22 + 4;
  }

  // ── separator ───────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y: y - 2 }, end: { x: ML + CW, y: y - 2 }, thickness: 1, color: ACCENT });
  y -= 14;

  // ── content ─────────────────────────────────────────────────────────────────
  const SECTION_KEYS = ["MEDICAMENTOS:", "CURATIVOS:", "MONITORIZAÇÃO:", "DIETA:", "EXAMES SOLICITADOS", "OUTROS:"];

  for (const rawLine of content.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) { y -= 6; continue; }

    const isSection = SECTION_KEYS.some(k => trimmed.toUpperCase().startsWith(k.toUpperCase()));
    const isDocHeader = trimmed.startsWith("PRESCRIÇÃO MÉDICA —") || trimmed.startsWith("Paciente:");

    if (isSection) {
      ensureSpace(24);
      page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: SECBG });
      page.drawText(trimmed, { x: ML + 8, y: y - 13, font: bold, size: 9, color: ACCENT });
      y -= 20;
    } else if (isDocHeader) {
      ensureSpace(14);
      page.drawText(trimmed, { x: ML + 8, y: y - 2, font: bold, size: 7.5, color: MUTED });
      y -= 13;
    } else {
      const wrapped = wrapTextPdf(trimmed, font, 9, CW - 16);
      for (const wl of wrapped) {
        ensureSpace(13);
        page.drawText(wl, { x: ML + 8, y: y - 2, font, size: 9, color: DARK });
        y -= 13;
      }
    }
  }

  // ── author + date ────────────────────────────────────────────────────────────
  y -= 10;
  ensureSpace(20);
  const rxDateStr = `${createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} às ${createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  page.drawText(`Prescrição registrada em: ${rxDateStr}`, { x: ML + 8, y: y - 2, font, size: 8, color: MUTED });
  if (authorName) {
    y -= 13;
    ensureSpace(14);
    page.drawText(`Prescritor(a): ${authorName}`, { x: ML + 8, y: y - 2, font, size: 8, color: MUTED });
  }

  // ── signature ────────────────────────────────────────────────────────────────
  ensureSpace(80);
  y -= 40;
  const SIG_W = 180;
  const SIG_X = ML + (CW - SIG_W) / 2;
  page.drawLine({ start: { x: SIG_X, y }, end: { x: SIG_X + SIG_W, y }, thickness: 1, color: DARK });
  const sigLabel = authorName ?? "Assinatura / Carimbo do Médico";
  const sigLabelW = font.widthOfTextAtSize(sigLabel, 7.5);
  page.drawText(sigLabel, { x: SIG_X + (SIG_W - sigLabelW) / 2, y: y - 12, font, size: 7.5, color: MUTED });
  if (authorName) {
    const crmLabel = "CRM: ________________";
    const crmW = font.widthOfTextAtSize(crmLabel, 7.5);
    page.drawText(crmLabel, { x: SIG_X + (SIG_W - crmW) / 2, y: y - 24, font, size: 7.5, color: MUTED });
  }

  // ── footer ───────────────────────────────────────────────────────────────────
  const lastPage = doc.getPage(doc.getPageCount() - 1);
  lastPage.drawLine({ start: { x: ML, y: 38 }, end: { x: ML + CW, y: 38 }, thickness: 0.4, color: BORDER });
  lastPage.drawText(
    "UPA Breves — Gestão de Pacientes  |  Documento gerado automaticamente pelo sistema",
    { x: ML, y: 26, font, size: 6.5, color: MUTED },
  );

  return doc.save();
}

router.get("/:id/prescriptions/:prescriptionId/pdf", requirePermissao("gerar_pdf"), async (req, res) => {
  const patientId      = Number(req.params.id);
  const prescriptionId = Number(req.params.prescriptionId);

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  const [prescription] = await db.select()
    .from(patientPrescriptionsTable)
    .where(and(
      eq(patientPrescriptionsTable.id, prescriptionId),
      eq(patientPrescriptionsTable.patientId, patientId),
    ));
  if (!prescription) { res.status(404).json({ error: "Prescrição não encontrada" }); return; }
  if (prescription.type !== "medical") { res.status(400).json({ error: "Apenas prescrições médicas podem ser impressas" }); return; }

  // look up the prescriber name if available
  let authorName: string | null = null;
  if (prescription.userId) {
    const [staff] = await db.select({ name: staffTable.name })
      .from(staffTable)
      .where(eq(staffTable.id, prescription.userId))
      .limit(1);
    authorName = staff?.name ?? null;
  }

  const pdfBytes = await buildPrescricaoPdf(
    patient.fullName,
    patient.birthDate ?? null,
    patient.age ?? null,
    patient.sex ?? null,
    patient.cpf ?? null,
    prescription.content,
    prescription.createdAt,
    authorName,
  );

  const safeName = patient.fullName.replace(/\s+/g, "_");
  const dateSlug = prescription.createdAt.toISOString().slice(0, 10);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Prescricao_Medica_${safeName}_${dateSlug}.pdf"`);
  res.setHeader("Content-Length", pdfBytes.length);
  res.send(Buffer.from(pdfBytes));
});

// ── delete ────────────────────────────────────────────────────────────────────

router.delete("/:id", requirePermissao("excluir_paciente"), async (req, res) => {
  const { id } = DeletePatientParams.parse({ id: Number(req.params.id) });
  await db.delete(patientsTable).where(eq(patientsTable.id, id));
  res.status(204).send();
});

export default router;
