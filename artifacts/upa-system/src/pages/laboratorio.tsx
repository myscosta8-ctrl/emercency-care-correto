import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListPatients, getListPatientsQueryKey } from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import {
  FlaskConical, Upload, CheckCircle2, Clock, Bell, X, FileText, ChevronDown, ChevronRight, Loader2,
} from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

// ── types ─────────────────────────────────────────────────────────────────────

interface ExamResult {
  id: number;
  patientId: number;
  examName: string;
  examType: "laboratorial" | "imagem";
  prioridade: "urgente" | "rotina" | "eletivo";
  resultText: string;
  fileData: string;
  fileName: string;
  fileMime: string;
  status: "pendente" | "liberado";
  liberadoAt: string | null;
  notified: boolean;
  createdAt: string;
  updatedAt: string;
}

const PRIORIDADE_CFG = {
  urgente: { label: "URGENTE", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  rotina:  { label: "Rotina",  cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  eletivo: { label: "Eletivo", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
} as const;

const TRIAGE_CFG = {
  red:    { dot: "bg-red-500",    text: "text-red-400",    label: "Vermelho"  },
  orange: { dot: "bg-orange-500", text: "text-orange-400", label: "Laranja"   },
  yellow: { dot: "bg-yellow-400", text: "text-yellow-400", label: "Amarelo"   },
  green:  { dot: "bg-green-500",  text: "text-green-400",  label: "Verde"     },
  blue:   { dot: "bg-blue-500",   text: "text-blue-400",   label: "Azul"      },
} as const;

// ── api helpers ───────────────────────────────────────────────────────────────

async function fetchExamResults(patientId: number, staffId: number): Promise<ExamResult[]> {
  const r = await fetch(`/api/patients/${patientId}/exam-results`, {
    credentials: "include",
    headers: { "x-staff-id": String(staffId) },
  });
  if (!r.ok) throw new Error("Erro ao buscar exames");
  return r.json();
}

async function postExamResult(patientId: number, data: Partial<ExamResult>, staffId: number): Promise<ExamResult> {
  const r = await fetch(`/api/patients/${patientId}/exam-results`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-staff-id": String(staffId) },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Erro ao criar exame");
  return r.json();
}

async function liberarExam(patientId: number, examId: number, data: Partial<ExamResult>, staffId: number): Promise<ExamResult> {
  const r = await fetch(`/api/patients/${patientId}/exam-results/${examId}/liberar`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-staff-id": String(staffId) },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Erro ao liberar exame");
  return r.json();
}

// ── componente de upload / liberar exame ──────────────────────────────────────

interface LiberarFormProps {
  patient: Patient;
  exam: ExamResult;
  onSuccess: () => void;
  onCancel: () => void;
  userId: number;
}

function LiberarForm({ patient, exam, onSuccess, onCancel, userId }: LiberarFormProps) {
  const { toast } = useToast();
  const [resultText, setResultText] = useState(exam.resultText ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let fileData = ""; let fileName = ""; let fileMime = "";
      if (file) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        fileData = btoa(bin);
        fileName = file.name;
        fileMime = file.type;
      }
      await liberarExam(patient.id, exam.id, { resultText, fileData, fileName, fileMime }, userId);
      toast({ title: "Exame liberado com sucesso", description: `${exam.examName} — ${patient.full_name}` });
      onSuccess();
    } catch {
      toast({ title: "Erro ao liberar exame", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resultado textual</label>
        <Textarea
          value={resultText}
          onChange={e => setResultText(e.target.value)}
          placeholder="Descreva o resultado do exame..."
          rows={4}
          className="text-sm resize-none"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Arquivo (PDF / imagem)</label>
        <div
          className="border border-dashed border-border rounded-md p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {file ? (
            <p className="text-xs text-green-400 flex items-center justify-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />{file.name}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Upload className="h-3.5 w-3.5" />Clique para anexar arquivo
            </p>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" className="flex-1 gap-1" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {loading ? "Liberando..." : "Liberar Resultado"}
        </Button>
      </div>
    </form>
  );
}

// ── novo exame form ────────────────────────────────────────────────────────────

interface NovoExameFormProps {
  patient: Patient;
  onSuccess: () => void;
  onCancel: () => void;
  userId: number;
}

function NovoExameForm({ patient, onSuccess, onCancel, userId }: NovoExameFormProps) {
  const { toast } = useToast();
  const [examName, setExamName] = useState("");
  const [examType, setExamType] = useState<"laboratorial" | "imagem">("laboratorial");
  const [prioridade, setPrioridade] = useState<"urgente" | "rotina" | "eletivo">("rotina");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim()) return;
    setLoading(true);
    try {
      await postExamResult(patient.id, { examName: examName.trim(), examType, prioridade }, userId);
      toast({ title: "Solicitação registrada", description: `${examName} para ${patient.full_name}` });
      onSuccess();
    } catch {
      toast({ title: "Erro ao registrar exame", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do exame</label>
        <Input value={examName} onChange={e => setExamName(e.target.value)} placeholder="Ex: Hemograma completo" className="text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</label>
          <select
            value={examType}
            onChange={e => setExamType(e.target.value as "laboratorial" | "imagem")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="laboratorial">Laboratorial</option>
            <option value="imagem">Imagem</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prioridade</label>
          <select
            value={prioridade}
            onChange={e => setPrioridade(e.target.value as "urgente" | "rotina" | "eletivo")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="urgente">Urgente</option>
            <option value="rotina">Rotina</option>
            <option value="eletivo">Eletivo</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" className="flex-1" disabled={loading || !examName.trim()}>
          {loading ? "Salvando..." : "Solicitar"}
        </Button>
      </div>
    </form>
  );
}

// ── patient exam card ──────────────────────────────────────────────────────────

interface PatientExamCardProps {
  patient: Patient;
  userId: number;
  onExamNotified?: () => void;
}

function PatientExamCard({ patient, userId, onExamNotified }: PatientExamCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [liberandoId, setLiberandoId] = useState<number | null>(null);
  const [novoExame, setNovoExame] = useState(false);
  const { toast } = useToast();

  const tc = TRIAGE_CFG[patient.triage_level as keyof typeof TRIAGE_CFG] ?? TRIAGE_CFG.blue;

  const loadExams = async () => {
    setLoading(true);
    try {
      const data = await fetchExamResults(patient.id, userId);
      setExams(data);
    } catch {
      toast({ title: "Erro ao carregar exames", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) loadExams();
  }, [expanded]);

  const pendingCount = exams.filter(e => e.status === "pendente").length;
  const readyCount   = exams.filter(e => e.status === "liberado" && !e.notified).length;

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors text-left"
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", tc.dot)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{patient.full_name}</p>
          <p className="text-xs text-muted-foreground">{patient.age}a · {tc.label}{patient.bed ? ` · Leito: ${patient.bed}` : ""}</p>
        </div>
        {readyCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30 shrink-0">
            <Bell className="h-3 w-3" />
            {readyCount} liberado{readyCount !== 1 ? "s" : ""}
          </span>
        )}
        {pendingCount > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-yellow-500/15 text-yellow-400 border-yellow-500/30 shrink-0">
            {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border/30 bg-background/40">
          {/* PRN / ATD */}
          {(patient.prontuarioNumber || patient.atendimentoNumber) && (
            <div className="px-4 pt-2 pb-1 flex gap-3 flex-wrap">
              {patient.prontuarioNumber && (
                <span className="text-[11px] font-mono text-muted-foreground">PRN: <strong>{patient.prontuarioNumber}</strong></span>
              )}
              {patient.atendimentoNumber && (
                <span className="text-[11px] font-mono text-muted-foreground">ATD: <strong>{patient.atendimentoNumber}</strong></span>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {exams.length === 0 && !novoExame && (
                <p className="px-4 py-3 text-xs text-muted-foreground/60">Nenhum exame solicitado</p>
              )}
              {exams.map(exam => {
                const pcfg = PRIORIDADE_CFG[exam.prioridade] ?? PRIORIDADE_CFG.rotina;
                const isLiberando = liberandoId === exam.id;
                return (
                  <div key={exam.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] font-bold px-1.5 py-0 rounded border leading-5", pcfg.cls)}>{pcfg.label}</span>
                      <span className="text-xs font-semibold">{exam.examName}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{exam.examType}</span>
                      {exam.status === "liberado" ? (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400 font-semibold">
                          <CheckCircle2 className="h-3 w-3" />Liberado
                        </span>
                      ) : (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-yellow-400 font-semibold">
                          <Clock className="h-3 w-3" />Pendente
                        </span>
                      )}
                    </div>
                    {exam.resultText && (
                      <p className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1.5 whitespace-pre-wrap">{exam.resultText}</p>
                    )}
                    {exam.fileName && (
                      <p className="text-xs text-blue-400 flex items-center gap-1">
                        <FileText className="h-3 w-3" />{exam.fileName}
                      </p>
                    )}
                    {exam.status === "pendente" && !isLiberando && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 mt-1"
                        onClick={() => setLiberandoId(exam.id)}
                      >
                        <Upload className="h-3 w-3" />Inserir resultado
                      </Button>
                    )}
                    {exam.status === "pendente" && isLiberando && (
                      <LiberarForm
                        patient={patient}
                        exam={exam}
                        userId={userId}
                        onSuccess={() => { setLiberandoId(null); loadExams(); onExamNotified?.(); }}
                        onCancel={() => setLiberandoId(null)}
                      />
                    )}
                  </div>
                );
              })}

              {/* Novo exame */}
              {novoExame ? (
                <div className="px-4 py-3">
                  <NovoExameForm
                    patient={patient}
                    userId={userId}
                    onSuccess={() => { setNovoExame(false); loadExams(); }}
                    onCancel={() => setNovoExame(false)}
                  />
                </div>
              ) : (
                <div className="px-4 py-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setNovoExame(true)}>
                    + Solicitar exame
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── notificação de exames liberados ───────────────────────────────────────────

function useExamNotifications(patients: Patient[], staffId: number) {
  const [newlyReleased, setNewlyReleased] = useState<{ name: string; exam: string }[]>([]);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (patients.length === 0) return;
    const interval = setInterval(async () => {
      const alerts: { name: string; exam: string }[] = [];
      for (const p of patients) {
        try {
          const exams = await fetchExamResults(p.id, staffId);
          const fresh = exams.filter(e => e.status === "liberado" && !e.notified && !seen.current.has(e.id));
          for (const e of fresh) {
            alerts.push({ name: p.full_name, exam: e.examName });
            seen.current.add(e.id);
          }
        } catch { }
      }
      if (alerts.length > 0) setNewlyReleased(prev => [...prev, ...alerts]);
    }, 30_000);
    return () => clearInterval(interval);
  }, [patients, staffId]);

  const dismiss = () => setNewlyReleased([]);

  return { newlyReleased, dismiss };
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function LaboratorioPage() {
  const { activeUser } = useAuth();
  const { data: patients, isLoading } = useListPatients();
  const [search, setSearch] = useState("");
  const userId = activeUser?.id ?? 0;

  // Active patients only (excluding alta)
  const active = (patients ?? []).filter(p => p.careStatus !== "Alta");
  const filtered = active.filter(p =>
    !search || p.full_name.toLowerCase().includes(search.toLowerCase()) || (p.bed?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const { newlyReleased, dismiss } = useExamNotifications(active, userId);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <RoleHeader title="Laboratório" icon={<FlaskConical className="h-5 w-5 text-primary" />} />

      <main className="flex-1 container mx-auto px-4 py-4 max-w-4xl space-y-4">

        {/* ── notificação de novos resultados ── */}
        {newlyReleased.length > 0 && (
          <div className="rounded-lg border border-green-500/50 bg-green-950/20 px-4 py-3 flex items-start gap-3">
            <Bell className="h-4 w-4 text-green-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-300">Novos resultados disponíveis</p>
              <ul className="mt-1 space-y-0.5">
                {newlyReleased.map((n, i) => (
                  <li key={i} className="text-xs text-muted-foreground">{n.name} — {n.exam}</li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── busca ── */}
        <div className="relative">
          <FlaskConical className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar paciente por nome ou leito..."
            className="pl-9 text-sm"
          />
        </div>

        {/* ── lista de pacientes ── */}
        {isLoading ? (
          <div className="space-y-2">
            {[0,1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-muted/20 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? "Nenhum paciente encontrado" : "Nenhum paciente ativo"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <PatientExamCard
                key={p.id}
                patient={p}
                userId={userId}
                onExamNotified={() => {}}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
