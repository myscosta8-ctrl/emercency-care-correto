import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Send, Printer, ChevronDown, ChevronUp } from "lucide-react";
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

export function EvolutionEnfermeiro({ patientId, userId, patientName, staffMap }: Props) {
  const [form, setForm] = useState<EnfermeiroData>(EMPTY);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useGetPatientHistory(patientId, {
    query: { queryKey: getGetPatientHistoryQueryKey(patientId) },
  });

  const addHistory = useAddPatientHistory();

  const enfermeiroHistory = (history ?? []).filter(
    e => e.professionalCategory === "enfermeiro" && e.soapText !== "Admissão inicial"
  );

  const set = (k: keyof EnfermeiroData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isValid = form.avaliacaoSistemas.trim() || form.diagnosticoNanda.trim() || form.prescricaoEnfermagem.trim();

  const handleSubmit = () => {
    const soapText = buildSoapText(form);
    if (!soapText) return;
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
          toast({ title: "SAE registrada com sucesso" });
        },
        onError: () => toast({ title: "Erro ao registrar evolução", variant: "destructive" }),
      }
    );
  };

  const handlePrint = (entry: (typeof enfermeiroHistory)[number]) => {
    const d = entry.structuredData as EnfermeiroData | null;
    const authorName = staffMap[entry.userId]?.name ?? `Enfermeiro(a) ID ${entry.userId}`;
    const dateStr = format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>SAE — ${patientName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 24px 32px; margin: 0; }
  .header-bar { background: #1d4ed8; color: white; padding: 10px 16px; border-radius: 4px 4px 0 0; }
  .header-bar h1 { font-size: 15pt; margin: 0 0 2px; }
  .header-bar .sub { font-size: 9pt; opacity: .85; }
  .patient-bar { background: #f1f5f9; border: 1px solid #cbd5e1; border-top: none; padding: 8px 16px; margin-bottom: 16px; font-size: 10pt; }
  .section { margin-bottom: 14px; }
  .section-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1d4ed8; border-bottom: 1.5px solid #1d4ed8; padding-bottom: 2px; margin-bottom: 6px; }
  .section-body { white-space: pre-wrap; line-height: 1.6; }
  .sig-area { margin-top: 40px; text-align: center; }
  .sig-line { border-top: 1.5px solid #111; width: 60%; margin: 0 auto 4px; padding-top: 4px; font-size: 10pt; }
  .sig-sub { font-size: 9pt; color: #555; }
  @media print { @page { size: A4; margin: 12mm; } }
</style></head><body>
<div class="header-bar"><h1>UPA 24H — BREVES</h1><div class="sub">SISTEMATIZAÇÃO DA ASSISTÊNCIA DE ENFERMAGEM (SAE)</div></div>
<div class="patient-bar">
  <strong>Paciente:</strong> ${patientName} &nbsp;|&nbsp;
  <strong>Data/Hora:</strong> ${dateStr} &nbsp;|&nbsp;
  <strong>Enfermeiro(a):</strong> ${authorName}
</div>
${d?.avaliacaoSistemas ? `<div class="section"><div class="section-label">Avaliação de Enfermagem por Sistemas</div><div class="section-body">${d.avaliacaoSistemas}</div></div>` : ""}
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
      {/* Form */}
      <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> SAE — Sistematização da Assistência de Enfermagem
        </h4>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Avaliação por Sistemas *</label>
          <Textarea
            placeholder="Ex: Neurológico: consciente e orientado… Respiratório: murmúrio vesicular presente bilateralmente…"
            value={form.avaliacaoSistemas}
            onChange={set("avaliacaoSistemas")}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Diagnóstico de Enfermagem (NANDA) *</label>
          <Textarea
            placeholder="Ex: Padrão respiratório ineficaz R/C broncoespasmo M/E dispneia e uso de musculatura acessória…"
            value={form.diagnosticoNanda}
            onChange={set("diagnosticoNanda")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Prescrição de Enfermagem *</label>
          <Textarea
            placeholder="Ex: 1. Monitorar saturação de O₂ de 4/4h. 2. Manter cabeceira elevada a 30°…"
            value={form.prescricaoEnfermagem}
            onChange={set("prescricaoEnfermagem")}
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Resultado / Evolução do Cuidado</label>
          <Textarea
            placeholder="Descreva a resposta do paciente às intervenções…"
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
          <Button
            size="sm"
            disabled={!isValid || addHistory.isPending}
            onClick={handleSubmit}
            className="gap-1.5 self-end"
          >
            <Send className="h-3.5 w-3.5" />
            {addHistory.isPending ? "Salvando…" : "Registrar SAE"}
          </Button>
        </div>
      </div>

      {/* History */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : enfermeiroHistory.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">Nenhuma SAE registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enfermeiroHistory.map(entry => {
            const d = entry.structuredData as EnfermeiroData | null;
            const isOpen = expandedId === entry.id;
            return (
              <div key={entry.id} className="bg-card rounded-lg border border-blue-500/20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-blue-500/5 border-b border-blue-500/10">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold">
                      {staffMap[entry.userId]?.name ?? `Enfermeiro(a) ID ${entry.userId}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
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
