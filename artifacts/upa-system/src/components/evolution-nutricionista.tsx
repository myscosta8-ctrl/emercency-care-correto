import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UtensilsCrossed, Send, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { buildInstitutionalHeader, buildPrintDocStyles, type PrintPatientInfo } from "@/lib/print-header-html";
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
  useAddPatientNutritionalAssessment,
  useGetPatientNutritionalAssessments,
  getGetPatientNutritionalAssessmentsQueryKey,
} from "@workspace/api-client-react";

interface Props {
  patientId: number;
  userId: number;
  patientName: string;
  patient?: PrintPatientInfo | null;
  staffMap: Record<number, { name: string }>;
  mode?: "admissao" | "evolucao";
}

interface NutricionistaData {
  peso: string;
  altura: string;
  viaAlimentacao: string;
  diagnosticoNutricional: string;
  planoAlimentar: string;
  crn: string;
}

const EMPTY: NutricionistaData = {
  peso: "",
  altura: "",
  viaAlimentacao: "",
  diagnosticoNutricional: "",
  planoAlimentar: "",
  crn: "",
};

function calcImc(peso: string, altura: string): string {
  const p = parseFloat(peso.replace(",", "."));
  const a = parseFloat(altura.replace(",", "."));
  if (!p || !a || a < 0.5) return "";
  const alturaM = a < 3 ? a : a / 100;
  const imc = p / (alturaM * alturaM);
  return isNaN(imc) ? "" : imc.toFixed(1);
}

function imcCategory(imc: string): string {
  const v = parseFloat(imc);
  if (isNaN(v)) return "";
  if (v < 18.5) return "Abaixo do peso";
  if (v < 25) return "Peso normal";
  if (v < 30) return "Sobrepeso";
  if (v < 35) return "Obesidade Grau I";
  if (v < 40) return "Obesidade Grau II";
  return "Obesidade Grau III";
}

function buildContent(d: NutricionistaData, imc: string): string {
  const parts: string[] = [];
  if (d.peso || d.altura) {
    const metrics = [`Peso: ${d.peso || "—"} kg`, `Altura: ${d.altura || "—"} cm`, imc ? `IMC: ${imc} kg/m² (${imcCategory(imc)})` : ""].filter(Boolean);
    parts.push(`[DADOS ANTROPOMÉTRICOS]\n${metrics.join(" | ")}`);
  }
  if (d.viaAlimentacao)           parts.push(`[VIA DE ALIMENTAÇÃO] ${d.viaAlimentacao}`);
  if (d.diagnosticoNutricional.trim()) parts.push(`[DIAGNÓSTICO NUTRICIONAL]\n${d.diagnosticoNutricional.trim()}`);
  if (d.planoAlimentar.trim())    parts.push(`[PLANO ALIMENTAR]\n${d.planoAlimentar.trim()}`);
  if (d.crn.trim())               parts.push(`[CRN] ${d.crn.trim()}`);
  return parts.join("\n\n");
}

export function EvolutionNutricionista({ patientId, userId, patientName, patient, staffMap, mode = "evolucao" }: Props) {
  const [form, setForm] = useState<NutricionistaData>(EMPTY);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const imc = useMemo(() => calcImc(form.peso, form.altura), [form.peso, form.altura]);

  const { data: assessments, isLoading } = useGetPatientNutritionalAssessments(patientId, {
    query: { queryKey: getGetPatientNutritionalAssessmentsQueryKey(patientId) },
  });

  const addAssessment = useAddPatientNutritionalAssessment();

  const sorted = useMemo(
    () => [...(assessments ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [assessments],
  );
  const admissaoId = sorted[0]?.id;
  const isFirst = !admissaoId;

  const set = (k: keyof NutricionistaData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const setSelect = (k: keyof NutricionistaData) => (v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const isValid = !!(form.diagnosticoNutricional.trim() || form.planoAlimentar.trim());

  const handleSubmit = () => {
    const content = buildContent(form, imc);
    if (!content) return;
    addAssessment.mutate(
      {
        id: patientId,
        data: {
          userId,
          content,
          structuredData: { ...form, imc } as unknown as Record<string, unknown>,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientNutritionalAssessmentsQueryKey(patientId) });
          setForm(EMPTY);
          toast({ title: isFirst ? "Avaliação nutricional de admissão registrada" : "Evolução diária nutricional registrada" });
        },
        onError: () => toast({ title: "Erro ao registrar avaliação", variant: "destructive" }),
      }
    );
  };

  const handlePrint = (item: NonNullable<typeof assessments>[number]) => {
    const d = item.structuredData as (NutricionistaData & { imc?: string }) | null;
    const authorName = staffMap[item.userId]?.name ?? `Nutricionista ID ${item.userId}`;
    const dateStr = format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const imcVal = d?.imc ?? (d?.peso && d?.altura ? calcImc(d.peso, d.altura) : "");
    const baseUrl = window.location.origin + (import.meta.env.BASE_URL ?? "/");
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Avaliação Nutricional — ${patientName}</title>
<style>${buildPrintDocStyles("#065f46")}</style></head><body>
${buildInstitutionalHeader(patient ?? null, "AVALIAÇÃO NUTRICIONAL", baseUrl)}
<p class="doc-meta"><strong>Nutricionista:</strong> ${authorName} &nbsp;|&nbsp; <strong>Data/Hora do Registro:</strong> ${dateStr}</p>
${(d?.peso || d?.altura || imcVal) ? `
<div class="metrics">
  ${d?.peso ? `<div class="metric"><div class="metric-val">${d.peso}</div><div class="metric-label">Peso (kg)</div></div>` : ""}
  ${d?.altura ? `<div class="metric"><div class="metric-val">${d.altura}</div><div class="metric-label">Altura (cm)</div></div>` : ""}
  ${imcVal ? `<div class="metric"><div class="metric-val">${imcVal}</div><div class="metric-label">IMC — ${imcCategory(imcVal)}</div></div>` : ""}
</div>` : ""}
${d?.viaAlimentacao ? `<div class="section"><div class="section-label">Via de Alimentação</div><div class="section-body">${d.viaAlimentacao}</div></div>` : ""}
${d?.diagnosticoNutricional ? `<div class="section"><div class="section-label">Diagnóstico Nutricional</div><div class="section-body">${d.diagnosticoNutricional}</div></div>` : ""}
${d?.planoAlimentar ? `<div class="section"><div class="section-label">Plano Alimentar</div><div class="section-body">${d.planoAlimentar}</div></div>` : ""}
<div class="sig-area">
  <div class="sig-line">${authorName}</div>
  <div class="sig-sub">Nutricionista${d?.crn ? ` — CRN: ${d.crn}` : ""}</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    win.document.close();
  };

  const formBlock = (
    <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
        <UtensilsCrossed className="h-3.5 w-3.5" />
        {isFirst ? "Admissão Inicial — Nutrição" : "Evolução Diária — Nutrição"}
      </h4>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Peso atual (kg)</label>
          <Input placeholder="Ex: 68.5" value={form.peso} onChange={set("peso")} className="text-sm" type="text" inputMode="decimal" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Altura (cm)</label>
          <Input placeholder="Ex: 165" value={form.altura} onChange={set("altura")} className="text-sm" type="text" inputMode="decimal" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">IMC (calculado)</label>
          <div className={`flex items-center h-10 px-3 rounded-md border text-sm font-mono ${imc ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300" : "border-border/40 text-muted-foreground"}`}>
            {imc ? `${imc} kg/m²` : "—"}
          </div>
          {imc && <p className="text-[10px] text-emerald-400/80 mt-0.5">{imcCategory(imc)}</p>}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Via de Alimentação</label>
        <Select value={form.viaAlimentacao} onValueChange={setSelect("viaAlimentacao")}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Oral">Oral</SelectItem>
            <SelectItem value="Sonda nasogástrica (SNG)">Sonda nasogástrica (SNG)</SelectItem>
            <SelectItem value="Sonda nasoenteral (SNE)">Sonda nasoenteral (SNE)</SelectItem>
            <SelectItem value="Gastrostomia">Gastrostomia</SelectItem>
            <SelectItem value="Parenteral total (NPT)">Parenteral total (NPT)</SelectItem>
            <SelectItem value="Parenteral periférica (NPP)">Parenteral periférica (NPP)</SelectItem>
            <SelectItem value="Misto (oral + enteral)">Misto (oral + enteral)</SelectItem>
            <SelectItem value="Misto (enteral + parenteral)">Misto (enteral + parenteral)</SelectItem>
            <SelectItem value="Jejum">Jejum</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Diagnóstico Nutricional *</label>
        <Textarea placeholder="Ex: Desnutrição proteico-calórica moderada secundária a…" value={form.diagnosticoNutricional} onChange={set("diagnosticoNutricional")} rows={2} className="resize-none text-sm" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Plano Alimentar *</label>
        <Textarea placeholder="Ex: Dieta hipercalórica e hiperproteica, fracionada em 6 refeições…" value={form.planoAlimentar} onChange={set("planoAlimentar")} rows={3} className="resize-none text-sm" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 max-w-xs">
          <label className="text-xs text-muted-foreground mb-1 block">CRN</label>
          <Input placeholder="Número do CRN" value={form.crn} onChange={set("crn")} className="text-sm" />
        </div>
        <Button size="sm" disabled={!isValid || addAssessment.isPending} onClick={handleSubmit} className="gap-1.5 self-end">
          <Send className="h-3.5 w-3.5" />
          {addAssessment.isPending ? "Salvando…" : isFirst ? "Registrar Admissão" : "Registrar Evolução Diária"}
        </Button>
      </div>
    </div>
  );

  if (mode === "admissao") {
    if (isLoading) return <Skeleton className="h-20 w-full" />;
    if (!assessments || assessments.length === 0) return formBlock;
    const first = sorted[0];
    const d = first.structuredData as (NutricionistaData & { imc?: string }) | null;
    const imcVal = d?.imc ?? "";
    return (
      <div className="bg-card rounded-lg border border-emerald-500/20 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{staffMap[first.userId]?.name ?? `Nutricionista ID ${first.userId}`}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 uppercase tracking-wider">Admissão Inicial</span>
            {d?.viaAlimentacao && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{d.viaAlimentacao}</span>
            )}
            {imcVal && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/20 text-emerald-400 font-mono">IMC {imcVal}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{format(new Date(first.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => handlePrint(first)}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="px-4 py-3 space-y-1">
          {d?.diagnosticoNutricional && <p className="text-xs text-foreground/90 line-clamp-2">{d.diagnosticoNutricional}</p>}
          {(d?.peso || d?.altura) && (
            <p className="text-xs text-muted-foreground/70">
              {d.peso && `Peso: ${d.peso} kg`}{d.peso && d.altura && " · "}{d.altura && `Altura: ${d.altura} cm`}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {formBlock}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !assessments || assessments.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">Nenhuma avaliação nutricional registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map(item => {
            const d = item.structuredData as (NutricionistaData & { imc?: string }) | null;
            const imcVal = d?.imc ?? "";
            const isOpen = expandedId === item.id;
            const isAdmissao = item.id === admissaoId;
            return (
              <div key={item.id} className="bg-card rounded-lg border border-emerald-500/20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold">{staffMap[item.userId]?.name ?? `Nutricionista ID ${item.userId}`}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${isAdmissao ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-border/40 bg-muted/10 text-muted-foreground/60"}`}>
                      {isAdmissao ? "Admissão Inicial" : "Evolução Diária"}
                    </span>
                    {d?.viaAlimentacao && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{d.viaAlimentacao}</span>
                    )}
                    {imcVal && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/20 text-emerald-400 font-mono">IMC {imcVal}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => handlePrint(item)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => setExpandedId(isOpen ? null : item.id)}>
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {d?.diagnosticoNutricional && (
                    <p className={`text-xs text-foreground/90 ${isOpen ? "whitespace-pre-wrap" : "line-clamp-2"}`}>{d.diagnosticoNutricional}</p>
                  )}
                  {isOpen && d && (
                    <div className="space-y-3 pt-2 border-t border-border/30">
                      {(d.peso || d.altura) && (
                        <div className="flex gap-4 text-xs">
                          {d.peso && <span><span className="text-muted-foreground">Peso:</span> {d.peso} kg</span>}
                          {d.altura && <span><span className="text-muted-foreground">Altura:</span> {d.altura} cm</span>}
                          {imcVal && <span><span className="text-muted-foreground">IMC:</span> {imcVal} — {imcCategory(imcVal)}</span>}
                        </div>
                      )}
                      {d.planoAlimentar && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 mb-1">Plano Alimentar</p>
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{d.planoAlimentar}</p>
                        </div>
                      )}
                      {d.crn && <p className="text-[10px] text-muted-foreground/60">CRN: {d.crn}</p>}
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
