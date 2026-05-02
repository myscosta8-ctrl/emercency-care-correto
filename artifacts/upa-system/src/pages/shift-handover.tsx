import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Printer, ClipboardList } from "lucide-react";
import { useListPatients } from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { useNurse } from "@/hooks/use-nurse";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ── sector config ─────────────────────────────────────────────────────────────

const SECTORS = [
  {
    name: "Sala Vermelha",
    emoji: "🔴",
    label: "SALA VERMELHA",
    sub: "Leitos críticos",
    headerCls: "bg-red-950/70 border-red-700/50 text-red-200",
    rowEvenCls: "bg-red-950/10",
    printHeaderBg: "#fef2f2",
    printHeaderColor: "#991b1b",
  },
  {
    name: "Observação Adulto",
    emoji: "🟡",
    label: "OBSERVAÇÃO ADULTO",
    sub: "",
    headerCls: "bg-yellow-950/50 border-yellow-700/40 text-yellow-200",
    rowEvenCls: "bg-yellow-950/10",
    printHeaderBg: "#fefce8",
    printHeaderColor: "#854d0e",
  },
  {
    name: "Observação Pediátrica",
    emoji: "🟢",
    label: "OBSERVAÇÃO PEDIÁTRICA",
    sub: "",
    headerCls: "bg-green-950/50 border-green-700/40 text-green-200",
    rowEvenCls: "bg-green-950/10",
    printHeaderBg: "#f0fdf4",
    printHeaderColor: "#166534",
  },
  {
    name: "Observação Pré-Adulto",
    emoji: "🔵",
    label: "OBSERVAÇÃO PRÉ-ADULTO",
    sub: "",
    headerCls: "bg-blue-950/50 border-blue-700/40 text-blue-200",
    rowEvenCls: "bg-blue-950/10",
    printHeaderBg: "#eff6ff",
    printHeaderColor: "#1e40af",
  },
] as const;

const TRIAGE_LABEL: Record<string, string> = {
  red: "Vermelho", orange: "Laranja", yellow: "Amarelo", green: "Verde", blue: "Azul",
};
const TRIAGE_SEVERITY: Record<string, number> = {
  red: 1, orange: 2, yellow: 3, green: 4, blue: 5,
};
const TRIAGE_COLOR: Record<string, string> = {
  red: "text-red-400", orange: "text-orange-400", yellow: "text-yellow-400",
  green: "text-green-400", blue: "text-blue-400",
};

const ESTADO_OPTIONS = ["Estável", "Grave", "Instável", "Crítico"];

const TURNOS = ["Manhã", "Tarde", "Noite"] as const;

function detectTurno(): (typeof TURNOS)[number] {
  const h = new Date().getHours();
  if (h >= 7 && h < 13) return "Manhã";
  if (h >= 13 && h < 19) return "Tarde";
  return "Noite";
}

// ── per-patient row state ─────────────────────────────────────────────────────

type RowState = { estado: string; pendencias: string; notif: "ok" | "pendente" | null };
const defaultRow = (): RowState => ({ estado: "", pendencias: "", notif: null });

// ── patient row component ─────────────────────────────────────────────────────

interface PatientRowProps {
  patient: Patient;
  idx: number;
  evenCls: string;
  state: RowState;
  onChange: (patch: Partial<RowState>) => void;
}

function PatientRow({ patient, idx, evenCls, state, onChange }: PatientRowProps) {
  const isEven = idx % 2 === 0;

  return (
    <tr className={cn(
      "border-b border-border/20 print:border-gray-300",
      isEven ? evenCls : "",
    )}>
      {/* Paciente */}
      <td className="px-3 py-2 print:px-2 print:py-1.5">
        <div className="font-semibold text-sm text-foreground print:text-black leading-tight">{patient.name}</div>
        <div className={cn("text-xs font-medium", TRIAGE_COLOR[patient.status], "print:text-gray-600")}>
          {TRIAGE_LABEL[patient.status]}
        </div>
      </td>

      {/* Leito */}
      <td className="px-3 py-2 print:px-2 print:py-1.5 text-sm text-center text-foreground print:text-black font-mono">
        {patient.bed || "—"}
      </td>

      {/* Diagnóstico */}
      <td className="px-3 py-2 print:px-2 print:py-1.5 text-sm text-foreground print:text-black">
        {patient.diagnosis || <span className="text-muted-foreground print:text-gray-400 italic">—</span>}
      </td>

      {/* Estado */}
      <td className="px-2 py-1.5 print:px-2 print:py-1.5">
        <select
          value={state.estado}
          onChange={e => onChange({ estado: e.target.value })}
          className="w-full bg-transparent border border-border/40 rounded px-1.5 py-1 text-xs text-foreground print:hidden focus:outline-none focus:border-primary/60 min-w-[90px]"
        >
          <option value="">—</option>
          {ESTADO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="hidden print:inline text-sm text-black">
          {state.estado || "____________"}
        </span>
      </td>

      {/* Pendências */}
      <td className="px-2 py-1.5 print:px-2 print:py-1.5">
        <input
          type="text"
          value={state.pendencias}
          onChange={e => onChange({ pendencias: e.target.value })}
          placeholder="Registrar pendência..."
          className="w-full bg-transparent border-b border-border/40 print:border-gray-400 outline-none text-xs text-foreground print:text-black placeholder:text-muted-foreground/60 py-0.5 print:hidden min-w-[120px]"
        />
        <span className="hidden print:inline text-sm text-black">
          {state.pendencias || "______________________________"}
        </span>
      </td>

      {/* Notificação */}
      <td className="px-2 py-1.5 print:px-2 print:py-1.5">
        <div className="flex gap-1 print:hidden">
          {(["ok", "pendente"] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ notif: state.notif === v ? null : v })}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-semibold border transition-colors",
                state.notif === v
                  ? v === "ok"
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                    : "bg-red-500/20 border-red-500/60 text-red-300"
                  : "border-border/40 text-muted-foreground hover:bg-muted/30"
              )}
            >
              {v === "ok" ? "OK" : "Pend."}
            </button>
          ))}
        </div>
        <div className="hidden print:flex gap-2 text-xs text-black">
          <span>({state.notif === "ok" ? "✓" : " "}) OK</span>
          <span>({state.notif === "pendente" ? "✓" : " "}) Pend.</span>
        </div>
      </td>
    </tr>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ShiftHandover() {
  const { nurseName: nurse } = useNurse();
  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  const [date, setDate]        = useState(today);
  const [turno, setTurno]      = useState<(typeof TURNOS)[number]>(detectTurno());
  const [responsible, setResp] = useState(nurse);
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({});
  const [pendenciasGerais, setPendenciasGerais] = useState("");
  const [obsGerais, setObsGerais] = useState("");

  const { data: patients, isLoading } = useListPatients();

  const grouped = SECTORS.map(s => ({
    ...s,
    patients: (patients ?? [])
      .filter(p => p.sector === s.name)
      .sort((a, b) => (TRIAGE_SEVERITY[a.status] ?? 99) - (TRIAGE_SEVERITY[b.status] ?? 99)),
  }));

  const totalPatients = grouped.reduce((n, g) => n + g.patients.length, 0);
  const criticalCount = (patients ?? []).filter(p => p.status === "red" || p.status === "orange").length;

  const getRow = (id: number): RowState => rowStates[id] ?? defaultRow();
  const updateRow = (id: number, patch: Partial<RowState>) =>
    setRowStates(prev => ({ ...prev, [id]: { ...getRow(id), ...patch } }));

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 8mm 7mm; size: A4 landscape; }
          body { background: white !important; color: black !important; font-size: 9pt; }
          .print-hide { display: none !important; }
          table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th, td { border: 1px solid #9ca3af; padding: 2px 4px !important; font-size: 8.5pt; }
          th { background: #e5e7eb !important; font-weight: 700; color: black !important; }
          .print-sector-block { page-break-inside: avoid; margin-bottom: 6pt; }
          .print-sector-title { font-size: 10pt; font-weight: 700; margin-bottom: 2pt; padding: 1px 4px; border-left: 3px solid #374151; }
          .print-summary { page-break-before: auto; }
        }
      `}</style>

      <div className="min-h-screen bg-background text-foreground print:bg-white print:text-black">

        {/* header */}
        <header className="print-hide border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <ClipboardList className="h-4 w-4 text-primary" />
              <h1 className="text-base font-bold tracking-tight">Passagem de Plantão</h1>
            </div>
            <Button onClick={() => window.print()} size="sm" className="gap-2">
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-5 max-w-6xl print:px-0 print:py-0 print:max-w-none">

          {/* ── document title (print only) ────────────────────────────── */}
          <div className="hidden print:block text-center mb-3 pb-2 border-b-2 border-gray-400">
            <h1 className="text-lg font-bold text-black uppercase tracking-wide">
              PASSAGEM DE PLANTÃO — UPA BREVES
            </h1>
          </div>

          {/* ── meta row ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-4 mb-5 p-4 rounded-xl border border-border/40 bg-card/50 print:border print:border-gray-400 print:rounded-none print:bg-white print:p-2 print:mb-3">

            {/* Data */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500">Data:</span>
              <input
                type="text"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-transparent border-b border-border/60 print:border-gray-400 outline-none text-sm text-foreground print:text-black w-28 print:hidden"
              />
              <span className="hidden print:inline text-sm font-semibold text-black">{date}</span>
            </div>

            {/* Turno */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500">Turno:</span>
              <div className="flex gap-3 print:hidden">
                {TURNOS.map(t => (
                  <label key={t} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="turno" className="accent-primary" checked={turno === t} onChange={() => setTurno(t)} />
                    {t}
                  </label>
                ))}
              </div>
              <div className="hidden print:flex gap-3 text-sm text-black">
                {TURNOS.map(t => (
                  <span key={t}>({turno === t ? "✓" : " "}) {t}</span>
                ))}
              </div>
            </div>

            {/* Responsável */}
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 shrink-0">Responsável:</span>
              <input
                type="text"
                value={responsible}
                onChange={e => setResp(e.target.value)}
                placeholder="Nome do enfermeiro(a)"
                className="flex-1 bg-transparent border-b border-border/60 print:border-gray-400 outline-none text-sm text-foreground print:text-black placeholder:text-muted-foreground print:hidden"
              />
              <span className="hidden print:inline text-sm font-semibold text-black">
                {responsible || "________________________________"}
              </span>
            </div>
          </div>

          {/* ── loading ─────────────────────────────────────────────────── */}
          {isLoading && (
            <div className="text-center py-16 text-muted-foreground">Carregando...</div>
          )}

          {/* ── sector tables ────────────────────────────────────────────── */}
          {!isLoading && (
            <div className="space-y-6 print:space-y-4">
              {grouped.map(sector => (
                <div key={sector.name} className="print-sector-block">

                  {/* sector header */}
                  <div className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-t-lg border-b-0 border",
                    sector.headerCls,
                    "print:rounded-none"
                  )}
                    style={{ WebkitPrintColorAdjust: "exact" } as React.CSSProperties}
                  >
                    <span className="text-base leading-none">{sector.emoji}</span>
                    <div>
                      <span className="font-bold text-sm tracking-wide">{sector.label}</span>
                      {sector.sub && <span className="ml-2 text-xs opacity-70">({sector.sub})</span>}
                    </div>
                    <span className="ml-auto text-xs font-semibold opacity-80">
                      {sector.patients.length} {sector.patients.length === 1 ? "paciente" : "pacientes"}
                    </span>
                  </div>

                  {/* table */}
                  <div className="overflow-x-auto rounded-b-lg border border-border/30 print:border print:border-gray-300 print:rounded-none">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/30 print:border-gray-300 bg-muted/20 print:bg-gray-100">
                          <th className="px-3 py-2 print:px-2 print:py-1.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 w-[20%]">Paciente</th>
                          <th className="px-3 py-2 print:px-2 print:py-1.5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 w-[7%]">Leito</th>
                          <th className="px-3 py-2 print:px-2 print:py-1.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 w-[22%]">Diagnóstico</th>
                          <th className="px-3 py-2 print:px-2 print:py-1.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 w-[12%]">Estado</th>
                          <th className="px-3 py-2 print:px-2 print:py-1.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 w-[27%]">Pendências</th>
                          <th className="px-3 py-2 print:px-2 print:py-1.5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 w-[12%]">Notificação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sector.patients.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-4 text-center text-sm text-muted-foreground print:text-gray-400 italic">
                              Nenhum paciente neste setor
                            </td>
                          </tr>
                        ) : (
                          sector.patients.map((p, idx) => (
                            <PatientRow
                              key={p.id}
                              patient={p}
                              idx={idx}
                              evenCls={sector.rowEvenCls}
                              state={getRow(p.id)}
                              onChange={patch => updateRow(p.id, patch)}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              ))}

              {/* ── resumo geral ─────────────────────────────────────────── */}
              <div className="rounded-xl border border-border/40 bg-card/50 p-5 print:border print:border-gray-400 print:rounded-none print:bg-white print:p-3 print:mt-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground print:text-gray-700 mb-4 print:mb-3 border-b border-border/30 print:border-gray-300 pb-2">
                  Resumo Geral
                </h2>

                {/* counters */}
                <div className="flex flex-wrap gap-6 mb-4 print:gap-8">
                  <div>
                    <span className="text-xs text-muted-foreground print:text-gray-500 uppercase font-semibold">Total de Pacientes:</span>
                    <span className="ml-2 text-xl font-bold text-foreground print:text-black">{totalPatients}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground print:text-gray-500 uppercase font-semibold">Críticos (Vermelho/Laranja):</span>
                    <span className={cn(
                      "ml-2 text-xl font-bold",
                      criticalCount > 0 ? "text-red-400 print:text-red-700" : "text-foreground print:text-black"
                    )}>{criticalCount}</span>
                  </div>
                </div>

                {/* pendências gerais */}
                <div className="mb-4 print:mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1.5">
                    Pendências Gerais
                  </label>
                  <Textarea
                    className="text-sm min-h-[80px] print:hidden"
                    placeholder={"- \n- \n- "}
                    value={pendenciasGerais}
                    onChange={e => setPendenciasGerais(e.target.value)}
                  />
                  <div className="hidden print:block text-sm text-black space-y-1.5">
                    {pendenciasGerais
                      ? pendenciasGerais.split("\n").map((line, i) => (
                          <div key={i}>{line || "—"}</div>
                        ))
                      : [0, 1, 2].map(i => (
                          <div key={i} className="border-b border-gray-300 h-5" />
                        ))
                    }
                  </div>
                </div>

                {/* observações */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1.5">
                    Observações Importantes
                  </label>
                  <Textarea
                    className="text-sm min-h-[60px] print:hidden"
                    placeholder="Registre observações relevantes para o próximo turno..."
                    value={obsGerais}
                    onChange={e => setObsGerais(e.target.value)}
                  />
                  <div className="hidden print:block text-sm text-black">
                    {obsGerais || <span className="border-b border-gray-300 block h-5 w-full" />}
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </>
  );
}
