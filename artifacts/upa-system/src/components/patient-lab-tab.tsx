import { useState, useEffect, useRef, useCallback } from "react";
import {
  FlaskConical, Upload, CheckCircle2, Clock, FileText, Loader2, Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

export interface ExamResultItem {
  id: number;
  patientId: number;
  examName: string;
  examType: "laboratorial" | "imagem";
  prioridade: "urgente" | "rotina" | "eletivo";
  resultText: string;
  fileName: string;
  fileMime: string;
  fileUrl?: string;
  hasFile?: boolean;
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

async function fetchExamResults(patientId: number, staffId: number): Promise<ExamResultItem[]> {
  const r = await fetch(`/api/patients/${patientId}/exam-results`, {
    credentials: "include",
    headers: { "x-staff-id": String(staffId) },
  });
  if (!r.ok) throw new Error("Erro ao buscar exames");
  return r.json();
}

async function postExamResult(patientId: number, data: Partial<ExamResultItem>, staffId: number): Promise<ExamResultItem> {
  const r = await fetch(`/api/patients/${patientId}/exam-results`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-staff-id": String(staffId) },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Erro ao criar exame");
  return r.json();
}

interface LiberarPayload { resultText?: string; fileData?: string; fileName?: string; fileMime?: string; }

async function liberarExam(patientId: number, examId: number, data: LiberarPayload, staffId: number): Promise<ExamResultItem> {
  const r = await fetch(`/api/patients/${patientId}/exam-results/${examId}/liberar`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-staff-id": String(staffId) },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Erro ao liberar exame");
  return r.json();
}

// ── Liberar Form ──────────────────────────────────────────────────────────────

interface LiberarFormProps {
  patientId: number;
  exam: ExamResultItem;
  onSuccess: () => void;
  onCancel: () => void;
  staffId: number;
}

function LiberarForm({ patientId, exam, onSuccess, onCancel, staffId }: LiberarFormProps) {
  const { toast } = useToast();
  const [resultText, setResultText] = useState(exam.resultText ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let fileData = ""; let fileName = ""; let fileMime = "";
      if (file) {
        fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
          reader.readAsDataURL(file);
        });
        fileName = file.name;
        fileMime = file.type;
      }
      await liberarExam(patientId, exam.id, { resultText, fileData, fileName, fileMime }, staffId);
      toast({ title: "Resultado liberado com sucesso", description: exam.examName });
      onSuccess();
    } catch {
      toast({ title: "Erro ao liberar resultado", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-border/30 mt-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Inserir resultado — {exam.examName}
      </p>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Resultado textual</label>
        <Textarea
          value={resultText}
          onChange={e => setResultText(e.target.value)}
          placeholder="Descreva o resultado do exame..."
          rows={3}
          className="text-sm resize-none"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Arquivo (PDF / imagem)</label>
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
              <Upload className="h-3.5 w-3.5" />Clique para anexar PDF ou imagem
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

// ── Novo Exame Form ───────────────────────────────────────────────────────────

interface NovoExameFormProps {
  patientId: number;
  onSuccess: () => void;
  onCancel: () => void;
  staffId: number;
}

function NovoExameForm({ patientId, onSuccess, onCancel, staffId }: NovoExameFormProps) {
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
      await postExamResult(patientId, { examName: examName.trim(), examType, prioridade }, staffId);
      toast({ title: "Exame registrado", description: examName.trim() });
      onSuccess();
    } catch {
      toast({ title: "Erro ao registrar exame", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border border-border/40 rounded-lg p-3 bg-muted/10">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Novo Exame Laboratorial / Imagem
      </p>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Nome do exame *</label>
        <Input
          value={examName}
          onChange={e => setExamName(e.target.value)}
          placeholder="Ex: Hemograma completo, Raio-X tórax..."
          className="text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
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
          <label className="text-xs text-muted-foreground">Prioridade</label>
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

// ── Main Component ────────────────────────────────────────────────────────────

interface PatientLabTabProps {
  patientId: number;
  active: boolean;
}

export function PatientLabTab({ patientId, active }: PatientLabTabProps) {
  const { toast } = useToast();
  const { activeUser } = useAuth();
  const staffId = activeUser?.id ?? 0;
  const [exams, setExams] = useState<ExamResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liberandoId, setLiberandoId] = useState<number | null>(null);
  const [novoExame, setNovoExame] = useState(false);

  const loadExams = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchExamResults(patientId, staffId);
      setExams(data);
    } catch {
      if (!background) toast({ title: "Erro ao carregar exames do laboratório", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId, staffId, toast]);

  useEffect(() => {
    if (!active) return;
    loadExams();
    const interval = setInterval(() => loadExams(true), 30_000);
    return () => clearInterval(interval);
  }, [active, loadExams]);

  const pendentes = exams.filter(e => e.status === "pendente").length;
  const liberados = exams.filter(e => e.status === "liberado").length;

  return (
    <div className="space-y-4">
      {/* cabeçalho */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-green-400" />
          Resultados de Laboratório / Imagem
          {pendentes > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              {pendentes} pendente{pendentes !== 1 ? "s" : ""}
            </span>
          )}
          {liberados > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              {liberados} liberado{liberados !== 1 ? "s" : ""}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => loadExams(false)}
            title="Atualizar agora"
          >
            <Loader2 className={cn("h-3.5 w-3.5", (loading || refreshing) && "animate-spin")} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => setNovoExame(v => !v)}
          >
            {novoExame ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {novoExame ? "Cancelar" : "Solicitar Exame"}
          </Button>
        </div>
      </div>

      {/* form novo exame */}
      {novoExame && (
        <NovoExameForm
          patientId={patientId}
          staffId={staffId}
          onSuccess={() => { setNovoExame(false); loadExams(); }}
          onCancel={() => setNovoExame(false)}
        />
      )}

      {/* indicador de polling */}
      <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
        <Clock className="h-3 w-3" /> Atualização automática a cada 30 segundos
      </p>

      {/* lista de exames */}
      {loading && exams.length === 0 ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-lg border border-border/50">
          <FlaskConical className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum exame registrado para este paciente.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Clique em "Solicitar Exame" para adicionar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map(exam => {
            const pcfg = PRIORIDADE_CFG[exam.prioridade] ?? PRIORIDADE_CFG.rotina;
            const isLiberando = liberandoId === exam.id;

            return (
              <div key={exam.id} className="rounded-lg border border-border/40 bg-card/60 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/10 flex-wrap">
                  <span className={cn("text-[10px] font-bold px-1.5 py-0 rounded border leading-5", pcfg.cls)}>
                    {pcfg.label}
                  </span>
                  <span className="text-sm font-semibold">{exam.examName}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{exam.examType}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {exam.status === "liberado" ? (
                      <span className="flex items-center gap-1 text-[10px] text-green-400 font-semibold">
                        <CheckCircle2 className="h-3 w-3" />Liberado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-yellow-400 font-semibold">
                        <Clock className="h-3 w-3" />Pendente
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-4 py-2.5 space-y-2">
                  {exam.resultText && (
                    <p className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1.5 whitespace-pre-wrap">
                      {exam.resultText}
                    </p>
                  )}
                  {(exam.fileName || exam.hasFile) && (
                    <a
                      href={exam.fileUrl || `/api/patients/${exam.patientId}/exam-results/${exam.id}/file`}
                      download={!exam.fileUrl ? (exam.fileName || "exame") : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
                    >
                      <FileText className="h-3 w-3" />{exam.fileName || "Ver arquivo"}
                    </a>
                  )}

                  {exam.status === "pendente" && !isLiberando && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setLiberandoId(exam.id)}
                    >
                      <Upload className="h-3 w-3" />Inserir resultado
                    </Button>
                  )}

                  {exam.status === "pendente" && isLiberando && (
                    <LiberarForm
                      patientId={patientId}
                      exam={exam}
                      staffId={staffId}
                      onSuccess={() => { setLiberandoId(null); loadExams(); }}
                      onCancel={() => setLiberandoId(null)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
