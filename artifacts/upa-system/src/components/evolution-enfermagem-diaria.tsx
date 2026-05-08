import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Send, Printer, ChevronDown, ChevronUp, Ban, CheckCircle, Pencil, Zap } from "lucide-react";
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
  useGetPatientDevices,
  getGetPatientHistoryQueryKey,
} from "@workspace/api-client-react";
import type { PatientDevice } from "@workspace/api-client-react";

interface Props {
  patientId: number;
  userId: number;
  patientName: string;
  patient?: PrintPatientInfo | null;
  staffMap: Record<number, { name: string; role?: string }>;
}

interface DiariaData {
  descricao: string;
  intercorrencias: string;
  procedimentos: string;
  dispositivos: string;
  orientacoes: string;
  coren: string;
}

const EMPTY: DiariaData = {
  descricao: "",
  intercorrencias: "",
  procedimentos: "",
  dispositivos: "",
  orientacoes: "",
  coren: "",
};

const DEVICE_LABELS: Record<string, string> = {
  acesso_venoso_periferico: "AVP",
  acesso_venoso_central:    "AVC",
  sonda_nasoenteral:        "SNE",
  sonda_nasogastrica:       "SNG",
  sonda_vesical_demora:     "SVD",
  cateter_arterial:         "Cateter Arterial",
  dreno_torax:              "Dreno de Tórax",
  traqueostomia:            "Traqueostomia",
  gastrostomia:             "Gastrostomia",
  cateter_duplo_lumen:      "Cateter Duplo Lúmen",
  dissecao_vascular:        "Dissecção Vascular",
  outro:                    "Outro",
};

const PROF_CAT_LABELS: Record<string, string> = {
  evolucao_enfermagem: "Enfermeiro(a)",
  anotacao_enfermagem: "Enfermeiro(a)",
  enfermeiro:          "Enfermeiro(a)",
  tecnico_enfermagem:  "Técnico de Enfermagem",
  medico:              "Médico(a)",
  nutricionista:       "Nutricionista",
  servico_social:      "Serviço Social",
};

function buildText(d: DiariaData): string {
  const parts: string[] = [];
  if (d.descricao.trim())       parts.push(`[EVOLUÇÃO]\n${d.descricao.trim()}`);
  if (d.intercorrencias.trim()) parts.push(`[INTERCORRÊNCIAS]\n${d.intercorrencias.trim()}`);
  if (d.procedimentos.trim())   parts.push(`[PROCEDIMENTOS REALIZADOS]\n${d.procedimentos.trim()}`);
  if (d.dispositivos.trim())    parts.push(`[DISPOSITIVOS DO PACIENTE]\n${d.dispositivos.trim()}`);
  if (d.orientacoes.trim())     parts.push(`[ORIENTAÇÕES]\n${d.orientacoes.trim()}`);
  if (d.coren.trim())           parts.push(`[COREN] ${d.coren.trim()}`);
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

function fmtDeviceDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}` : "";
}

export function EvolutionEnfermagemDiaria({ patientId, userId, patientName, patient, staffMap }: Props) {
  const [form, setForm]                 = useState<DiariaData>(EMPTY);
  const [editingId, setEditingId]       = useState<number | null>(null);
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [finalizingId, setFinalizingId] = useState<number | null>(null);
  const [invalidatingId, setInvalidatingId] = useState<number | null>(null);
  const [savingId, setSavingId]         = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useGetPatientHistory(patientId, {
    query: { queryKey: getGetPatientHistoryQueryKey(patientId) },
  });

  const { data: activeDevices } = useGetPatientDevices(patientId, { active: true });

  const addHistory = useAddPatientHistory();

  const diariaHistory = ((history ?? []) as AugEntry[]).filter(
    e => e.professionalCategory === "evolucao_enfermagem" || e.professionalCategory === "anotacao_enfermagem"
  );

  const set = (k: keyof DiariaData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isValid = !!(form.descricao.trim() || form.intercorrencias.trim() || form.procedimentos.trim());

  const handlePreencherDispositivos = () => {
    if (!activeDevices || activeDevices.length === 0) return;
    const lines = (activeDevices as PatientDevice[]).map(dev => {
      const label = DEVICE_LABELS[dev.deviceType] ?? dev.deviceType;
      const site  = dev.insertionSite ? ` — ${dev.insertionSite}` : "";
      const date  = dev.insertionDate ? ` (desde ${fmtDeviceDate(dev.insertionDate)})` : "";
      return `• ${label}${site}${date}`;
    });
    setForm(f => ({ ...f, dispositivos: lines.join("\n") }));
  };

  const handleSubmit = async () => {
    const soapText = buildText(form);
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
          professionalCategory: "evolucao_enfermagem",
          structuredData: form as unknown as Record<string, unknown>,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patientId) });
          setForm(EMPTY);
          toast({ title: "Evolução salva como rascunho. Publique quando estiver pronto." });
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

  const handleEdit = (entry: AugEntry) => {
    const d = entry.structuredData as DiariaData | null;
    setForm(d ? { ...EMPTY, ...d } : EMPTY);
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleInvalidar = async (entry: AugEntry) => {
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

  const handlePrint = (entry: AugEntry) => {
    const d = entry.structuredData as DiariaData | null;
    const authorName = staffMap[entry.userId]?.name ?? `Profissional ID ${entry.userId}`;
    const profLabel = PROF_CAT_LABELS[entry.professionalCategory ?? ""] ?? "Enfermeiro(a)";
    const dateStr = format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const baseUrl = window.location.origin + (import.meta.env.BASE_URL ?? "/");
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Evolução de Enfermagem — ${patientName}</title>
<style>${buildPrintDocStyles("#0d9488")}</style></head><body>
${buildInstitutionalHeader(patient ?? null, "EVOLUÇÃO DE ENFERMAGEM", baseUrl)}
<p class="doc-meta"><strong>${profLabel}:</strong> ${authorName} &nbsp;|&nbsp; <strong>Data/Hora:</strong> ${dateStr}</p>
${d?.descricao ? `<div class="section"><div class="section-label">Evolução</div><div class="section-body">${d.descricao}</div></div>` : ""}
${d?.intercorrencias ? `<div class="section"><div class="section-label">Intercorrências</div><div class="section-body">${d.intercorrencias}</div></div>` : ""}
${d?.procedimentos ? `<div class="section"><div class="section-label">Procedimentos Realizados</div><div class="section-body">${d.procedimentos}</div></div>` : ""}
${d?.dispositivos ? `<div class="section"><div class="section-label">Dispositivos do Paciente</div><div class="section-body">${d.dispositivos}</div></div>` : ""}
${d?.orientacoes ? `<div class="section"><div class="section-label">Orientações ao Paciente/Família</div><div class="section-body">${d.orientacoes}</div></div>` : ""}
<div class="sig-area">
  <div class="sig-line">${authorName}</div>
  <div class="sig-sub">${profLabel}${d?.coren ? ` — COREN: ${d.coren}` : ""}</div>
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
          {editingId !== null ? "Editando Evolução de Enfermagem" : "Nova Evolução de Enfermagem"}
        </h4>

        {editingId !== null && (
          <div className="text-xs text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            Editando rascunho existente — salvar irá sobrescrever o conteúdo anterior.
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Evolução *</label>
          <Textarea
            placeholder="Descreva o estado atual do paciente, avaliação geral e evolução do quadro clínico…"
            value={form.descricao}
            onChange={set("descricao")}
            rows={4}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Intercorrências</label>
          <Textarea
            placeholder="Registre intercorrências ocorridas durante o plantão…"
            value={form.intercorrencias}
            onChange={set("intercorrencias")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Procedimentos Realizados</label>
          <Textarea
            placeholder="Ex: Curativo realizado, AVP instalado, medicação administrada conforme prescrição…"
            value={form.procedimentos}
            onChange={set("procedimentos")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        {/* Dispositivos do Paciente */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Dispositivos do Paciente</label>
            {activeDevices && activeDevices.length > 0 && (
              <Button
                type="button" size="sm" variant="ghost"
                className="h-5 text-[10px] px-2 gap-0.5 text-amber-400 hover:text-amber-300"
                onClick={handlePreencherDispositivos}
              >
                <Zap className="h-2.5 w-2.5" /> Inserir ativos
              </Button>
            )}
          </div>
          {activeDevices && activeDevices.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(activeDevices as PatientDevice[]).map(dev => (
                <span key={dev.id} className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  {DEVICE_LABELS[dev.deviceType] ?? dev.deviceType}
                  {dev.insertionSite ? ` — ${dev.insertionSite}` : ""}
                </span>
              ))}
            </div>
          )}
          <Textarea
            placeholder="Registre dispositivos: sondas, cateteres, drenos, AVP, AVC — localização, condição, datas de troca…"
            value={form.dispositivos}
            onChange={set("dispositivos")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Orientações ao Paciente/Família</label>
          <Textarea
            placeholder="Orientações fornecidas ao paciente ou familiares…"
            value={form.orientacoes}
            onChange={set("orientacoes")}
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
                size="sm" variant="outline"
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
      ) : diariaHistory.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">Nenhuma evolução de enfermagem registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {diariaHistory.map(entry => {
            const d            = entry.structuredData as DiariaData | null;
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
                        onClick={() => handleInvalidar(entry)}
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
                  {d?.descricao && (
                    <p className="text-xs text-foreground/80 line-clamp-2">{d.descricao}</p>
                  )}
                  {isOpen && d && (
                    <div className="space-y-3 pt-2 border-t border-border/30">
                      {d.descricao && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80 mb-1">Evolução</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.descricao}</p>
                        </div>
                      )}
                      {d.intercorrencias && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80 mb-1">Intercorrências</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.intercorrencias}</p>
                        </div>
                      )}
                      {d.procedimentos && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80 mb-1">Procedimentos Realizados</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.procedimentos}</p>
                        </div>
                      )}
                      {d.dispositivos && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 mb-1">Dispositivos do Paciente</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.dispositivos}</p>
                        </div>
                      )}
                      {d.orientacoes && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80 mb-1">Orientações</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.orientacoes}</p>
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
