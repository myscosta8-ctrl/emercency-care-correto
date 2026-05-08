import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Send, Printer, ChevronDown, ChevronUp, Ban, CheckCircle, Pencil } from "lucide-react";
import { buildInstitutionalHeader, buildPrintDocStyles, type PrintPatientInfo } from "@/lib/print-header-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface EnfermeiroData {
  avaliacaoSistemas: string;
  diagnosticoNanda: string;
  prescricaoEnfermagem: string;
  resultado: string;
  coren: string;
}

const EMPTY: EnfermeiroData = {
  avaliacaoSistemas: "",
  diagnosticoNanda: "",
  prescricaoEnfermagem: "",
  resultado: "",
  coren: "",
};

function buildSoapText(d: EnfermeiroData): string {
  const parts: string[] = [];
  if (d.avaliacaoSistemas.trim())    parts.push(`[AVALIAÇÃO POR SISTEMAS]\n${d.avaliacaoSistemas.trim()}`);
  if (d.diagnosticoNanda.trim())     parts.push(`[DIAGNÓSTICO DE ENFERMAGEM (NANDA)]\n${d.diagnosticoNanda.trim()}`);
  if (d.prescricaoEnfermagem.trim()) parts.push(`[PRESCRIÇÃO DE ENFERMAGEM]\n${d.prescricaoEnfermagem.trim()}`);
  if (d.resultado.trim())            parts.push(`[RESULTADO / EVOLUÇÃO]\n${d.resultado.trim()}`);
  if (d.coren.trim())                parts.push(`[COREN] ${d.coren.trim()}`);
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

export function EvolutionEnfermeiro({ patientId, userId, patientName, patient, staffMap }: Props) {
  const [form, setForm]                     = useState<EnfermeiroData>(EMPTY);
  const [editingId, setEditingId]           = useState<number | null>(null);
  const [expandedId, setExpandedId]         = useState<number | null>(null);
  const [finalizingId, setFinalizingId]     = useState<number | null>(null);
  const [invalidatingId, setInvalidatingId] = useState<number | null>(null);
  const [savingId, setSavingId]             = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useGetPatientHistory(patientId, {
    query: { queryKey: getGetPatientHistoryQueryKey(patientId) },
  });

  const addHistory = useAddPatientHistory();

  const enfermeiroHistory = ((history ?? []) as AugEntry[]).filter(
    e => e.professionalCategory === "enfermeiro" && e.soapText !== "Admissão inicial"
  );

  const set = (k: keyof EnfermeiroData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isValid = !!(form.avaliacaoSistemas.trim() || form.diagnosticoNanda.trim() || form.prescricaoEnfermagem.trim());

  const handleSubmit = async () => {
    const soapText = buildSoapText(form);
    if (!soapText) return;

    if (editingId !== null) {
      setSavingId(editingId);
      try {
        const resp = await fetch(`/api/patients/${patientId}/evolutions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-staff-id": String(userId) },
          body: JSON.stringify({ soapText, structuredData: form }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? "Erro ao salvar");
        }
        queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patientId) });
        setForm(EMPTY);
        setEditingId(null);
        toast({ title: "SAE atualizado com sucesso" });
      } catch (e: unknown) {
        toast({ title: e instanceof Error ? e.message : "Erro ao salvar", variant: "destructive" });
      } finally {
        setSavingId(null);
      }
      return;
    }

    addHistory.mutate(
      {
        id: patientId,
        data: {
          userId,
          soapText,
          professionalCategory: "enfermeiro",
          structuredData: form as unknown as Record<string, unknown>,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patientId) });
          setForm(EMPTY);
          toast({ title: "SAE salvo como rascunho. Publique quando estiver pronto." });
        },
        onError: () => toast({ title: "Erro ao registrar SAE", variant: "destructive" }),
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
      toast({ title: "SAE publicado com sucesso" });
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
      toast({ title: "SAE invalidado" });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Erro ao invalidar", variant: "destructive" });
    } finally {
      setInvalidatingId(null);
    }
  };

  const handleEdit = (entry: AugEntry) => {
    const d = entry.structuredData as EnfermeiroData | null;
    setForm(d ? { ...EMPTY, ...d } : EMPTY);
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrint = (entry: AugEntry) => {
    const d = entry.structuredData as EnfermeiroData | null;
    const authorName = staffMap[entry.userId]?.name ?? `Enfermeiro(a) ID ${entry.userId}`;
    const dateStr = format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const baseUrl = window.location.origin + (import.meta.env.BASE_URL ?? "/");
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>SAE — ${patientName}</title>
<style>${buildPrintDocStyles("#0d9488")}</style></head><body>
${buildInstitutionalHeader(patient ?? null, "SAE — SISTEMATIZAÇÃO DA ASSISTÊNCIA DE ENFERMAGEM", baseUrl)}
<p class="doc-meta"><strong>Enfermeiro(a):</strong> ${authorName} &nbsp;|&nbsp; <strong>Data/Hora:</strong> ${dateStr}</p>
${d?.avaliacaoSistemas ? `<div class="section"><div class="section-label">Avaliação por Sistemas</div><div class="section-body">${d.avaliacaoSistemas}</div></div>` : ""}
${d?.diagnosticoNanda ? `<div class="section"><div class="section-label">Diagnóstico de Enfermagem (NANDA)</div><div class="section-body">${d.diagnosticoNanda}</div></div>` : ""}
${d?.prescricaoEnfermagem ? `<div class="section"><div class="section-label">Prescrição de Enfermagem</div><div class="section-body">${d.prescricaoEnfermagem}</div></div>` : ""}
${d?.resultado ? `<div class="section"><div class="section-label">Resultado / Evolução</div><div class="section-body">${d.resultado}</div></div>` : ""}
<div class="sig-area">
  <div class="sig-line">${authorName}</div>
  <div class="sig-sub">Enfermeiro(a)${d?.coren ? ` — COREN: ${d.coren}` : ""}</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" />
          {editingId !== null ? "Editando SAE" : "SAE — Sistematização da Assistência de Enfermagem"}
        </h4>

        {editingId !== null && (
          <div className="text-xs text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            Editando rascunho existente — salvar irá sobrescrever o conteúdo anterior.
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Avaliação por Sistemas</label>
          <Textarea
            placeholder="Ex: Neurológico: consciente, orientado, GCS 15… Cardiovascular: FC 88, rítmico…"
            value={form.avaliacaoSistemas}
            onChange={set("avaliacaoSistemas")}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Diagnóstico de Enfermagem (NANDA) *</label>
          <Textarea
            placeholder="Ex: Dor aguda relacionada a agente lesivo físico evidenciada por relato verbal…"
            value={form.diagnosticoNanda}
            onChange={set("diagnosticoNanda")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Prescrição de Enfermagem *</label>
          <Textarea
            placeholder="Ex: Monitorizar sinais vitais a cada 2h, administrar medicação conforme prescrição médica…"
            value={form.prescricaoEnfermagem}
            onChange={set("prescricaoEnfermagem")}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Resultado / Evolução</label>
          <Textarea
            placeholder="Descreva os resultados esperados e a evolução do paciente…"
            value={form.resultado}
            onChange={set("resultado")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 max-w-xs">
            <label className="text-xs text-muted-foreground mb-1 block">COREN</label>
            <Input
              placeholder="Número do COREN"
              value={form.coren}
              onChange={set("coren")}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2 self-end">
            {editingId !== null && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setForm(EMPTY); setEditingId(null); }}
                className="gap-1.5"
              >
                Cancelar
              </Button>
            )}
            <Button
              size="sm"
              disabled={!isValid || addHistory.isPending || savingId !== null}
              onClick={handleSubmit}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {addHistory.isPending || savingId !== null
                ? "Salvando…"
                : editingId !== null
                ? "Atualizar Rascunho"
                : "Salvar Rascunho"}
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : enfermeiroHistory.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">Nenhum SAE registrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enfermeiroHistory.map(entry => {
            const d            = entry.structuredData as EnfermeiroData | null;
            const isOpen       = expandedId === entry.id;
            const isInvalidado = !!entry.invalidado;
            const isFinalizado = !!entry.finalizado;
            const isAuthor     = entry.userId === userId;
            return (
              <div key={entry.id} className={`bg-card rounded-lg border overflow-hidden ${isInvalidado ? "opacity-50 border-red-500/20" : "border-teal-500/20"}`}>
                <div className={`flex items-center justify-between px-4 py-2 border-b ${isInvalidado ? "bg-red-500/5 border-red-500/10" : "bg-teal-500/5 border-teal-500/10"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ClipboardList className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span className="text-xs font-semibold">
                      {staffMap[entry.userId]?.name ?? `Profissional ID ${entry.userId}`}
                    </span>
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
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {isAuthor && !isFinalizado && !isInvalidado && (
                      <Button
                        size="sm" variant="outline"
                        className="h-6 text-[10px] px-2 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 gap-0.5"
                        onClick={() => handleEdit(entry)}
                      >
                        <Pencil className="h-2.5 w-2.5" /> Editar
                      </Button>
                    )}
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
                <div className="px-4 py-3 space-y-2">
                  {d?.diagnosticoNanda && (
                    <p className="text-xs font-medium text-foreground/90 line-clamp-2">{d.diagnosticoNanda}</p>
                  )}
                  {isOpen && d && (
                    <div className="space-y-3 pt-2 border-t border-border/30">
                      {d.avaliacaoSistemas && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80 mb-1">Avaliação por Sistemas</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.avaliacaoSistemas}</p>
                        </div>
                      )}
                      {d.prescricaoEnfermagem && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80 mb-1">Prescrição de Enfermagem</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.prescricaoEnfermagem}</p>
                        </div>
                      )}
                      {d.resultado && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80 mb-1">Resultado</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.resultado}</p>
                        </div>
                      )}
                      {d.coren && (
                        <p className="text-[10px] text-muted-foreground/60">COREN: {d.coren}</p>
                      )}
                    </div>
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
