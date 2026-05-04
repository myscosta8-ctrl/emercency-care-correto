import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Send, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddPatientSocialNote,
  useGetPatientSocialNotes,
  getGetPatientSocialNotesQueryKey,
} from "@workspace/api-client-react";

interface Props {
  patientId: number;
  userId: number;
  patientName: string;
  staffMap: Record<number, { name: string }>;
}

interface SocialData {
  moradia: string;
  rendaFamiliar: string;
  composicaoFamiliar: string;
  demandas: string;
  intervencoes: string;
  encaminhamentos: string;
  cress: string;
}

const EMPTY: SocialData = {
  moradia: "",
  rendaFamiliar: "",
  composicaoFamiliar: "",
  demandas: "",
  intervencoes: "",
  encaminhamentos: "",
  cress: "",
};

function buildContent(d: SocialData): string {
  const parts: string[] = [];
  if (d.moradia)           parts.push(`[MORADIA] ${d.moradia}`);
  if (d.rendaFamiliar)     parts.push(`[RENDA FAMILIAR] ${d.rendaFamiliar}`);
  if (d.composicaoFamiliar.trim()) parts.push(`[COMPOSIÇÃO FAMILIAR]\n${d.composicaoFamiliar.trim()}`);
  if (d.demandas.trim())   parts.push(`[DEMANDAS IDENTIFICADAS]\n${d.demandas.trim()}`);
  if (d.intervencoes.trim()) parts.push(`[INTERVENÇÕES REALIZADAS]\n${d.intervencoes.trim()}`);
  if (d.encaminhamentos.trim()) parts.push(`[ENCAMINHAMENTOS]\n${d.encaminhamentos.trim()}`);
  if (d.cress.trim())      parts.push(`[CRESS] ${d.cress.trim()}`);
  return parts.join("\n\n");
}

export function EvolutionSocial({ patientId, userId, patientName, staffMap }: Props) {
  const [form, setForm] = useState<SocialData>(EMPTY);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useGetPatientSocialNotes(patientId, {
    query: { queryKey: getGetPatientSocialNotesQueryKey(patientId) },
  });

  const addNote = useAddPatientSocialNote();

  const set = (k: keyof SocialData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const setSelect = (k: keyof SocialData) => (v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const isValid = form.demandas.trim() || form.intervencoes.trim() || form.encaminhamentos.trim();

  const handleSubmit = () => {
    const content = buildContent(form);
    if (!content) return;
    addNote.mutate(
      {
        id: patientId,
        data: {
          userId,
          content,
          structuredData: form as unknown as Record<string, unknown>,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientSocialNotesQueryKey(patientId) });
          setForm(EMPTY);
          toast({ title: "Nota social registrada com sucesso" });
        },
        onError: () => toast({ title: "Erro ao registrar nota", variant: "destructive" }),
      }
    );
  };

  const handlePrint = (note: NonNullable<typeof notes>[number]) => {
    const d = note.structuredData as SocialData | null;
    const authorName = staffMap[note.userId]?.name ?? `Assistente Social ID ${note.userId}`;
    const dateStr = format(new Date(note.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Nota Social — ${patientName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 24px 32px; margin: 0; }
  .header-bar { background: #7c3aed; color: white; padding: 10px 16px; border-radius: 4px 4px 0 0; }
  .header-bar h1 { font-size: 15pt; margin: 0 0 2px; }
  .header-bar .sub { font-size: 9pt; opacity: .85; }
  .patient-bar { background: #faf5ff; border: 1px solid #c4b5fd; border-top: none; padding: 8px 16px; margin-bottom: 16px; font-size: 10pt; }
  .section { margin-bottom: 14px; }
  .section-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #7c3aed; border-bottom: 1.5px solid #7c3aed; padding-bottom: 2px; margin-bottom: 6px; }
  .section-body { white-space: pre-wrap; line-height: 1.6; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sig-area { margin-top: 40px; text-align: center; }
  .sig-line { border-top: 1.5px solid #111; width: 60%; margin: 0 auto 4px; padding-top: 4px; font-size: 10pt; }
  .sig-sub { font-size: 9pt; color: #555; }
  @media print { @page { size: A4; margin: 12mm; } }
</style></head><body>
<div class="header-bar"><h1>UPA 24H — BREVES</h1><div class="sub">NOTA DE SERVIÇO SOCIAL</div></div>
<div class="patient-bar">
  <strong>Paciente:</strong> ${patientName} &nbsp;|&nbsp;
  <strong>Data/Hora:</strong> ${dateStr} &nbsp;|&nbsp;
  <strong>Assistente Social:</strong> ${authorName}
</div>
<div class="two-col">
  ${d?.moradia ? `<div class="section"><div class="section-label">Situação de Moradia</div><div class="section-body">${d.moradia}</div></div>` : ""}
  ${d?.rendaFamiliar ? `<div class="section"><div class="section-label">Renda Familiar</div><div class="section-body">${d.rendaFamiliar}</div></div>` : ""}
</div>
${d?.composicaoFamiliar ? `<div class="section"><div class="section-label">Composição Familiar</div><div class="section-body">${d.composicaoFamiliar}</div></div>` : ""}
${d?.demandas ? `<div class="section"><div class="section-label">Demandas Identificadas</div><div class="section-body">${d.demandas}</div></div>` : ""}
${d?.intervencoes ? `<div class="section"><div class="section-label">Intervenções Realizadas</div><div class="section-body">${d.intervencoes}</div></div>` : ""}
${d?.encaminhamentos ? `<div class="section"><div class="section-label">Encaminhamentos</div><div class="section-body">${d.encaminhamentos}</div></div>` : ""}
<div class="sig-area">
  <div class="sig-line">${authorName}</div>
  <div class="sig-sub">Assistente Social${d?.cress ? ` — CRESS: ${d.cress}` : ""}</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> Nova Nota de Serviço Social
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Situação de Moradia</label>
            <Select value={form.moradia} onValueChange={setSelect("moradia")}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Própria">Própria</SelectItem>
                <SelectItem value="Alugada">Alugada</SelectItem>
                <SelectItem value="Cedida">Cedida</SelectItem>
                <SelectItem value="Abrigo / Instituição">Abrigo / Instituição</SelectItem>
                <SelectItem value="Situação de rua">Situação de rua</SelectItem>
                <SelectItem value="Não informado">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Renda Familiar</label>
            <Select value={form.rendaFamiliar} onValueChange={setSelect("rendaFamiliar")}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sem renda">Sem renda</SelectItem>
                <SelectItem value="Menos de 1 salário mínimo">Menos de 1 salário mínimo</SelectItem>
                <SelectItem value="1 a 3 salários mínimos">1 a 3 salários mínimos</SelectItem>
                <SelectItem value="Mais de 3 salários mínimos">Mais de 3 salários mínimos</SelectItem>
                <SelectItem value="Não informado">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Composição Familiar</label>
          <Input
            placeholder="Ex: Cônjuge e 2 filhos menores"
            value={form.composicaoFamiliar}
            onChange={set("composicaoFamiliar")}
            className="text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Demandas Identificadas *</label>
          <Textarea
            placeholder="Descreva as demandas identificadas…"
            value={form.demandas}
            onChange={set("demandas")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Intervenções Realizadas *</label>
          <Textarea
            placeholder="Descreva as intervenções realizadas…"
            value={form.intervencoes}
            onChange={set("intervencoes")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Encaminhamentos</label>
          <Textarea
            placeholder="Ex: Encaminhado ao CRAS, benefício LOAS solicitado…"
            value={form.encaminhamentos}
            onChange={set("encaminhamentos")}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 max-w-xs">
            <label className="text-xs text-muted-foreground mb-1 block">CRESS</label>
            <Input
              placeholder="Número do CRESS"
              value={form.cress}
              onChange={set("cress")}
              className="text-sm"
            />
          </div>
          <Button
            size="sm"
            disabled={!isValid || addNote.isPending}
            onClick={handleSubmit}
            className="gap-1.5 self-end"
          >
            <Send className="h-3.5 w-3.5" />
            {addNote.isPending ? "Salvando…" : "Registrar Nota"}
          </Button>
        </div>
      </div>

      {/* History */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !notes || notes.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">Nenhuma nota social registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => {
            const d = note.structuredData as SocialData | null;
            const isOpen = expandedId === note.id;
            return (
              <div key={note.id} className="bg-card rounded-lg border border-purple-500/20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-purple-500/5 border-b border-purple-500/10">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                    <span className="text-xs font-semibold">
                      {staffMap[note.userId]?.name ?? `Assistente Social ID ${note.userId}`}
                    </span>
                    {d?.moradia && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300">
                        {d.moradia}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handlePrint(note)}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedId(isOpen ? null : note.id)}
                    >
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="px-4 py-3">
                  {d?.demandas && (
                    <p className={`text-xs text-foreground/80 whitespace-pre-wrap ${isOpen ? "" : "line-clamp-2"}`}>
                      {d.demandas}
                    </p>
                  )}
                  {isOpen && d && (
                    <div className="space-y-3 pt-2 mt-2 border-t border-border/30">
                      {d.rendaFamiliar && (
                        <div className="flex gap-4 text-xs">
                          <span><span className="text-muted-foreground">Renda:</span> {d.rendaFamiliar}</span>
                          {d.composicaoFamiliar && <span><span className="text-muted-foreground">Família:</span> {d.composicaoFamiliar}</span>}
                        </div>
                      )}
                      {d.intervencoes && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400/80 mb-1">Intervenções</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.intervencoes}</p>
                        </div>
                      )}
                      {d.encaminhamentos && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400/80 mb-1">Encaminhamentos</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.encaminhamentos}</p>
                        </div>
                      )}
                      {d.cress && <p className="text-[10px] text-muted-foreground/60">CRESS: {d.cress}</p>}
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
