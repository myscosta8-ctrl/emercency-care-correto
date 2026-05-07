import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { requirePermissao } from "../middleware/require-auth";
import { uploadToStorage, deleteFromStorage } from "../lib/supabase-storage";
import { db, pool, patientsTable, patientEvolutionsTable, patientPrescriptionsTable, patientTasksTable, vitalsTable, examResultsTable, patientExamRequestsTable, staffTable } from "@workspace/db";
import { eq, sql, desc, and, inArray, or, ilike } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function templatePath(filename: string): string {
  // After build: dist/templates/<filename>  (process.cwd() = artifacts/api-server)
  // Dev fallback: src/templates/<filename>
  const distPath = path.join(process.cwd(), "dist", "templates", filename);
  const srcPath  = path.join(process.cwd(), "src",  "templates", filename);
  return fs.existsSync(distPath) ? distPath : srcPath;
}

function assetPath(filename: string): string {
  const distPath = path.join(process.cwd(), "dist", "assets", filename);
  const srcPath  = path.join(process.cwd(), "src",  "assets", filename);
  return fs.existsSync(distPath) ? distPath : srcPath;
}
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
  careStatusChangedAt:  p.careStatusChangedAt.toISOString(),
  createdAt:    p.createdAt.toISOString(),
  updatedAt:    p.updatedAt.toISOString(),
  // timestamps por etapa (nullable → ISO string ou null)
  horaRecepcao:          p.horaRecepcao          ? p.horaRecepcao.toISOString()          : null,
  horaTriagem:           p.horaTriagem           ? p.horaTriagem.toISOString()           : null,
  horaAtendimentoMedico: p.horaAtendimentoMedico ? p.horaAtendimentoMedico.toISOString() : null,
  horaMedicacao:         p.horaMedicacao         ? p.horaMedicacao.toISOString()         : null,
  horaAlta:              p.horaAlta              ? p.horaAlta.toISOString()              : null,
  horaInternacao:        p.horaInternacao        ? p.horaInternacao.toISOString()        : null,
  horaTransferencia:     p.horaTransferencia     ? p.horaTransferencia.toISOString()     : null,
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
type CareStatus    = "Em Triagem" | "Aguardando Atendimento" | "Em Atendimento (Cons. 1)" | "Em Atendimento (Cons. 2)" | "Em Medicação" | "Aguardando Exames" | "Aguardando Reavaliação" | "Em Observação" | "Internado" | "Em Transferência" | "Alta";

const CARE_STATUSES: CareStatus[] = [
  "Em Triagem", "Aguardando Atendimento", "Em Atendimento (Cons. 1)", "Em Atendimento (Cons. 2)",
  "Em Medicação", "Aguardando Exames", "Aguardando Reavaliação",
  "Em Observação", "Internado", "Em Transferência", "Alta",
];

function generateProntuarioNumber(id: number): string {
  return String(id).padStart(6, "0");
}

function generateAtendimentoNumber(id: number): string {
  return String(id).padStart(6, "0");
}

/** Full insert payload for patient creation */
function buildPatientInsert(body: typeof CreatePatientBody._type) {
  const age = body.birthDate ? ageFromBirthDate(body.birthDate) : (body.age ?? 0);
  const rawCareStatus = (body as Record<string, unknown>).care_status as string | undefined;
  const careStatus = (CARE_STATUSES.includes(rawCareStatus as CareStatus) ? rawCareStatus : "Em Triagem") as CareStatus;
  const bodyAny = body as Record<string, unknown>;
  const addressStreet       = (bodyAny["addressStreet"]       as string | undefined) ?? "";
  const addressNumber       = (bodyAny["addressNumber"]       as string | undefined) ?? "";
  const addressNeighborhood = (bodyAny["addressNeighborhood"] as string | undefined) ?? "";
  const addressCity         = (bodyAny["addressCity"]         as string | undefined) ?? "";
  const addressCep          = (bodyAny["addressCep"]          as string | undefined) ?? "";
  const addressConcat = [addressStreet, addressNumber, addressNeighborhood, addressCity, addressCep]
    .filter(Boolean).join(", ") || (body.address ?? "");
  return {
    fullName:                body.full_name,
    birthDate:               body.birthDate ?? "",
    age,
    sex:                     (body.sex ?? "O") as "M" | "F" | "O",
    motherName:              body.motherName ?? "",
    cns:                     body.cns ?? "",
    cpf:                     body.cpf ?? "",
    rg:                      body.rg ?? "",
    address:                 addressConcat,
    addressStreet,
    addressNumber,
    addressNeighborhood,
    addressCity,
    addressCep,
    phone:                   body.phone ?? "",
    email:                   body.email ?? "",
    horaRecepcao:            new Date(),
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
  const bodyAny = body as Record<string, unknown>;
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
  // endereço separado
  if (bodyAny["addressStreet"]       !== undefined) patch.addressStreet       = bodyAny["addressStreet"]       as string;
  if (bodyAny["addressNumber"]       !== undefined) patch.addressNumber       = bodyAny["addressNumber"]       as string;
  if (bodyAny["addressNeighborhood"] !== undefined) patch.addressNeighborhood = bodyAny["addressNeighborhood"] as string;
  if (bodyAny["addressCity"]         !== undefined) patch.addressCity         = bodyAny["addressCity"]         as string;
  if (bodyAny["addressCep"]          !== undefined) patch.addressCep          = bodyAny["addressCep"]          as string;
  // re-construir campo legado se campos separados foram enviados
  const hasAddrParts = ["addressStreet","addressNumber","addressNeighborhood","addressCity","addressCep"]
    .some(k => bodyAny[k] !== undefined);
  if (hasAddrParts) {
    patch.address = [
      patch.addressStreet ?? "", patch.addressNumber ?? "",
      patch.addressNeighborhood ?? "", patch.addressCity ?? "", patch.addressCep ?? "",
    ].filter(Boolean).join(", ");
  }
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
    // Exclui pacientes com Alta — eles ficam no histórico (/historico)
    const patients = await db.select().from(patientsTable)
      .where(sql`${patientsTable.careStatus} != 'Alta'`)
      .orderBy(patientsTable.createdAt);
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

  // Fetch patient records — exclui pacientes com Alta
  const patients = await db.select().from(patientsTable)
    .where(and(inArray(patientsTable.id, matchingIds), sql`${patientsTable.careStatus} != 'Alta'`))
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

// GET /patients/lookup?q=texto — busca geral por nome, CPF, CNS ou data de nascimento
// Inclui pacientes arquivados (com Alta) para cadastro único
router.get("/lookup", async (req, res) => {
  const q = ((req.query["q"] as string) ?? "").trim();
  if (!q) { res.json([]); return; }

  const qLower = q.toLowerCase();
  const qDigits = q.replace(/\D/g, "");

  const conditions = [ilike(patientsTable.fullName, `%${qLower}%`)];
  if (qDigits.length >= 3) {
    conditions.push(sql`${patientsTable.cpf} LIKE ${`%${qDigits}%`}`);
    conditions.push(sql`${patientsTable.cns} LIKE ${`%${qDigits}%`}`);
  }
  // date format DD/MM/YYYY or YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(q) || /^\d{4}-\d{2}-\d{2}$/.test(q)) {
    conditions.push(eq(patientsTable.birthDate, q));
  }

  const results = await db.select()
    .from(patientsTable)
    .where(or(...conditions))
    .orderBy(desc(patientsTable.createdAt))
    .limit(20);

  res.json(results.map(serialize));
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
    // ── rastreamento automático de tempo por etapa ─────────────────────────
    if (newCareStatus === "Aguardando Atendimento" && !current.horaTriagem)
      patch.horaTriagem = new Date();
    if ((newCareStatus === "Em Atendimento (Cons. 1)" || newCareStatus === "Em Atendimento (Cons. 2)") && !current.horaAtendimentoMedico)
      patch.horaAtendimentoMedico = new Date();
    if (newCareStatus === "Em Medicação" && !current.horaMedicacao)
      patch.horaMedicacao = new Date();
    if (newCareStatus === "Alta" && !current.horaAlta)
      patch.horaAlta = new Date();
    if (newCareStatus === "Internado" && !current.horaInternacao)
      patch.horaInternacao = new Date();
    if (newCareStatus === "Em Transferência" && !current.horaTransferencia)
      patch.horaTransferencia = new Date();
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
  fileUrl:    e.fileUrl ?? "",
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

  let fileData = body.fileData ?? "";
  let fileUrl  = "";
  if (fileData && body.fileName && body.fileMime) {
    const url = await uploadToStorage(body.fileName, body.fileMime, fileData);
    if (url) { fileUrl = url; fileData = ""; }
  }

  const [exam] = await db.insert(examResultsTable).values({
    patientId:   id,
    uploadedBy:  body.uploadedBy ?? 0,
    examName:    body.examName,
    examType:    body.examType,
    prioridade:  body.prioridade ?? "rotina",
    resultText:  body.resultText ?? "",
    fileData,
    fileName:    body.fileName ?? "",
    fileMime:    body.fileMime ?? "",
    fileUrl,
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

  let fileData = body.fileData ?? "";
  let fileUrl  = "";
  if (fileData && body.fileName && body.fileMime) {
    const url = await uploadToStorage(body.fileName, body.fileMime, fileData);
    if (url) { fileUrl = url; fileData = ""; }
  }

  const [exam] = await db.update(examResultsTable)
    .set({
      status:     "liberado",
      liberadoAt: new Date(),
      notified:   false,
      resultText: body.resultText ?? "",
      fileData,
      fileName:   body.fileName ?? "",
      fileMime:   body.fileMime ?? "",
      fileUrl,
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
    userId:        req.staff?.id ?? 0,
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
    if (body.resultFileMime !== undefined) patch.resultFileMime = body.resultFileMime;

    if (body.resultFileData && body.resultFileName && body.resultFileMime) {
      const url = await uploadToStorage(body.resultFileName, body.resultFileMime, body.resultFileData);
      if (url) {
        patch.resultFileUrl  = url;
        patch.resultFileData = "";
      } else {
        patch.resultFileData = body.resultFileData;
      }
    } else if (body.resultFileData !== undefined) {
      patch.resultFileData = body.resultFileData;
    }
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

const ADMIN_ROLES = new Set(["administrador", "diretoria_geral"]);

function podeInvalidar(staffId: number, role: string, recordUserId: number): boolean {
  return staffId === recordUserId || ADMIN_ROLES.has(role);
}

router.patch("/:id/prescriptions/:rxId/invalidar", requirePermissao("registrar_prescricao"), async (req, res) => {
  const patientId = Number(req.params.id);
  const rxId      = Number(req.params.rxId);
  const { motivo } = req.body as { motivo?: string };

  const [existing] = await db.select({ userId: patientPrescriptionsTable.userId })
    .from(patientPrescriptionsTable)
    .where(and(eq(patientPrescriptionsTable.id, rxId), eq(patientPrescriptionsTable.patientId, patientId)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Prescrição não encontrada" }); return; }

  if (!podeInvalidar(req.staff!.id, req.staff!.role, existing.userId)) {
    res.status(403).json({ error: "Somente o autor ou um administrador pode invalidar este registro" });
    return;
  }

  await db.update(patientPrescriptionsTable)
    .set({ invalidado: true, motivoInvalidacao: motivo ?? "" })
    .where(eq(patientPrescriptionsTable.id, rxId));
  res.json({ ok: true });
});

router.patch("/:id/evolutions/:evolId/invalidar", requirePermissao("registrar_evolucao"), async (req, res) => {
  const patientId = Number(req.params.id);
  const evolId    = Number(req.params.evolId);
  const { motivo } = req.body as { motivo?: string };

  const [existing] = await db.select({ userId: patientEvolutionsTable.userId })
    .from(patientEvolutionsTable)
    .where(and(eq(patientEvolutionsTable.id, evolId), eq(patientEvolutionsTable.patientId, patientId)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Evolução não encontrada" }); return; }

  if (!podeInvalidar(req.staff!.id, req.staff!.role, existing.userId)) {
    res.status(403).json({ error: "Somente o autor ou um administrador pode invalidar este registro" });
    return;
  }

  await db.update(patientEvolutionsTable)
    .set({ invalidado: true, motivoInvalidacao: motivo ?? "" })
    .where(eq(patientEvolutionsTable.id, evolId));
  res.json({ ok: true });
});

router.patch("/:id/exam-requests/:examId/invalidar", requirePermissao("registrar_prescricao"), async (req, res) => {
  const patientId = Number(req.params.id);
  const examId    = Number(req.params.examId);
  const { motivo } = req.body as { motivo?: string };

  const [existing] = await db.select({ userId: patientExamRequestsTable.userId })
    .from(patientExamRequestsTable)
    .where(and(eq(patientExamRequestsTable.id, examId), eq(patientExamRequestsTable.patientId, patientId)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Solicitação de exame não encontrada" }); return; }

  if (!podeInvalidar(req.staff!.id, req.staff!.role, existing.userId)) {
    res.status(403).json({ error: "Somente o autor ou um administrador pode invalidar este registro" });
    return;
  }

  await db.update(patientExamRequestsTable)
    .set({ invalidado: true, motivoInvalidacao: motivo ?? "" })
    .where(eq(patientExamRequestsTable.id, examId));
  res.json({ ok: true });
});

// ── Standard UPA Portrait Header Page ─────────────────────────────────────────
async function buildUpaHeaderPortraitDoc(patient: {
  fullName: string;
  prontuarioNumber: string | null;
  atendimentoNumber: string | null;
  birthDate: string | null;
  age: number | null;
  sex: string | null;
  cpf: string | null;
  rg: string | null;
  motherName: string | null;
  address: string | null;
  cns: string | null;
  triageLevel: string | null;
  diagnosis: string | null;
  phone?: string | null;
}, docTitle: string): Promise<PDFDocument> {
  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let prefeituraLogo: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  let upaLogo: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  try {
    prefeituraLogo = await doc.embedJpg(fs.readFileSync(assetPath("prefeitura-breves.jpeg")));
    upaLogo        = await doc.embedJpg(fs.readFileSync(assetPath("upa24h.jpg")));
  } catch { /* use text fallback */ }

  const PAGE_W = 595; const PAGE_H = 842;
  const ML = 18; const MR = 18; const MT = 12; const MB = 12;
  const CW = PAGE_W - ML - MR;

  const BLACK    = rgb(0,    0,    0);
  const WHITE    = rgb(1,    1,    1);
  const DK_GREEN = rgb(0.02, 0.36, 0.15);
  const BLUE     = rgb(0.07, 0.36, 0.65);
  const MED_GRAY = rgb(0.45, 0.45, 0.45);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  const FORM_H = PAGE_H - MT - MB;
  page.drawRectangle({ x: ML, y: MB, width: CW, height: FORM_H, borderColor: BLACK, borderWidth: 1.5, color: WHITE });

  const HDR_H   = 80;
  const HDR_TOP = MB + FORM_H;
  const HDR_BOT = HDR_TOP - HDR_H;

  page.drawLine({ start: { x: ML, y: HDR_BOT }, end: { x: ML + CW, y: HDR_BOT }, thickness: 1.2, color: BLACK });

  const LEFT_W = 160; const CTR_W = 180;
  const DIV1_X = ML + LEFT_W;
  const DIV2_X = ML + LEFT_W + CTR_W;
  page.drawLine({ start: { x: DIV1_X, y: HDR_BOT }, end: { x: DIV1_X, y: HDR_TOP }, thickness: 0.8, color: BLACK });
  page.drawLine({ start: { x: DIV2_X, y: HDR_BOT }, end: { x: DIV2_X, y: HDR_TOP }, thickness: 0.8, color: BLACK });

  // LEFT — Prefeitura logo
  if (prefeituraLogo) {
    const pH = HDR_H - 16;
    const pW = (prefeituraLogo.width / prefeituraLogo.height) * pH;
    page.drawImage(prefeituraLogo, { x: ML + (LEFT_W - pW) / 2, y: HDR_BOT + 8, width: pW, height: pH });
  } else {
    page.drawText("PREFEITURA DE", { x: ML + 8, y: HDR_TOP - 18, font: bold, size: 7, color: BLACK });
    page.drawText("Breves",        { x: ML + 8, y: HDR_TOP - 45, font: bold, size: 24, color: BLUE });
    page.drawText("De volta ao trabalho", { x: ML + 8, y: HDR_TOP - 57, font, size: 6, color: MED_GRAY });
  }

  // CENTER — UPA logo
  if (upaLogo) {
    const uH = HDR_H - 16;
    const uW = (upaLogo.width / upaLogo.height) * uH;
    page.drawImage(upaLogo, { x: DIV1_X + (CTR_W - uW) / 2, y: HDR_BOT + 8, width: uW, height: uH });
  } else {
    const cx = DIV1_X + 8;
    page.drawText("UPA",   { x: cx, y: HDR_TOP - 45, font: bold, size: 28, color: DK_GREEN });
    const uW2 = bold.widthOfTextAtSize("UPA", 28);
    page.drawText("24h",   { x: cx + uW2 + 2, y: HDR_TOP - 45, font: bold, size: 22, color: rgb(0.75, 0.1, 0.1) });
    page.drawText("UNIDADE DE PRONTO ATENDIMENTO", { x: cx, y: HDR_TOP - 58, font: bold, size: 5.5, color: BLACK });
  }

  // RIGHT — Document title box
  const rx = DIV2_X + 8;
  const rBoxW = CW - (DIV2_X - ML) - 16;
  const rBoxH = 52;
  const rBoxY = HDR_BOT + (HDR_H - rBoxH) / 2;
  page.drawRectangle({ x: rx, y: rBoxY, width: rBoxW, height: rBoxH, borderColor: BLACK, borderWidth: 1.8, color: WHITE });
  page.drawText(docTitle, {
    x: rx + (rBoxW - bold.widthOfTextAtSize(docTitle, 9)) / 2,
    y: rBoxY + rBoxH - 20, font: bold, size: 9, color: BLACK,
  });

  // PATIENT INFO — 8 rows
  const PI_ROW_H = 14;
  const PI_ROWS  = 8;
  const PI_TOP   = HDR_BOT;
  for (let i = 1; i <= PI_ROWS; i++) {
    page.drawLine({ start: { x: ML, y: PI_TOP - i * PI_ROW_H }, end: { x: ML + CW, y: PI_TOP - i * PI_ROW_H }, thickness: 0.3, color: BLACK });
  }

  const fmtDt = (d: string | null | undefined) => {
    if (!d) return "___/___/______";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };
  const piField = (label: string, value: string, x: number, rowTop: number) => {
    page.drawText(label, { x: x + 2, y: rowTop - 4,  font: bold, size: 4.8, color: BLACK });
    page.drawText(value, { x: x + 2, y: rowTop - 11, font,       size: 7,   color: BLACK });
  };
  const piVline = (x: number, rowTop: number, h = PI_ROW_H) =>
    page.drawLine({ start: { x, y: rowTop - h }, end: { x, y: rowTop }, thickness: 0.3, color: BLACK });

  const triageLbl: Record<string, string> = { red:"VERMELHO", orange:"LARANJA", yellow:"AMARELO", green:"VERDE", blue:"AZUL" };

  const r1 = PI_TOP;
  piField("PRONTUÁRIO:", patient.prontuarioNumber || "______", ML + 2, r1);
  const r1v1 = ML + 120; piVline(r1v1, r1);
  piField("REGISTRO:", patient.atendimentoNumber || "______", r1v1 + 2, r1);
  const r1v2 = r1v1 + 120; piVline(r1v2, r1);
  piField("DATA INTERNAÇÃO:", "___/___/______   ___:___", r1v2 + 2, r1);
  const r1v3 = ML + CW - 120; piVline(r1v3, r1);
  piField("DATA ALTA:", "___/___/______", r1v3 + 2, r1);

  const r2 = PI_TOP - PI_ROW_H;
  piField("PACIENTE:", patient.fullName.toUpperCase(), ML + 2, r2);
  const r2v1 = ML + Math.min(4 + bold.widthOfTextAtSize("PACIENTE:", 4.8) + font.widthOfTextAtSize(patient.fullName, 7) + 8, Math.floor(CW * 0.55));
  piVline(r2v1, r2);
  piField("NACIONALIDADE:", "Brasileira", r2v1 + 2, r2);
  const r2v2 = ML + Math.floor(CW * 0.76); piVline(r2v2, r2);
  piField("CLASSIFICAÇÃO:", triageLbl[patient.triageLevel ?? ""] ?? "____________", r2v2 + 2, r2);

  const r3 = PI_TOP - 2 * PI_ROW_H;
  piField("MÃE:", patient.motherName || "__________________________________________________", ML + 2, r3);
  const r3v1 = ML + Math.floor(CW * 0.76); piVline(r3v1, r3);
  piField("CONVÊNIO:", "SUS", r3v1 + 2, r3);

  const r4 = PI_TOP - 3 * PI_ROW_H;
  const sexTxt = patient.sex === "F" ? "SEXO:  (X) FEMININO    ( ) MASCULINO" : patient.sex === "M" ? "SEXO:  ( ) FEMININO    (X) MASCULINO" : "SEXO:  ( ) FEMININO    ( ) MASCULINO";
  page.drawText(sexTxt, { x: ML + 2, y: r4 - 7, font: bold, size: 5.5, color: BLACK });
  const r4v1 = ML + 170; piVline(r4v1, r4);
  piField("DATA NASC.:", fmtDt(patient.birthDate), r4v1 + 2, r4);
  const r4v2 = r4v1 + 90; piVline(r4v2, r4);
  piField("IDADE:", patient.age ? `${patient.age} A` : "___ A", r4v2 + 2, r4);
  const r4v3 = r4v2 + 100; piVline(r4v3, r4);
  piField("C.N.S.:", patient.cns || "__________________", r4v3 + 2, r4);
  const r4v4 = ML + CW - 80; piVline(r4v4, r4);
  piField("RAÇA:", "_____________", r4v4 + 2, r4);

  const r5 = PI_TOP - 4 * PI_ROW_H;
  piField("RG:", patient.rg || "__________________", ML + 2, r5);
  const r5v1 = ML + 170; piVline(r5v1, r5);
  piField("CPF:", patient.cpf || "__________________", r5v1 + 2, r5);
  const r5v2 = ML + CW - 130; piVline(r5v2, r5);
  piField("TELEFONE:", patient.phone || "(____) __________", r5v2 + 2, r5);

  const r6 = PI_TOP - 5 * PI_ROW_H;
  piField("ENDEREÇO:", patient.address || "____________________________________________________________________", ML + 2, r6);

  const r7 = PI_TOP - 6 * PI_ROW_H;
  piField("RECEPÇÃO:", "________________________", ML + 2, r7);
  const r7v1 = ML + 145; piVline(r7v1, r7);
  piField("LEITO:", "_________", r7v1 + 2, r7);
  const r7v2 = r7v1 + 65; piVline(r7v2, r7);
  piField("CARÁTER:", "_________________________", r7v2 + 2, r7);
  const r7v3 = r7v2 + 145; piVline(r7v3, r7);
  piField("PESO:", "__________ kg", r7v3 + 2, r7);
  const r7v4 = r7v3 + 90; piVline(r7v4, r7);
  piField("DT FICHA:", new Date().toLocaleDateString("pt-BR") + "  ___:___", r7v4 + 2, r7);

  const r8 = PI_TOP - 7 * PI_ROW_H;
  piField("MÉDICO ASSISTENTE:", "_____________________________", ML + 2, r8);
  const r8v1 = ML + Math.floor(CW * 0.60); piVline(r8v1, r8);
  piField("UNIDADE:", "UPA 24H — Breves/PA", r8v1 + 2, r8);
  const r8v2 = ML + Math.floor(CW * 0.85); piVline(r8v2, r8);
  piField("DIAGNÓSTICO:", patient.diagnosis || "____________", r8v2 + 2, r8);

  return doc;
}

// ── APAC Laudo PDF ────────────────────────────────────────────────────────────

router.get("/:id/pdf/apac", async (req, res) => {
  const patientId = Number(req.params.id);
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1);
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  // Load official APAC template and overlay patient data (template already has its own header)
  const tplBytes = fs.readFileSync(templatePath("apac-laudo.pdf"));
  const doc  = await PDFDocument.load(tplBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.getPage(0);

  const BLACK = rgb(0, 0, 0);
  const BLUE  = rgb(0.06, 0.09, 0.35);
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };
  const ov     = (text: string | null | undefined, x: number, y: number, size = 8) => { if (!text) return; page.drawText(String(text), { x, y, font, size, color: BLUE }); };
  const ovBold = (text: string | null | undefined, x: number, y: number, size = 8) => { if (!text) return; page.drawText(String(text), { x, y, font: bold, size, color: BLACK }); };

  ovBold("UPA 24H — Unidade de Pronto Atendimento — Breves / PA", 57, 740);
  ovBold(patient.fullName, 57, 703);
  if (patient.sex === "M") ov("X", 395, 704, 9);
  if (patient.sex === "F") ov("X", 422, 704, 9);
  ov(patient.prontuarioNumber, 478, 703);
  ov(patient.cns, 57, 681);
  ov(fmtDate(patient.birthDate), 285, 681);
  ov("—", 402, 681, 7);
  ov(patient.motherName, 57, 659);
  ov(patient.phone ?? "", 395, 659);
  ov(patient.fullName, 57, 637);
  ov(patient.address, 57, 613);
  ov("Breves", 57, 591);
  ov("PA", 380, 591);
  ov(patient.diagnosis ?? "", 57, 395);
  ov(new Date().toLocaleDateString("pt-BR"), 285, 272);

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

  // Load official Ficha template and overlay patient data (template already has its own header)
  const tplBytes = fs.readFileSync(templatePath("ficha-referencia.pdf"));
  const doc  = await PDFDocument.load(tplBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.getPage(0);

  const BLACK = rgb(0, 0, 0);
  const BLUE  = rgb(0.06, 0.09, 0.35);
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };
  const ov     = (text: string | null | undefined, x: number, y: number, size = 8) => { if (!text) return; page.drawText(String(text), { x, y, font, size, color: BLUE }); };
  const ovBold = (text: string | null | undefined, x: number, y: number, size = 8) => { if (!text) return; page.drawText(String(text), { x, y, font: bold, size, color: BLACK }); };

  ov("UPA 24H — Breves / PA", 57, 723);
  ovBold(patient.fullName, 57, 653);
  ov(patient.cns, 430, 653);
  ov(fmtDate(patient.birthDate), 57, 637);
  ov(patient.age ? String(patient.age) : "", 165, 637);
  if (patient.sex === "M") ov("X", 237, 637, 9);
  if (patient.sex === "F") ov("X", 270, 637, 9);
  ov(patient.address, 57, 620);
  ov("Breves — PA", 430, 620);
  ov(patient.motherName, 57, 600);
  ov(patient.cpf ?? "", 57, 584);
  ov(patient.diagnosis ?? "", 57, 258);

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

interface PrescricaoPaciente {
  fullName: string;
  birthDate: string | null;
  age: number | null;
  sex: string | null;
  cpf: string | null;
  rg: string | null;
  motherName: string | null;
  address: string | null;
  cns: string | null;
  prontuarioNumber: string | null;
  atendimentoNumber: string | null;
  triageLevel: string | null;
}

async function buildPrescricaoPdf(
  patient: PrescricaoPaciente,
  content: string,
  createdAt: Date,
  authorName: string | null,
  authorCrm: string | null,
): Promise<Uint8Array> {
  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let prefeituraLogo: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  let upaLogo: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  try {
    prefeituraLogo = await doc.embedJpg(fs.readFileSync(assetPath("prefeitura-breves.jpeg")));
    upaLogo        = await doc.embedJpg(fs.readFileSync(assetPath("upa24h.jpg")));
  } catch { /* use text fallback */ }

  // ── Layout constants ─────────────────────────────────────────────────────────
  const PAGE_W = 842; // A4 landscape
  const PAGE_H = 595;
  const ML = 18; const MR = 18; const MT = 12; const MB = 12;
  const CW = PAGE_W - ML - MR; // 806

  // ── Colors ───────────────────────────────────────────────────────────────────
  const BLACK    = rgb(0,    0,    0);
  const WHITE    = rgb(1,    1,    1);
  const DK_GREEN = rgb(0.02, 0.36, 0.15); // green table headers
  const LT_GREEN = rgb(0.88, 0.94, 0.88); // green sub-headers
  const BLUE     = rgb(0.07, 0.36, 0.65); // branding blue
  const MED_GRAY = rgb(0.45, 0.45, 0.45);

  const page = doc.addPage([PAGE_W, PAGE_H]);

  // ── Outer border ─────────────────────────────────────────────────────────────
  const FORM_H = PAGE_H - MT - MB; // 571
  page.drawRectangle({
    x: ML, y: MB, width: CW, height: FORM_H,
    borderColor: BLACK, borderWidth: 1.5, color: WHITE,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HEADER (72pt)
  // ════════════════════════════════════════════════════════════════════════════
  const HDR_H   = 72;
  const HDR_TOP = MB + FORM_H;     // 583
  const HDR_BOT = HDR_TOP - HDR_H; // 511

  page.drawLine({
    start: { x: ML, y: HDR_BOT }, end: { x: ML + CW, y: HDR_BOT },
    thickness: 1.2, color: BLACK,
  });

  const LEFT_W  = 220;
  const CTR_W   = 252;
  const DIV1_X  = ML + LEFT_W;
  const DIV2_X  = ML + LEFT_W + CTR_W;

  page.drawLine({ start: { x: DIV1_X, y: HDR_BOT }, end: { x: DIV1_X, y: HDR_TOP }, thickness: 0.8, color: BLACK });
  page.drawLine({ start: { x: DIV2_X, y: HDR_BOT }, end: { x: DIV2_X, y: HDR_TOP }, thickness: 0.8, color: BLACK });

  // LEFT — Prefeitura de Breves logo
  if (prefeituraLogo) {
    const pH = HDR_H - 16;
    const pW = (prefeituraLogo.width / prefeituraLogo.height) * pH;
    page.drawImage(prefeituraLogo, { x: ML + (LEFT_W - pW) / 2, y: HDR_BOT + 8, width: pW, height: pH });
  } else {
    const lx = ML + 8;
    page.drawText("PREFEITURA DE",   { x: lx, y: HDR_TOP - 16, font: bold, size: 7.5, color: BLACK });
    page.drawText("Breves",          { x: lx, y: HDR_TOP - 44, font: bold, size: 28,  color: BLUE });
    page.drawText("De volta ao trabalho", { x: lx, y: HDR_TOP - 56, font, size: 6.5, color: MED_GRAY });
    page.drawEllipse({ x: DIV1_X - 28, y: HDR_BOT + 35, xScale: 22, yScale: 22, borderColor: BLUE, borderWidth: 1.2, color: rgb(0.92, 0.95, 1) });
  }

  // CENTER — UPA 24h logo
  if (upaLogo) {
    const uH = HDR_H - 16;
    const uW = (upaLogo.width / upaLogo.height) * uH;
    page.drawImage(upaLogo, { x: DIV1_X + (CTR_W - uW) / 2, y: HDR_BOT + 8, width: uW, height: uH });
  } else {
    const cx = DIV1_X + 10;
    page.drawText("UPA",   { x: cx, y: HDR_TOP - 44, font: bold, size: 34, color: DK_GREEN });
    const upaW = bold.widthOfTextAtSize("UPA", 34);
    page.drawText("24h",   { x: cx + upaW + 3, y: HDR_TOP - 44, font: bold, size: 28, color: rgb(0.75, 0.1, 0.1) });
    page.drawText("UNIDADE DE PRONTO ATENDIMENTO", { x: cx, y: HDR_TOP - 58, font: bold, size: 6.5, color: BLACK });
  }

  // RIGHT — PRESCRIÇÃO MÉDICA box
  const rx   = DIV2_X + 10;
  const rBoxW = CW - (DIV2_X - ML) - 20;
  const rBoxH = 52;
  const rBoxY = HDR_BOT + (HDR_H - rBoxH) / 2;
  page.drawRectangle({ x: rx, y: rBoxY, width: rBoxW, height: rBoxH, borderColor: BLACK, borderWidth: 1.8, color: WHITE });
  const pmText = "PRESCRIÇÃO MÉDICA";
  page.drawText(pmText, {
    x: rx + (rBoxW - bold.widthOfTextAtSize(pmText, 11)) / 2,
    y: rBoxY + rBoxH - 22, font: bold, size: 11, color: BLACK,
  });
  // EKG line
  const ekgY = rBoxY + 10;
  const ekgX = rx + 8;
  const ekgW = rBoxW - 16;
  const ekgPts: [number, number][] = [
    [0, 0], [0.28, 0], [0.34, 6], [0.39, 12], [0.44, -14],
    [0.49, 7], [0.54, 2], [0.59, 0], [1, 0],
  ];
  for (let i = 0; i < ekgPts.length - 1; i++) {
    page.drawLine({
      start: { x: ekgX + ekgPts[i][0] * ekgW,     y: ekgY + ekgPts[i][1] },
      end:   { x: ekgX + ekgPts[i+1][0] * ekgW,   y: ekgY + ekgPts[i+1][1] },
      thickness: 0.9, color: BLACK,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATIENT INFO — 8 rows × 13pt = 104pt
  // ════════════════════════════════════════════════════════════════════════════
  const PI_ROW_H = 13;
  const PI_ROWS  = 8;
  const PI_TOP   = HDR_BOT;              // 511
  const PI_BOT   = PI_TOP - PI_ROWS * PI_ROW_H; // 407

  for (let i = 1; i <= PI_ROWS; i++) {
    page.drawLine({
      start: { x: ML, y: PI_TOP - i * PI_ROW_H },
      end:   { x: ML + CW, y: PI_TOP - i * PI_ROW_H },
      thickness: 0.3, color: BLACK,
    });
  }

  const fmtDate = (d: string | null | undefined): string => {
    if (!d) return "___/___/______";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };

  function piField(label: string, value: string, x: number, rowTop: number) {
    page.drawText(label, { x: x + 2, y: rowTop - 4,  font: bold, size: 4.8, color: BLACK });
    page.drawText(value,  { x: x + 2, y: rowTop - 11, font,       size: 7,   color: BLACK });
  }
  function piVline(x: number, rowTop: number, h: number = PI_ROW_H) {
    page.drawLine({ start: { x, y: rowTop - h }, end: { x, y: rowTop }, thickness: 0.3, color: BLACK });
  }

  // Row 1: PRONTUÁRIO | REGISTRO | DATA INTERNAÇÃO | DATA ALTA
  const r1 = PI_TOP;
  piField("PRONTUÁRIO:", patient.prontuarioNumber || "_______________", ML + 2, r1);
  const r1v1 = ML + 148; piVline(r1v1, r1);
  piField("REGISTRO:", patient.atendimentoNumber || "_______________", r1v1 + 2, r1);
  const r1v2 = r1v1 + 148; piVline(r1v2, r1);
  piField("DATA INTERNAÇÃO:", "___/___/______   ___:___", r1v2 + 2, r1);
  const r1v3 = ML + CW - 148; piVline(r1v3, r1);
  piField("DATA ALTA:", "___/___/______", r1v3 + 2, r1);

  // Row 2: PACIENTE | NACIONALIDADE | CLASSIFICAÇÃO
  const r2 = PI_TOP - PI_ROW_H;
  piField("PACIENTE:", patient.fullName.toUpperCase(), ML + 2, r2);
  const r2v1 = ML + Math.min(
    4 + bold.widthOfTextAtSize("PACIENTE:", 4.8) + font.widthOfTextAtSize(patient.fullName, 7) + 10,
    Math.floor(CW * 0.55),
  );
  piVline(r2v1, r2);
  piField("NACIONALIDADE:", "Brasileira", r2v1 + 2, r2);
  const r2v2 = ML + Math.floor(CW * 0.76); piVline(r2v2, r2);
  const triageLabel: Record<string, string> = { red: "VERMELHO", orange: "LARANJA", yellow: "AMARELO", green: "VERDE", blue: "AZUL" };
  piField("CLASSIFICAÇÃO:", triageLabel[patient.triageLevel ?? ""] ?? "____________", r2v2 + 2, r2);

  // Row 3: MÃE | CONVÊNIO
  const r3 = PI_TOP - 2 * PI_ROW_H;
  piField("MÃE:", patient.motherName || "__________________________________________________", ML + 2, r3);
  const r3v1 = ML + Math.floor(CW * 0.76); piVline(r3v1, r3);
  piField("CONVÊNIO:", "SUS", r3v1 + 2, r3);

  // Row 4: SEXO | DATA NASC. | IDADE | C.N.S. | RAÇA
  const r4 = PI_TOP - 3 * PI_ROW_H;
  const sexTxt = patient.sex === "F"
    ? "SEXO:  (X) FEMININO    ( ) MASCULINO"
    : patient.sex === "M"
      ? "SEXO:  ( ) FEMININO    (X) MASCULINO"
      : "SEXO:  ( ) FEMININO    ( ) MASCULINO";
  page.drawText(sexTxt, { x: ML + 2, y: r4 - 7, font: bold, size: 5.5, color: BLACK });
  const r4v1 = ML + 200; piVline(r4v1, r4);
  piField("DATA NASC.:", fmtDate(patient.birthDate), r4v1 + 2, r4);
  const r4v2 = r4v1 + 100; piVline(r4v2, r4);
  piField("IDADE:", patient.age ? `${patient.age} A   ___ M   ___ D` : "___ A   ___ M   ___ D", r4v2 + 2, r4);
  const r4v3 = r4v2 + 128; piVline(r4v3, r4);
  piField("C.N.S.:", patient.cns || "__________________", r4v3 + 2, r4);
  const r4v4 = ML + CW - 100; piVline(r4v4, r4);
  piField("RAÇA:", "_____________", r4v4 + 2, r4);

  // Row 5: RG | CPF | TELEFONE
  const r5 = PI_TOP - 4 * PI_ROW_H;
  piField("RG:", patient.rg || "__________________", ML + 2, r5);
  const r5v1 = ML + 200; piVline(r5v1, r5);
  piField("CPF:", patient.cpf || "__________________", r5v1 + 2, r5);
  const r5v2 = ML + CW - 165; piVline(r5v2, r5);
  piField("TELEFONE:", "(____) __________", r5v2 + 2, r5);

  // Row 6: ENDEREÇO
  const r6 = PI_TOP - 5 * PI_ROW_H;
  piField("ENDEREÇO:", patient.address || "____________________________________________________________________________", ML + 2, r6);

  // Row 7: RECEPÇÃO | LEITO | CARÁTER | PESO | DT FICHA
  const r7 = PI_TOP - 6 * PI_ROW_H;
  piField("RECEPÇÃO:", "________________________", ML + 2, r7);
  const r7v1 = ML + 174; piVline(r7v1, r7);
  piField("LEITO:", "_________", r7v1 + 2, r7);
  const r7v2 = r7v1 + 74; piVline(r7v2, r7);
  piField("CARÁTER:", "_________________________", r7v2 + 2, r7);
  const r7v3 = r7v2 + 170; piVline(r7v3, r7);
  piField("PESO:", "__________ kg", r7v3 + 2, r7);
  const r7v4 = r7v3 + 104; piVline(r7v4, r7);
  piField("DT FICHA:", createdAt.toLocaleDateString("pt-BR") + "  ___:___", r7v4 + 2, r7);

  // Row 8: MÉDICO ASSISTENTE | UNIDADE | QUARTO
  const r8 = PI_TOP - 7 * PI_ROW_H;
  piField("MÉDICO ASSISTENTE:", authorName || "_____________________________", ML + 2, r8);
  const r8v1 = ML + Math.floor(CW * 0.60); piVline(r8v1, r8);
  piField("UNIDADE:", "UPA 24H — Breves", r8v1 + 2, r8);
  const r8v2 = ML + Math.floor(CW * 0.85); piVline(r8v2, r8);
  piField("QUARTO:", "____________", r8v2 + 2, r8);

  // ════════════════════════════════════════════════════════════════════════════
  // TABLE AREA — 3 columns
  // ════════════════════════════════════════════════════════════════════════════
  const FOOTER_H = 36;
  const TBL_TOP  = PI_BOT;            // 407
  const TBL_BOT  = MB + FOOTER_H;     // 48
  const TBL_H    = TBL_TOP - TBL_BOT; // 359

  const MED_W = Math.round(CW * 0.44); // ~355 — medicações
  const APR_W = Math.round(CW * 0.30); // ~242 — aprazamento
  const OBS_W = CW - MED_W - APR_W;   // ~209 — observações

  const MED_X = ML;
  const APR_X = MED_X + MED_W;
  const OBS_X = APR_X + APR_W;

  page.drawLine({ start: { x: APR_X, y: TBL_BOT }, end: { x: APR_X, y: TBL_TOP }, thickness: 0.8, color: BLACK });
  page.drawLine({ start: { x: OBS_X, y: TBL_BOT }, end: { x: OBS_X, y: TBL_TOP }, thickness: 0.8, color: BLACK });

  // Column headers (dark green)
  const COL_HDR_H = 14;
  const COL_SUB_H = 10;

  const colHeaders: [number, number, string][] = [
    [MED_X, MED_W, "MEDICAÇÕES PRESCRITAS"],
    [APR_X, APR_W, "APRAZAMENTO"],
    [OBS_X, OBS_W, "OBSERVAÇÕES"],
  ];
  for (const [x, w, txt] of colHeaders) {
    page.drawRectangle({ x, y: TBL_TOP - COL_HDR_H, width: w, height: COL_HDR_H, color: DK_GREEN });
    page.drawText(txt, {
      x: x + (w - bold.widthOfTextAtSize(txt, 7)) / 2,
      y: TBL_TOP - COL_HDR_H + 4, font: bold, size: 7, color: WHITE,
    });
  }

  // Sub-headers (light green)
  const SUB_Y = TBL_TOP - COL_HDR_H - COL_SUB_H;
  for (const [x, w] of colHeaders) {
    page.drawRectangle({ x, y: SUB_Y, width: w, height: COL_SUB_H, color: LT_GREEN });
  }

  // Medication sub-columns: ITEM | RX | DOSE | VIA
  const ITEM_W = 28;
  const DOSE_W = 45;
  const VIA_W  = 35;
  const RX_W   = MED_W - ITEM_W - DOSE_W - VIA_W;

  const ITEM_X = MED_X;
  const RX_X   = ITEM_X + ITEM_W;
  const DOSE_X = RX_X + RX_W;
  const VIA_X  = DOSE_X + DOSE_W;

  [RX_X, DOSE_X, VIA_X].forEach(x => {
    page.drawLine({ start: { x, y: TBL_BOT }, end: { x, y: TBL_TOP }, thickness: 0.3, color: BLACK });
  });

  page.drawText("ITEM",  { x: ITEM_X + 2, y: SUB_Y + 3, font: bold, size: 5,   color: BLACK });
  page.drawText("MEDICAÇÃO / APRESENTAÇÃO / CONCENTRAÇÃO / VIA", { x: RX_X + 2, y: SUB_Y + 3, font: bold, size: 4.5, color: BLACK });
  page.drawText("DOSE",  { x: DOSE_X + 2, y: SUB_Y + 3, font: bold, size: 5,   color: BLACK });
  page.drawText("VIA",   { x: VIA_X  + 2, y: SUB_Y + 3, font: bold, size: 5,   color: BLACK });
  page.drawText("HORÁRIOS (PREENCHER MANUALMENTE)", { x: APR_X + 4, y: SUB_Y + 3, font: bold, size: 4.8, color: BLACK });

  // ── Parse medication items from content ──────────────────────────────────────
  const SKIP_HDR = ["PRESCRIÇÃO MÉDICA —", "PACIENTE:", "MEDICAMENTOS:", "CURATIVOS:", "MONITORIZAÇÃO:", "DIETA:", "EXAMES SOLICITADOS", "OUTROS:"];
  const medItems: string[] = [];
  for (const rawLine of content.split("\n")) {
    const t = rawLine.trim();
    if (!t) continue;
    if (SKIP_HDR.some(h => t.toUpperCase().startsWith(h.toUpperCase()))) continue;
    const nm = t.match(/^(\d+)[.)]\s+(.+)/);
    if (nm) {
      medItems.push(nm[2]);
    } else if (!t.startsWith("PRESCRIÇÃO") && !t.startsWith("Paciente:")) {
      medItems.push(t);
    }
  }

  // ── 10 medication rows ───────────────────────────────────────────────────────
  const NUM_ROWS = 10;
  const DATA_TOP = SUB_Y;
  const ROW_H    = Math.floor((DATA_TOP - TBL_BOT) / NUM_ROWS);

  for (let i = 0; i < NUM_ROWS; i++) {
    const rowTop = DATA_TOP - i * ROW_H;
    const rowBot = rowTop - ROW_H;
    page.drawLine({ start: { x: ML, y: rowBot }, end: { x: ML + CW, y: rowBot }, thickness: 0.3, color: BLACK });

    // Item number
    const numLbl = `${i + 1}.`;
    page.drawText(numLbl, {
      x: ITEM_X + (ITEM_W - font.widthOfTextAtSize(numLbl, 7)) / 2,
      y: rowTop - 9, font: bold, size: 7, color: BLACK,
    });

    // Medication text
    const med = medItems[i] ?? "";
    if (med) {
      const viaMatch  = med.match(/\b(VO|EV|IV|SC|IM|SL|ORAL|INALATÓRIO|NASAL|RETAL|SUBLINGUAL|TÓPICO)\b/i);
      const doseMatch = med.match(/\b(\d+[\.,]?\d*\s*(?:mg|g|ml|mcg|UI|comp?|cáps?|gts?|amp|mEq|U))\b/i);
      const viaStr  = viaMatch  ? viaMatch[1].toUpperCase()  : "";
      const doseStr = doseMatch ? doseMatch[1] : "";

      wrapTextPdf(med, font, 6.5, RX_W - 4).slice(0, 2).forEach((wl, li) => {
        page.drawText(wl, { x: RX_X + 2, y: rowTop - 8 - li * 8, font, size: 6.5, color: BLACK });
      });
      if (doseStr) page.drawText(doseStr, { x: DOSE_X + 2, y: rowTop - 8, font, size: 6.5, color: BLACK });
      if (viaStr)  page.drawText(viaStr,  { x: VIA_X  + 2, y: rowTop - 8, font, size: 6.5, color: BLACK });
    }

    // APRAZAMENTO number
    page.drawText(`${i + 1}.`, { x: APR_X + 4, y: rowTop - 9, font, size: 7, color: BLACK });

    // OBSERVAÇÕES subtle line
    page.drawLine({
      start: { x: OBS_X + 4, y: rowTop - 8 },
      end:   { x: ML + CW - 4, y: rowTop - 8 },
      thickness: 0.15, color: rgb(0.75, 0.75, 0.75),
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FOOTER — Assinatura | CRM | DATA
  // ════════════════════════════════════════════════════════════════════════════
  const FTR_Y = MB + FOOTER_H; // 48
  page.drawLine({ start: { x: ML, y: FTR_Y }, end: { x: ML + CW, y: FTR_Y }, thickness: 0.5, color: BLACK });

  const SIG_LINE_Y = MB + 22;
  const SIG_X      = ML + 20;
  const SIG_W      = 205;
  page.drawLine({ start: { x: SIG_X, y: SIG_LINE_Y }, end: { x: SIG_X + SIG_W, y: SIG_LINE_Y }, thickness: 0.8, color: BLACK });
  const sigLbl = "ASSINATURA E CARIMBO DO MÉDICO";
  page.drawText(sigLbl, {
    x: SIG_X + (SIG_W - font.widthOfTextAtSize(sigLbl, 5.5)) / 2,
    y: SIG_LINE_Y - 9, font, size: 5.5, color: BLACK,
  });

  const crmStr = `CRM: ${authorCrm ?? "______________________________"}`;
  page.drawText(crmStr, {
    x: ML + CW / 2 - font.widthOfTextAtSize(crmStr, 8) / 2,
    y: SIG_LINE_Y, font, size: 8, color: BLACK,
  });

  const dateStr = `DATA: ___/___/______     ___:___`;
  page.drawText(dateStr, {
    x: ML + CW - font.widthOfTextAtSize(dateStr, 8) - 20,
    y: SIG_LINE_Y, font, size: 8, color: BLACK,
  });

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

  let authorName: string | null = null;
  let authorCrm:  string | null = null;
  if (prescription.userId) {
    const [staff] = await db.select({ name: staffTable.name, crm: staffTable.corenCrm })
      .from(staffTable)
      .where(eq(staffTable.id, prescription.userId))
      .limit(1);
    authorName = staff?.name ?? null;
    authorCrm  = staff?.crm  ?? null;
  }

  const pdfBytes = await buildPrescricaoPdf(
    {
      fullName:         patient.fullName,
      birthDate:        patient.birthDate        ?? null,
      age:              patient.age              ?? null,
      sex:              patient.sex              ?? null,
      cpf:              patient.cpf              ?? null,
      rg:               patient.rg               ?? null,
      motherName:       patient.motherName       ?? null,
      address:          patient.address          ?? null,
      cns:              patient.cns              ?? null,
      prontuarioNumber: patient.prontuarioNumber ?? null,
      atendimentoNumber:patient.atendimentoNumber?? null,
      triageLevel:      patient.triageLevel       ?? null,
    },
    prescription.content,
    prescription.createdAt,
    authorName,
    authorCrm,
  );

  const safeName = patient.fullName.replace(/\s+/g, "_");
  const dateSlug = prescription.createdAt.toISOString().slice(0, 10);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Prescricao_Medica_${safeName}_${dateSlug}.pdf"`);
  res.setHeader("Content-Length", pdfBytes.length);
  res.send(Buffer.from(pdfBytes));
});

// ── NIR / Regulação ───────────────────────────────────────────────────────────

router.get("/:id/nir", async (req, res) => {
  const patientId = Number(req.params.id);
  const result = await pool.query<{
    id: number; patient_id: number; tipo: string; conteudo: string;
    status_vaga: string; prioridade: string; destino: string;
    staff_id: number | null; staff_name: string | null;
    created_at: Date;
  }>(
    `SELECT n.id, n.patient_id, n.tipo, n.conteudo, n.status_vaga, n.prioridade,
            n.destino, n.staff_id, s.name AS staff_name, n.created_at
     FROM patient_nir_entries n
     LEFT JOIN staff s ON s.id = n.staff_id
     WHERE n.patient_id = $1
     ORDER BY n.created_at DESC`,
    [patientId]
  );
  res.json(result.rows.map(r => ({
    id:          r.id,
    patientId:   r.patient_id,
    tipo:        r.tipo,
    conteudo:    r.conteudo,
    statusVaga:  r.status_vaga,
    prioridade:  r.prioridade,
    destino:     r.destino,
    staffId:     r.staff_id,
    staffName:   r.staff_name,
    createdAt:   r.created_at.toISOString(),
  })));
});

router.post("/:id/nir", async (req, res) => {
  const patientId = Number(req.params.id);
  const staffId   = req.staff?.id ?? null;
  const { tipo, conteudo, statusVaga, prioridade, destino } = req.body as {
    tipo?: string; conteudo: string; statusVaga?: string; prioridade?: string; destino?: string;
  };
  if (!conteudo?.trim()) { res.status(400).json({ error: "Conteúdo obrigatório" }); return; }
  const result = await pool.query<{ id: number; created_at: Date }>(
    `INSERT INTO patient_nir_entries (patient_id, tipo, conteudo, status_vaga, prioridade, destino, staff_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, created_at`,
    [patientId, tipo ?? "atualizacao", conteudo.trim(), statusVaga ?? "aguardando", prioridade ?? "eletivo", destino ?? "", staffId]
  );
  res.status(201).json({ id: result.rows[0].id, createdAt: result.rows[0].created_at.toISOString() });
});

// ── Timeline ─────────────────────────────────────────────────────────────────

router.get("/:id/timeline", async (req, res) => {
  const patientId = Number(req.params.id);

  const [evols, rxs, vits, exams, transfers, pharma, nir, patient] = await Promise.all([
    pool.query<{ id: number; soap_text: string; user_id: number; staff_name: string | null; professional_category: string | null; created_at: Date }>(
      `SELECT e.id, e.soap_text, e.user_id, s.name AS staff_name, e.professional_category, e.created_at
       FROM patient_evolutions e LEFT JOIN staff s ON s.id = e.user_id
       WHERE e.patient_id = $1 AND (e.invalidado IS NULL OR e.invalidado = false)
       ORDER BY e.created_at DESC LIMIT 50`,
      [patientId]
    ),
    pool.query<{ id: number; medications: string; user_id: number; staff_name: string | null; created_at: Date }>(
      `SELECT p.id, p.medications, p.user_id, s.name AS staff_name, p.created_at
       FROM patient_prescriptions p LEFT JOIN staff s ON s.id = p.user_id
       WHERE p.patient_id = $1 AND (p.invalidado IS NULL OR p.invalidado = false)
       ORDER BY p.created_at DESC LIMIT 30`,
      [patientId]
    ),
    pool.query<{ id: number; bp: string | null; heart_rate: number | null; staff_name: string | null; created_at: Date }>(
      `SELECT v.id, v.bp, v.heart_rate, s.name AS staff_name, v.created_at
       FROM vitals v LEFT JOIN staff s ON s.id = v.staff_id
       WHERE v.patient_id = $1
       ORDER BY v.created_at DESC LIMIT 20`,
      [patientId]
    ),
    pool.query<{ id: number; laboratoriais: string[] | null; imagem: string[] | null; prioridade: string; staff_name: string | null; created_at: Date }>(
      `SELECT e.id, e.laboratoriais, e.imagem, e.prioridade, s.name AS staff_name, e.created_at
       FROM patient_exam_requests e LEFT JOIN staff s ON s.id = e.user_id
       WHERE e.patient_id = $1 AND (e.invalidado IS NULL OR e.invalidado = false)
       ORDER BY e.created_at DESC LIMIT 30`,
      [patientId]
    ),
    pool.query<{ id: number; hospital_name: string | null; transfer_status: string; staff_name: string | null; created_at: Date }>(
      `SELECT t.id, t.hospital_name, t.transfer_status, s.name AS staff_name, t.created_at
       FROM patient_transfers t LEFT JOIN staff s ON s.id = t.staff_id
       WHERE t.patient_id = $1
       ORDER BY t.created_at DESC LIMIT 10`,
      [patientId]
    ),
    pool.query<{ id: number; medication: string; status: string; staff_name: string | null; created_at: Date }>(
      `SELECT p.id, p.medication, p.status, s.name AS staff_name, p.created_at
       FROM patient_pharmacy_entries p LEFT JOIN staff s ON s.id = p.user_id
       WHERE p.patient_id = $1
       ORDER BY p.created_at DESC LIMIT 20`,
      [patientId]
    ),
    pool.query<{ id: number; tipo: string; conteudo: string; staff_name: string | null; created_at: Date }>(
      `SELECT n.id, n.tipo, n.conteudo, s.name AS staff_name, n.created_at
       FROM patient_nir_entries n LEFT JOIN staff s ON s.id = n.staff_id
       WHERE n.patient_id = $1
       ORDER BY n.created_at DESC LIMIT 20`,
      [patientId]
    ),
    pool.query<{ full_name: string; created_at: Date; care_status: string }>(
      `SELECT full_name, created_at, care_status FROM patients WHERE id = $1`,
      [patientId]
    ),
  ]);

  const events: { id: string; type: string; label: string; detail?: string; authorName?: string; sector?: string; timestamp: string }[] = [];

  // Admissão
  if (patient.rows[0]) {
    events.push({ id: "admissao-0", type: "admissao", label: "Admissão na UPA", detail: patient.rows[0].full_name, timestamp: patient.rows[0].created_at.toISOString() });
  }

  for (const e of evols.rows) {
    const isAlta = e.soap_text.includes("SUMÁRIO DE ALTA");
    events.push({
      id: `evol-${e.id}`,
      type: isAlta ? "alta" : "evolucao",
      label: isAlta ? "Alta do Paciente" : "Evolução Clínica",
      detail: e.soap_text.slice(0, 120),
      authorName: e.staff_name ?? undefined,
      timestamp: e.created_at.toISOString(),
    });
  }
  for (const r of rxs.rows) {
    events.push({ id: `rx-${r.id}`, type: "prescricao", label: "Prescrição Médica", detail: r.medications.slice(0, 80), authorName: r.staff_name ?? undefined, timestamp: r.created_at.toISOString() });
  }
  for (const v of vits.rows) {
    const detail = [v.bp && `PA: ${v.bp}`, v.heart_rate && `FC: ${v.heart_rate}bpm`].filter(Boolean).join(" · ");
    events.push({ id: `vit-${v.id}`, type: "vitais", label: "Sinais Vitais Registrados", detail, authorName: v.staff_name ?? undefined, timestamp: v.created_at.toISOString() });
  }
  for (const e of exams.rows) {
    const labs  = (e.laboratoriais ?? []).slice(0, 3).join(", ");
    const imgs  = (e.imagem ?? []).slice(0, 2).join(", ");
    const detail = [labs, imgs].filter(Boolean).join(" · ") || "Exame solicitado";
    events.push({ id: `exam-${e.id}`, type: "exame", label: "Solicitação de Exame", detail: `[${e.prioridade}] ${detail}`, authorName: e.staff_name ?? undefined, timestamp: e.created_at.toISOString() });
  }
  for (const t of transfers.rows) {
    events.push({ id: `transf-${t.id}`, type: "transferencia", label: "Transferência", detail: t.hospital_name ?? undefined, authorName: t.staff_name ?? undefined, timestamp: t.created_at.toISOString() });
  }
  for (const p of pharma.rows) {
    events.push({ id: `pharma-${p.id}`, type: "farmacia", label: `Farmácia — ${p.status}`, detail: p.medication, authorName: p.staff_name ?? undefined, timestamp: p.created_at.toISOString() });
  }
  for (const n of nir.rows) {
    events.push({ id: `nir-${n.id}`, type: "nir", label: "Regulação / NIR", detail: n.conteudo.slice(0, 100), authorName: n.staff_name ?? undefined, timestamp: n.created_at.toISOString() });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(events);
});

// ── delete ────────────────────────────────────────────────────────────────────

router.delete("/:id", requirePermissao("excluir_paciente"), async (req, res) => {
  const { id } = DeletePatientParams.parse({ id: Number(req.params.id) });
  await db.delete(patientsTable).where(eq(patientsTable.id, id));
  res.status(204).send();
});

export default router;
