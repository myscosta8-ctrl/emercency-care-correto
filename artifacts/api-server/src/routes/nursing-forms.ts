import { Router } from "express";
import { db, patientNursingFormsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermissao } from "../middleware/require-auth";

const router = Router({ mergeParams: true });
type P = Record<string, string>;

type MedRow = { medicacao: string; dose: string; via: string; horario: string; enfermeiro: string };

const ser = (r: typeof patientNursingFormsTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

// GET /api/patients/:id/nursing-forms — lista fichas do paciente (mais recente primeiro)
router.get("/", async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const rows = await db.select().from(patientNursingFormsTable)
    .where(eq(patientNursingFormsTable.patientId, patientId))
    .orderBy(desc(patientNursingFormsTable.createdAt));
  res.json(rows.map(ser));
});

// GET /api/patients/:id/nursing-forms/:formId — busca ficha específica
router.get("/:formId", async (req, res) => {
  const formId = Number((req.params as P)["formId"]);
  const [row] = await db.select().from(patientNursingFormsTable)
    .where(eq(patientNursingFormsTable.id, formId)).limit(1);
  if (!row) { res.status(404).json({ error: "Ficha não encontrada" }); return; }
  res.json(ser(row));
});

function parseBody(b: Record<string, unknown>) {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? v : []) as T[];
  const meds = (v: unknown): MedRow[] => (Array.isArray(v) ? v : []) as MedRow[];
  return {
    dataAtendimento:      String(b.dataAtendimento      ?? ""),
    horaAtendimento:      String(b.horaAtendimento      ?? ""),
    classificacaoRisco:   String(b.classificacaoRisco   ?? ""),
    origemPaciente:       arr<string>(b.origemPaciente),
    origemOutro:          String(b.origemOutro           ?? ""),
    setor:                String(b.setor                 ?? ""),
    enfermeiroResponsavel: String(b.enfermeiroResponsavel ?? ""),
    coren:                String(b.coren                 ?? ""),
    queixaPrincipal:      arr<string>(b.queixaPrincipal),
    queixaOutros:         String(b.queixaOutros          ?? ""),
    historiaClinica:      arr<string>(b.historiaClinica),
    historiaObservacoes:  String(b.historiaObservacoes   ?? ""),
    svPa:       String(b.svPa    ?? ""),
    svFc:       String(b.svFc    ?? ""),
    svFr:       String(b.svFr    ?? ""),
    svSpo2:     String(b.svSpo2  ?? ""),
    svTemp:     String(b.svTemp  ?? ""),
    svGlicemia: String(b.svGlicemia ?? ""),
    svEva:      String(b.svEva   ?? ""),
    avaliacaoEstadoGeral: String(b.avaliacaoEstadoGeral ?? ""),
    avaliacaoConsciencia: arr<string>(b.avaliacaoConsciencia),
    avaliacaoPele:        arr<string>(b.avaliacaoPele),
    avaliacaoRespiracao:  arr<string>(b.avaliacaoRespiracao),
    avaliacaoPerfusao:    arr<string>(b.avaliacaoPerfusao),
    avaliacaoMobilidade:  arr<string>(b.avaliacaoMobilidade),
    tecCapilar:           String(b.tecCapilar           ?? ""),
    antecedentes:         arr<string>(b.antecedentes),
    antecedentesOutros:   String(b.antecedentesOutros   ?? ""),
    alergia:              String(b.alergia              ?? "nao"),
    alergiaQual:          String(b.alergiaQual          ?? ""),
    medicacaoContinua:    String(b.medicacaoContinua    ?? "nao"),
    medicacaoContinuaQuais: String(b.medicacaoContinuaQuais ?? ""),
    procedimentos:          arr<string>(b.procedimentos),
    procedimentosOutros:    String(b.procedimentosOutros    ?? ""),
    medicacoesAdministradas: meds(b.medicacoesAdministradas),
    evolucaoEnfermagem:   arr<string>(b.evolucaoEnfermagem),
    intercorrenciaQual:   String(b.intercorrenciaQual   ?? ""),
    evolucaoObservacoes:  String(b.evolucaoObservacoes  ?? ""),
    conduta:              arr<string>(b.conduta),
    condutaObservacoes:   String(b.condutaObservacoes   ?? ""),
    assinaturaEnfermeiro: String(b.assinaturaEnfermeiro ?? ""),
    assinaturaCoren:      String(b.assinaturaCoren      ?? ""),
    assinaturaData:       String(b.assinaturaData       ?? ""),
  };
}

// POST /api/patients/:id/nursing-forms — cria nova ficha
router.post("/", requirePermissao("registrar_evolucao"), async (req, res) => {
  const patientId = Number((req.params as P)["id"]);
  const data = parseBody(req.body as Record<string, unknown>);
  const [row] = await db.insert(patientNursingFormsTable)
    .values({ ...data, patientId, createdBy: req.staff?.id ?? 0 })
    .returning();
  res.status(201).json(ser(row));
});

// PUT /api/patients/:id/nursing-forms/:formId — atualiza ficha
router.put("/:formId", requirePermissao("registrar_evolucao"), async (req, res) => {
  const formId = Number((req.params as P)["formId"]);
  const data = parseBody(req.body as Record<string, unknown>);
  const [row] = await db.update(patientNursingFormsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(patientNursingFormsTable.id, formId))
    .returning();
  if (!row) { res.status(404).json({ error: "Ficha não encontrada" }); return; }
  res.json(ser(row));
});

// DELETE /api/patients/:id/nursing-forms/:formId
router.delete("/:formId", requirePermissao("gerenciar_usuarios"), async (req, res) => {
  const formId = Number((req.params as P)["formId"]);
  await db.delete(patientNursingFormsTable).where(eq(patientNursingFormsTable.id, formId));
  res.status(204).end();
});

export default router;
