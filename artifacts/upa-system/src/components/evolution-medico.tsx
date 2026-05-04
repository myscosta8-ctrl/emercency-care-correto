import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Stethoscope, Send, Printer, ChevronDown, ChevronUp } from "lucide-react";
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

export function EvolutionMedico({ patientId, userId, patientName, staffMap }: Props) {
  const [form, setForm] = useState<MedicoData>(EMPTY);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useGetPatientHistory(patientId, {
    query: { queryKey: getGetPatientHistoryQueryKey(patientId) },
  });

  const addHistory = useAddPatientHistory();

  const medicoHistory = (history ?? []).filter(
    e => e.professionalCategory === "medico" && e.soapText !== "Admissão inicial"
  );

  const set = (k: keyof MedicoData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isValid = form.hda.trim() || form.conduta.trim() || form.hipoteseDiagnostica.trim();

  const handleSubmit = () => {
    const soapText = buildSoapText(form);
    if (!soapText) return;
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
          setForm(EMPTY);
          toast({ title: "Evolução médica registrada com sucesso" });
        },
        onError: () => toast({ title: "Erro ao registrar evolução", variant: "destructive" }),
      }
    );
  };

  const handlePrint = (entry: (typeof medicoHistory)[number]) => {
    const d = entry.structuredData as MedicoData | null;
    const authorName = staffMap[entry.userId]?.name ?? `Médico ID ${entry.userId}`;
    const dateStr = format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Evolução Médica — ${patientName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 24px 32px; margin: 0; }
  h1 { font-size: 15pt; margin: 0 0 2px; }
  .subtitle { font-size: 9pt; color: #555; margin: 0 0 12px; }
  .header-bar { background: #1e3a8a; color: white; padding: 10px 16px; border-radius: 4px 4px 0 0; margin-bottom: 0; }
  .patient-bar { background: #f1f5f9; border: 1px solid #cbd5e1; border-top: none; padding: 8px 16px; margin-bottom: 16px; font-size: 10pt; }
  .section { margin-bottom: 14px; }
  .section-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1e3a8a; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 2px; margin-bottom: 6px; }
  .section-body { white-space: pre-wrap; line-height: 1.6; min-height: 20px; }
  .inline-row { display: flex; gap: 32px; }
  .inline-row .section { flex: 1; }
  .sig-area { margin-top: 40px; text-align: center; }
  .sig-line { border-top: 1.5px solid #111; width: 60%; margin: 0 auto 4px; padding-top: 4px; font-size: 10pt; }
  .sig-sub { font-size: 9pt; color: #555; }
  @media print { @page { size: A4; margin: 12mm; } }
</style></head><body>
<div class="header-bar"><h1>UPA 24H — BREVES</h1><div class="subtitle">EVOLUÇÃO MÉDICA</div></div>
<div class="patient-bar">
  <strong>Paciente:</strong> ${patientName} &nbsp;|&nbsp;
  <strong>Data/Hora:</strong> ${dateStr} &nbsp;|&nbsp;
  <strong>Médico:</strong> ${authorName}
</div>

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
      {/* Form */}
      <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5" /> Nova Evolução Médica
        </h4>

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
          <Button
            size="sm"
            disabled={!isValid || addHistory.isPending}
            onClick={handleSubmit}
            className="gap-1.5 self-end"
          >
            <Send className="h-3.5 w-3.5" />
            {addHistory.isPending ? "Salvando…" : "Registrar Evolução"}
          </Button>
        </div>
      </div>

      {/* History */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : medicoHistory.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">Nenhuma evolução médica registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {medicoHistory.map(entry => {
            const d = entry.structuredData as MedicoData | null;
            const isOpen = expandedId === entry.id;
            return (
              <div key={entry.id} className="bg-card rounded-lg border border-blue-500/20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-blue-500/5 border-b border-blue-500/10">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold">
                      {staffMap[entry.userId]?.name ?? `Médico ID ${entry.userId}`}
                    </span>
                    {d?.cid10 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 font-mono">
                        {d.cid10}
                      </span>
                    )}
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
