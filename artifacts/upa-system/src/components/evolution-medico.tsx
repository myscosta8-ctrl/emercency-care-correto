import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Stethoscope, Send, Printer, ChevronDown, ChevronUp, Ban, CheckCircle, Pencil } from "lucide-react";
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

interface LatestVitals {
  bp?: string | null;
  hr?: number | null;
  rr?: number | null;
  spo2?: number | null;
  temp?: number | null;
  glucose?: number | null;
}

interface Props {
  patientId: number;
  userId: number;
  patientName: string;
  patient?: PrintPatientInfo | null;
  staffMap: Record<number, { name: string }>;
  latestVitals?: LatestVitals | null;
  staffCorenCrm?: string;
  onAfterSave?: () => void;
  canEdit?: boolean;
}

interface MedicoData {
  hda: string;
  exameFisico: string;
  hipoteseDiagnostica: string;
  cid10: string;
  conduta: string;
  crm: string;
}

const EMPTY: MedicoData = {
  hda: "",
  exameFisico: "",
  hipoteseDiagnostica: "",
  cid10: "",
  conduta: "",
  crm: "",
};

function buildSoapText(d: MedicoData): string {
  const parts: string[] = [];
  if (d.hda.trim())                 parts.push(`[HDA]\n${d.hda.trim()}`);
  if (d.exameFisico.trim())         parts.push(`[EXAME FÍSICO]\n${d.exameFisico.trim()}`);
  if (d.hipoteseDiagnostica.trim()) parts.push(`[HIPÓTESE DIAGNÓSTICA]\n${d.hipoteseDiagnostica.trim()}`);
  if (d.cid10.trim())               parts.push(`[CID-10] ${d.cid10.trim()}`);
  if (d.conduta.trim())             parts.push(`[CONDUTA]\n${d.conduta.trim()}`);
  if (d.crm.trim())                 parts.push(`[CRM] ${d.crm.trim()}`);
  return parts.join("\n\n");
}

function buildVitaisText(v: LatestVitals): string {
  const parts: string[] = [];
  if (v.bp)                         parts.push(`PA: ${v.bp} mmHg`);
  if ((v.hr ?? 0) > 0)              parts.push(`FC: ${v.hr} bpm`);
  if ((v.rr ?? 0) > 0)              parts.push(`FR: ${v.rr} irpm`);
  if ((v.spo2 ?? 0) > 0)           parts.push(`SpO₂: ${v.spo2}%`);
  if ((v.temp ?? 0) > 0)           parts.push(`Temp: ${v.temp}°C`);
  if ((v.glucose ?? 0) > 0)        parts.push(`HGT: ${v.glucose} mg/dL`);
  return parts.join(" | ");
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

export function EvolutionMedico({ patientId, userId, patientName, patient, staffMap, latestVitals, staffCorenCrm = "", onAfterSave, canEdit = true }: Props) {
  const emptyForm = (): MedicoData => ({ ...EMPTY, crm: staffCorenCrm });
  const [form, setForm]                     = useState<MedicoData>(emptyForm);
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

  const medicoHistory = ((history ?? []) as AugEntry[]).filter(
    e => e.professionalCategory === "medico" && e.soapText !== "Admissão inicial"
  );

  const set = (k: keyof MedicoData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isValid = !!(form.hda.trim() || form.conduta.trim() || form.hipoteseDiagnostica.trim());

  const handlePreencherVitais = () => {
    if (!latestVitals) return;
    const txt = buildVitaisText(latestVitals);
    if (!txt) return;
    setForm(f => ({
      ...f,
      exameFisico: f.exameFisico ? `${f.exameFisico}\n\nSinais Vitais: ${txt}` : `Sinais Vitais: ${txt}`,
    }));
  };

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
        setForm(emptyForm());
        setEditingId(null);
        toast({ title: "Evolução atualizada com sucesso" });
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
          professionalCategory: "medico",
          structuredData: form as unknown as Record<string, unknown>,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patientId) });
          setForm(emptyForm());
          toast({ title: "Evolução médica salva como rascunho. Publique quando estiver pronto." });
          onAfterSave?.();
        },
        onError: () => toast({ title: "Erro ao registrar evolução", variant: "destructive" }),
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
      toast({ title: "Evolução publicada com sucesso" });
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
      toast({ title: "Evolução invalidada" });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Erro ao invalidar", variant: "destructive" });
    } finally {
      setInvalidatingId(null);
    }
  };

  const handleEdit = (entry: AugEntry) => {
    const d = entry.structuredData as MedicoData | null;
    setForm(d ? { ...emptyForm(), ...d } : emptyForm());
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrint = (entry: AugEntry) => {
    const d = entry.structuredData as MedicoData | null;
    const authorName = staffMap[entry.userId]?.name ?? `Médico ID ${entry.userId}`;
    const dateStr = format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const baseUrl = window.location.origin + (import.meta.env.BASE_URL ?? "/");

    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Evolução Médica — ${patientName}</title>
<style>${buildPrintDocStyles("#1e3a8a")}</style></head><body>
${buildInstitutionalHeader(patient ?? null, "EVOLUÇÃO MÉDICA", baseUrl)}
<p class="doc-meta"><strong>Médico:</strong> ${authorName} &nbsp;|&nbsp; <strong>Data/Hora do Registro:</strong> ${dateStr}</p>

${d?.hda ? `<div class="section"><div class="section-label">História da Doença Atual (HDA)</div><div class="section-body">${d.hda}</div></div>` : ""}
${d?.exameFisico ? `<div class="section"><div class="section-label">Exame Físico</div><div class="section-body">${d.exameFisico}</div></div>` : ""}
<div class="inline-row">
  ${d?.hipoteseDiagnostica ? `<div class="section"><div class="section-label">Hipótese Diagnóstica</div><div class="section-body">${d.hipoteseDiagnostica}</div></div>` : ""}
  ${d?.cid10 ? `<div class="section" style="max-width:140px"><div class="section-label">CID-10</div><div class="section-body">${d.cid10}</div></div>` : ""}
</div>
${d?.conduta ? `<div class="section"><div class="section-label">Conduta</div><div class="section-body">${d.conduta}</div></div>` : ""}

<div class="sig-area">
  <div class="sig-line">${authorName}</div>
  <div class="sig-sub">Médico${d?.crm ? ` — CRM: ${d.crm}` : ""}</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      {canEdit && <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" />
            {editingId !== null ? "Editando Evolução Médica" : "Nova Evolução Médica"}
          </h4>
          {latestVitals && editingId === null && (
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] px-2 gap-1 border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
              onClick={handlePreencherVitais}
              title="Inserir últimos sinais vitais no campo de Exame Físico"
            >
              Inserir SVs recentes
            </Button>
          )}
        </div>

        {editingId !== null && (
          <div className="text-xs text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            Editando rascunho existente — salvar irá sobrescrever o conteúdo anterior.
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">HDA — História da Doença Atual *</label>
          <Textarea
            placeholder="Descreva a queixa principal e história da doença atual…"
            value={form.hda}
            onChange={set("hda")}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Exame Físico (por sistemas)</label>
          <Textarea
            placeholder="Ex: Neurológico: consciente, orientado… Cardiovascular: RCR, 2T, sem sopros…"
            value={form.exameFisico}
            onChange={set("exameFisico")}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Hipótese Diagnóstica *</label>
            <Input
              placeholder="Ex: Pneumonia bacteriana adquirida na comunidade"
              value={form.hipoteseDiagnostica}
              onChange={set("hipoteseDiagnostica")}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">CID-10</label>
            <Input
              placeholder="Ex: J18.9"
              value={form.cid10}
              onChange={set("cid10")}
              className="text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Conduta *</label>
          <Textarea
            placeholder="Descreva a conduta médica…"
            value={form.conduta}
            onChange={set("conduta")}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 max-w-xs">
            <label className="text-xs text-muted-foreground mb-1 block">CRM</label>
            <Input
              placeholder="Número do CRM"
              value={form.crm}
              onChange={set("crm")}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2 self-end">
            {editingId !== null && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setForm(emptyForm()); setEditingId(null); }}
                className="gap-1.5"
              >
                Cancelar
              </Button>
            )}
            <Button
              size="sm"
              disabled={!isValid || addHistory.isPending || savingId !== null}
              onClick={handleSubmit}
              className="gap-1.5 self-end"
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
      </div>}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : medicoHistory.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">Nenhuma evolução médica registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {medicoHistory.map(entry => {
            const d            = entry.structuredData as MedicoData | null;
            const isOpen       = expandedId === entry.id;
            const isInvalidado = !!entry.invalidado;
            const isFinalizado = !!entry.finalizado;
            const isAuthor     = entry.userId === userId;
            return (
              <div key={entry.id} className={`bg-card rounded-lg border overflow-hidden ${isInvalidado ? "opacity-50 border-red-500/20" : "border-blue-500/20"}`}>
                <div className={`flex items-center justify-between px-4 py-2 border-b ${isInvalidado ? "bg-red-500/5 border-red-500/10" : "bg-blue-500/5 border-blue-500/10"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Stethoscope className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold">
                      {staffMap[entry.userId]?.name ?? `Médico ID ${entry.userId}`}
                    </span>
                    {d?.cid10 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 font-mono">
                        {d.cid10}
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
                  {d?.hipoteseDiagnostica && (
                    <p className="text-sm font-medium text-foreground/90">{d.hipoteseDiagnostica}</p>
                  )}
                  {isOpen && d && (
                    <div className="space-y-3 pt-2 border-t border-border/30">
                      {d.hda && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80 mb-1">HDA</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.hda}</p>
                        </div>
                      )}
                      {d.exameFisico && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80 mb-1">Exame Físico</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.exameFisico}</p>
                        </div>
                      )}
                      {d.conduta && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80 mb-1">Conduta</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.conduta}</p>
                        </div>
                      )}
                      {d.crm && (
                        <p className="text-[10px] text-muted-foreground/60">CRM: {d.crm}</p>
                      )}
                    </div>
                  )}
                  {!isOpen && d?.conduta && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{d.conduta}</p>
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
