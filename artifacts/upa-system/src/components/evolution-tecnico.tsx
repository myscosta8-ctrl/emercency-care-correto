import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardCheck, Send, Printer, ChevronDown, ChevronUp, Ban, CheckCircle } from "lucide-react";
import { buildInstitutionalHeader, buildPrintDocStyles, type PrintPatientInfo } from "@/lib/print-header-html";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddPatientHistory,
  useGetPatientHistory,
  getGetPatientHistoryQueryKey,
} from "@workspace/api-client-react";

interface Props {
  patientId: number;
  userId: number;
  patientName: string;
  patient?: PrintPatientInfo | null;
  staffMap: Record<number, { name: string }>;
}

const PROCEDIMENTOS = [
  "Sinais vitais",
  "Glicemia capilar (HGT)",
  "Curativo simples",
  "Curativo complexo",
  "Banho no leito",
  "Higiene oral",
  "Mudança de decúbito",
  "Aspiração de VAS",
  "Cateterismo vesical",
  "Sondagem nasogástrica",
  "Sondagem nasoenteral",
  "Punção venosa periférica",
  "Coleta de exames laboratoriais",
  "Administração de medicamentos EV",
  "Administração de medicamentos IM",
  "Administração de medicamentos VO",
  "Controle de diurese",
  "Balanço hídrico",
  "Oxigenoterapia",
] as const;

type Turno = "Manhã" | "Tarde" | "Noite";

interface TecnicoData {
  turno: Turno;
  procedimentos: string[];
  intercorrencias: string;
  observacoes: string;
}

const EMPTY: TecnicoData = {
  turno: "Manhã",
  procedimentos: [],
  intercorrencias: "",
  observacoes: "",
};

function buildSoapText(d: TecnicoData): string {
  const parts: string[] = [`[TURNO] ${d.turno}`];
  if (d.procedimentos.length > 0)
    parts.push(`[PROCEDIMENTOS REALIZADOS]\n${d.procedimentos.map(p => `• ${p}`).join("\n")}`);
  if (d.intercorrencias.trim())
    parts.push(`[INTERCORRÊNCIAS]\n${d.intercorrencias.trim()}`);
  if (d.observacoes.trim())
    parts.push(`[OBSERVAÇÕES]\n${d.observacoes.trim()}`);
  return parts.join("\n\n");
}

interface AugEntry {
  id: number;
  userId: number;
  createdAt: string;
  professionalCategory?: string | null;
  soapText: string;
  structuredData: unknown;
  invalidado?: boolean;
  motivoInvalidacao?: string;
  finalizado?: boolean;
}

export function EvolutionTecnico({ patientId, userId, patientName, patient, staffMap }: Props) {
  const [form, setForm]               = useState<TecnicoData>(EMPTY);
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [finalizingId, setFinalizingId]     = useState<number | null>(null);
  const [invalidatingId, setInvalidatingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useGetPatientHistory(patientId, {
    query: { queryKey: getGetPatientHistoryQueryKey(patientId) },
  });

  const addHistory = useAddPatientHistory();

  const tecnicoHistory = ((history ?? []) as AugEntry[]).filter(
    e => e.professionalCategory === "tecnico_enfermagem" && e.soapText !== "Admissão inicial"
  );

  const toggleProcedimento = (proc: string) => {
    setForm(f => ({
      ...f,
      procedimentos: f.procedimentos.includes(proc)
        ? f.procedimentos.filter(p => p !== proc)
        : [...f.procedimentos, proc],
    }));
  };

  const isValid = form.procedimentos.length > 0 || form.intercorrencias.trim() || form.observacoes.trim();

  const handleSubmit = () => {
    addHistory.mutate(
      {
        id: patientId,
        data: {
          userId,
          soapText: buildSoapText(form),
          professionalCategory: "tecnico_enfermagem",
          structuredData: form as unknown as Record<string, unknown>,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patientId) });
          setForm(EMPTY);
          toast({ title: "Registro salvo como rascunho. Publique quando estiver pronto." });
        },
        onError: () => toast({ title: "Erro ao registrar", variant: "destructive" }),
      }
    );
  };

  const handleFinalizar = async (entry: AugEntry) => {
    setFinalizingId(entry.id);
    try {
      const resp = await fetch(`/api/patients/${patientId}/evolutions/${entry.id}/finalizar`, {
        method: "PATCH",
        headers: { "x-staff-id": String(userId) },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao publicar");
      }
      queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patientId) });
      toast({ title: "Registro publicado com sucesso" });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Erro ao publicar", variant: "destructive" });
    } finally {
      setFinalizingId(null);
    }
  };

  const handleInvalidarEntry = async (entry: AugEntry) => {
    const motivo = window.prompt("Motivo da invalidação (opcional):");
    if (motivo === null) return;
    setInvalidatingId(entry.id);
    try {
      const resp = await fetch(`/api/patients/${patientId}/evolutions/${entry.id}/invalidar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-staff-id": String(userId) },
        body: JSON.stringify({ motivo }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao invalidar");
      }
      queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patientId) });
      toast({ title: "Registro invalidado" });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Erro ao invalidar", variant: "destructive" });
    } finally {
      setInvalidatingId(null);
    }
  };

  const handlePrint = (entry: AugEntry) => {
    const d = entry.structuredData as TecnicoData | null;
    const authorName = staffMap[entry.userId]?.name ?? `Técnico(a) ID ${entry.userId}`;
    const dateStr = format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const baseUrl = window.location.origin + (import.meta.env.BASE_URL ?? "/");
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Evolução Técnico — ${patientName}</title>
<style>${buildPrintDocStyles("#0f766e")}</style></head><body>
${buildInstitutionalHeader(patient ?? null, "EVOLUÇÃO — TÉCNICO(A) DE ENFERMAGEM", baseUrl)}
<p class="doc-meta"><strong>Técnico(a):</strong> ${authorName} &nbsp;|&nbsp; <strong>Turno:</strong> ${d?.turno ?? "—"} &nbsp;|&nbsp; <strong>Data/Hora do Registro:</strong> ${dateStr}</p>
${d?.procedimentos?.length ? `<div class="section"><div class="section-label">Procedimentos Realizados</div><div class="proc-grid">${d.procedimentos.map(p => `<div class="proc-item">✓ ${p}</div>`).join("")}</div></div>` : ""}
${d?.intercorrencias ? `<div class="section"><div class="section-label">Intercorrências</div><div class="section-body">${d.intercorrencias}</div></div>` : ""}
${d?.observacoes ? `<div class="section"><div class="section-label">Observações</div><div class="section-body">${d.observacoes}</div></div>` : ""}
<div class="sig-area">
  <div class="sig-line">${authorName}</div>
  <div class="sig-sub">Técnico(a) de Enfermagem</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="bg-card border border-border/50 rounded-lg p-4 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5" /> Registro do Técnico de Enfermagem
        </h4>

        {/* Turno */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Turno</label>
          <div className="flex gap-2">
            {(["Manhã", "Tarde", "Noite"] as Turno[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(f => ({ ...f, turno: t }))}
                className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                  form.turno === t
                    ? "bg-teal-600 border-teal-500 text-white"
                    : "border-border/50 text-muted-foreground hover:border-teal-500/50 hover:text-teal-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Procedimentos */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Procedimentos Realizados
            {form.procedimentos.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold">
                {form.procedimentos.length} sel.
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {PROCEDIMENTOS.map(proc => {
              const checked = form.procedimentos.includes(proc);
              return (
                <button
                  key={proc}
                  type="button"
                  onClick={() => toggleProcedimento(proc)}
                  className={`text-left text-xs px-2.5 py-1.5 rounded border transition-colors ${
                    checked
                      ? "bg-teal-600/20 border-teal-500/50 text-teal-300 font-medium"
                      : "border-border/40 text-muted-foreground hover:border-teal-500/30 hover:text-foreground"
                  }`}
                >
                  {checked ? "✓ " : ""}{proc}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Intercorrências</label>
          <Textarea
            placeholder="Descreva intercorrências ocorridas durante o turno…"
            value={form.intercorrencias}
            onChange={e => setForm(f => ({ ...f, intercorrencias: e.target.value }))}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
          <Textarea
            placeholder="Observações gerais do turno…"
            value={form.observacoes}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!isValid || addHistory.isPending}
            onClick={handleSubmit}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {addHistory.isPending ? "Salvando…" : "Salvar Rascunho"}
          </Button>
        </div>
      </div>

      {/* History */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : tecnicoHistory.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">Nenhum registro de técnico encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tecnicoHistory.map(entry => {
            const d            = entry.structuredData as TecnicoData | null;
            const isOpen       = expandedId === entry.id;
            const isInvalidado = !!entry.invalidado;
            const isFinalizado = !!entry.finalizado;
            const isAuthor     = entry.userId === userId;
            return (
              <div key={entry.id} className={`bg-card rounded-lg border overflow-hidden ${isInvalidado ? "opacity-50 border-red-500/20" : "border-teal-500/20"}`}>
                <div className={`flex items-center justify-between px-4 py-2 border-b ${isInvalidado ? "bg-red-500/5 border-red-500/10" : "bg-teal-500/5 border-teal-500/10"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ClipboardCheck className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span className="text-xs font-semibold">
                      {staffMap[entry.userId]?.name ?? `Técnico(a) ID ${entry.userId}`}
                    </span>
                    {d?.turno && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-teal-500/30 bg-teal-500/10 text-teal-300">
                        {d.turno}
                      </span>
                    )}
                    {d && d.procedimentos.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {d.procedimentos.length} procedimento{d.procedimentos.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {isInvalidado && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 font-semibold flex items-center gap-0.5">
                        <Ban className="h-2.5 w-2.5" /> Invalidado
                      </span>
                    )}
                    {!isInvalidado && !isFinalizado && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-semibold">
                        Rascunho
                      </span>
                    )}
                    {!isInvalidado && isFinalizado && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle className="h-2.5 w-2.5" /> Publicado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {isAuthor && !isFinalizado && !isInvalidado && (
                      <Button
                        size="sm" variant="outline"
                        className="h-6 text-[10px] px-2 border-green-500/30 text-green-400 hover:bg-green-500/10 gap-0.5"
                        disabled={finalizingId === entry.id}
                        onClick={() => handleFinalizar(entry)}
                      >
                        <CheckCircle className="h-2.5 w-2.5" />
                        {finalizingId === entry.id ? "…" : "Publicar"}
                      </Button>
                    )}
                    {isAuthor && !isInvalidado && (
                      <Button
                        size="sm" variant="outline"
                        className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-0.5"
                        disabled={invalidatingId === entry.id}
                        onClick={() => handleInvalidarEntry(entry)}
                      >
                        <Ban className="h-2.5 w-2.5" />
                        {invalidatingId === entry.id ? "…" : "Invalidar"}
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handlePrint(entry)}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedId(isOpen ? null : entry.id)}
                    >
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                {isInvalidado && entry.motivoInvalidacao && (
                  <div className="px-4 py-1.5 bg-red-500/5 border-b border-red-500/10">
                    <p className="text-xs text-red-400/80">Motivo: {entry.motivoInvalidacao}</p>
                  </div>
                )}
                {isOpen && d && (
                  <div className="px-4 py-3 space-y-3">
                    {d.procedimentos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80 mb-1.5">Procedimentos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {d.procedimentos.map((p, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded border border-teal-500/25 bg-teal-500/10 text-teal-300">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {d.intercorrencias && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80 mb-1">Intercorrências</p>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.intercorrencias}</p>
                      </div>
                    )}
                    {d.observacoes && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80 mb-1">Observações</p>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.observacoes}</p>
                      </div>
                    )}
                  </div>
                )}
                {!isOpen && d && (d.intercorrencias || d.observacoes) && (
                  <div className="px-4 py-2">
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {d.intercorrencias || d.observacoes}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
