import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Printer, ClipboardList, HeartPulse, Wind, Droplet, Thermometer, Gauge, Activity } from "lucide-react";
import { useListPatients } from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { useNurse } from "@/hooks/use-nurse";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ── sector config ─────────────────────────────────────────────────────────────

const SECTORS = [
  {
    key: "sala_vermelha",
    label: "SALA VERMELHA",
    sub: "Leitos críticos",
    headerCls: "bg-red-950/70 border-red-700/50 text-red-200",
    accentCls: "border-l-red-500",
    printHeaderBg: "#fef2f2",
    printHeaderColor: "#991b1b",
  },
  {
    key: "observacao_adulto",
    label: "OBSERVAÇÃO ADULTO",
    sub: "",
    headerCls: "bg-yellow-950/50 border-yellow-700/40 text-yellow-200",
    accentCls: "border-l-yellow-500",
    printHeaderBg: "#fefce8",
    printHeaderColor: "#854d0e",
  },
  {
    key: "observacao_pediatrica",
    label: "OBSERVAÇÃO PEDIÁTRICA",
    sub: "",
    headerCls: "bg-green-950/50 border-green-700/40 text-green-200",
    accentCls: "border-l-green-500",
    printHeaderBg: "#f0fdf4",
    printHeaderColor: "#166534",
  },
  {
    key: "observacao_pre_adulto",
    label: "OBSERVAÇÃO PRÉ-ADULTO",
    sub: "",
    headerCls: "bg-blue-950/50 border-blue-700/40 text-blue-200",
    accentCls: "border-l-blue-500",
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
const TRIAGE_COLOR_SCREEN: Record<string, string> = {
  red: "text-red-400 bg-red-500/15 border-red-500/30",
  orange: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  yellow: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
  green: "text-green-400 bg-green-500/15 border-green-500/30",
  blue: "text-blue-400 bg-blue-500/15 border-blue-500/30",
};

const TURNOS = ["Manhã", "Tarde", "Noite"] as const;

function detectTurno(): (typeof TURNOS)[number] {
  const h = new Date().getHours();
  if (h >= 7 && h < 13) return "Manhã";
  if (h >= 13 && h < 19) return "Tarde";
  return "Noite";
}

// ── row state ─────────────────────────────────────────────────────────────────

type RowState = { estado: string; pendencias: string; notif: "ok" | "pendente" | null };
const defaultRow = (): RowState => ({ estado: "", pendencias: "", notif: null });
const ESTADO_OPTIONS = ["Estável", "Grave", "Instável", "Crítico"];

// ── helpers ───────────────────────────────────────────────────────────────────

function val(v: string | number | null | undefined, fallback = "—"): string {
  if (v === null || v === undefined || v === "" || v === 0) return fallback;
  return String(v);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = iso.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

function endereco(p: Patient): string {
  const parts = [p.street, p.addressNumber, p.addressComplement, p.neighborhood].filter(Boolean);
  return parts.join(", ") || "—";
}

// ── vitals row ────────────────────────────────────────────────────────────────

interface VitalCellProps { label: string; value: string; alert?: boolean; icon?: React.ReactNode }
function VitalCell({ label, value, alert, icon }: VitalCellProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded border py-1 px-1.5 min-w-[52px]",
      "bg-muted/10 border-border/30 print:bg-white print:border-gray-300",
      alert ? "border-red-500/50 bg-red-950/20 print:border-red-400" : ""
    )}>
      <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500 leading-none mb-0.5 flex items-center gap-0.5">
        {icon}<span>{label}</span>
      </span>
      <span className={cn(
        "text-sm font-bold font-mono leading-none print:text-black",
        alert ? "text-red-400 print:text-red-700" : "text-foreground"
      )}>
        {value}
      </span>
    </div>
  );
}

// ── patient card ──────────────────────────────────────────────────────────────

interface PatientCardProps {
  patient: Patient;
  accentCls: string;
  state: RowState;
  onChange: (patch: Partial<RowState>) => void;
}

function PatientCard({ patient: p, accentCls, state, onChange }: PatientCardProps) {
  const triage = TRIAGE_COLOR_SCREEN[p.status] ?? TRIAGE_COLOR_SCREEN.blue;
  const pa = (p.systolicBp && p.diastolicBp) ? `${p.systolicBp}/${p.diastolicBp}` : "—";
  const fc = p.heartRate ? String(p.heartRate) : "—";
  const fr = p.respiratoryRate ? String(p.respiratoryRate) : "—";
  const spo2 = p.spO2 ? `${p.spO2}%` : "—";
  const temp = p.temperature ? `${p.temperature}°C` : "—";
  const hgt = p.glucose ? `${p.glucose}` : "—";
  const dataHora = [p.attendanceDate ? fmtDate(p.attendanceDate) : "", p.attendanceTime || ""].filter(Boolean).join(" ") || "—";
  const profissional = val(p.responsibleProfessional);

  const fcAlert = p.heartRate > 100 || p.heartRate < 50;
  const spo2Alert = p.spO2 > 0 && p.spO2 < 94;
  const tempAlert = p.temperature > 37.8 || (p.temperature > 0 && p.temperature < 35.5);

  return (
    <div className={cn(
      "rounded-lg border border-border/40 border-l-4 overflow-hidden",
      "print:border print:border-gray-300 print:border-l-4 print:rounded-none print:mb-2",
      accentCls
    )}>

      {/* ── card header: nome + classificação ──────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/20 print:bg-gray-50 print:px-2 print:py-1.5 border-b border-border/30 print:border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm text-foreground print:text-black truncate">{p.nome}</span>
          {p.diagnosis && (
            <span className="text-xs text-muted-foreground print:text-gray-500 truncate hidden sm:inline">— {p.diagnosis}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide",
            triage, "print:text-gray-800 print:bg-gray-100 print:border-gray-400"
          )}>
            {TRIAGE_LABEL[p.status] ?? p.status}
          </span>
          <span className="text-xs font-mono font-semibold text-foreground print:text-black bg-muted/40 print:bg-gray-100 border border-border/40 print:border-gray-300 rounded px-1.5 py-0.5">
            Leito {val(p.bed)}
          </span>
        </div>
      </div>

      {/* ── body: dois painéis ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto] gap-0 divide-y md:divide-y-0 md:divide-x divide-border/30 print:divide-x print:divide-gray-200">

        {/* ── painel esquerdo: identificação ──────────────────────────── */}
        <div className="px-3 py-2 print:px-2 print:py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-1.5">Identificação</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-x-4 gap-y-0.5 text-xs">
            <Field label="Mãe" value={val(p.motherName)} />
            <Field label="Nasc." value={fmtDate(p.birthDate)} />
            <Field label="Idade" value={p.age ? `${p.age} anos` : "—"} />
            <Field label="Sexo" value={p.sex === "M" ? "Masculino" : p.sex === "F" ? "Feminino" : val(p.sex)} />
            <Field label="CPF" value={val(p.cpf)} mono />
            <Field label="RG" value={val(p.rg)} mono />
            <Field label="CNS" value={val(p.cns)} mono />
            <Field label="Setor" value={val(p.setor).replace(/_/g, " ")} className="capitalize" />
            <Field label="Endereço" value={endereco(p)} className="col-span-2 sm:col-span-1 print:col-span-1" />
          </div>
        </div>

        {/* ── painel direito: sinais vitais ────────────────────────────── */}
        <div className="px-3 py-2 print:px-2 print:py-1.5 md:w-[300px] print:w-[280px]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-1.5">Sinais Vitais</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <VitalCell label="PA" value={pa} icon={<Gauge className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="FC" value={fc} alert={fcAlert} icon={<HeartPulse className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="FR" value={fr} icon={<Wind className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="SpO₂" value={spo2} alert={spo2Alert} icon={<Droplet className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="Temp." value={temp} alert={tempAlert} icon={<Thermometer className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="HGT" value={hgt === "—" ? hgt : `${hgt} mg/dL`} icon={<Activity className="h-2 w-2 mr-0.5" />} />
          </div>
          <div className="flex gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-muted-foreground print:text-gray-500 font-semibold uppercase text-[9px]">Data/Hora: </span>
              <span className="text-foreground print:text-black font-mono">{dataHora}</span>
            </div>
            <div className="min-w-0 truncate">
              <span className="text-muted-foreground print:text-gray-500 font-semibold uppercase text-[9px]">Profissional: </span>
              <span className="text-foreground print:text-black">{profissional}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── rodapé: estado / pendências / notificação ─────────────────── */}
      <div className="grid grid-cols-[130px_1fr_auto] gap-2 px-3 py-2 print:px-2 print:py-1.5 border-t border-border/20 print:border-gray-200 bg-muted/5 print:bg-white items-start">

        {/* Estado */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-0.5">Estado</p>
          <select
            value={state.estado}
            onChange={e => onChange({ estado: e.target.value })}
            className="w-full bg-transparent border border-border/40 rounded px-1.5 py-1 text-xs text-foreground print:hidden focus:outline-none focus:border-primary/60"
          >
            <option value="">—</option>
            {ESTADO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="hidden print:inline text-sm text-black">{state.estado || "___________"}</span>
        </div>

        {/* Pendências */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-0.5">Pendências</p>
          <input
            type="text"
            value={state.pendencias}
            onChange={e => onChange({ pendencias: e.target.value })}
            placeholder="Registrar pendência..."
            className="w-full bg-transparent border-b border-border/40 print:border-gray-400 outline-none text-xs text-foreground print:text-black placeholder:text-muted-foreground/60 py-0.5 print:hidden"
          />
          <span className="hidden print:inline text-sm text-black">{state.pendencias || "____________________________________________"}</span>
        </div>

        {/* Notificação */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-0.5">Notificação</p>
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
        </div>
      </div>
    </div>
  );
}

// ── field helper ──────────────────────────────────────────────────────────────

function Field({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={cn("leading-snug", className)}>
      <span className="text-muted-foreground print:text-gray-500 text-[9px] font-semibold uppercase tracking-wide">{label}: </span>
      <span className={cn("text-foreground print:text-black", mono ? "font-mono" : "")}>{value}</span>
    </div>
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
      .filter(p => p.setor === s.key)
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
          @page { margin: 8mm 10mm; size: A4; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { background: white !important; color: black !important; font-size: 8pt !important; line-height: 1.3; }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-background text-foreground print:bg-white print:text-black">

        {/* ── header ───────────────────────────────────────────────────── */}
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
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{totalPatients} pac. ativos</span>
              {criticalCount > 0 && (
                <span className="text-red-400 font-semibold">{criticalCount} críticos</span>
              )}
              <Button onClick={() => window.print()} size="sm" className="gap-2 ml-2">
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-5 max-w-5xl print:px-0 print:py-0 print:max-w-none">

          {/* ── título (só impressão) ────────────────────────────────── */}
          <div className="hidden print:block text-center mb-3 pb-2 border-b-2 border-gray-600">
            <h1 className="text-base font-bold text-black uppercase tracking-wider">
              PASSAGEM DE PLANTÃO — UPA BREVES
            </h1>
          </div>

          {/* ── meta row ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-4 mb-5 p-4 rounded-xl border border-border/40 bg-card/50 print:border print:border-gray-400 print:rounded-none print:bg-white print:p-2 print:mb-3">

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600">Data:</span>
              <input
                type="text"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-transparent border-b border-border/60 print:border-gray-400 outline-none text-sm text-foreground print:text-black w-28 print:hidden"
              />
              <span className="hidden print:inline text-sm font-semibold text-black">{date}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600">Turno:</span>
              <div className="flex gap-3 print:hidden">
                {TURNOS.map(t => (
                  <label key={t} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="turno" className="accent-primary" checked={turno === t} onChange={() => setTurno(t)} />
                    {t}
                  </label>
                ))}
              </div>
              <div className="hidden print:flex gap-3 text-sm text-black">
                {TURNOS.map(t => <span key={t}>({turno === t ? "✓" : " "}) {t}</span>)}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 shrink-0">Responsável:</span>
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

          {/* ── loading ──────────────────────────────────────────────── */}
          {isLoading && (
            <div className="text-center py-16 text-muted-foreground">Carregando pacientes...</div>
          )}

          {/* ── setores ──────────────────────────────────────────────── */}
          {!isLoading && (
            <div className="space-y-6 print:space-y-4">
              {grouped.map(sector => (
                <div key={sector.key}>

                  {/* sector header */}
                  <div className={cn(
                    "flex items-center justify-between gap-3 px-4 py-2 rounded-t-lg border",
                    sector.headerCls,
                    "print:rounded-none"
                  )}>
                    <span className="font-bold text-sm tracking-wide">{sector.label}</span>
                    {sector.sub && <span className="text-xs opacity-70">({sector.sub})</span>}
                    <span className="ml-auto text-xs font-semibold opacity-80 tabular-nums">
                      {sector.patients.length} {sector.patients.length === 1 ? "paciente" : "pacientes"}
                    </span>
                  </div>

                  {/* patients */}
                  {sector.patients.length === 0 ? (
                    <div className="border border-t-0 border-border/30 print:border-gray-300 rounded-b-lg px-4 py-3 text-sm text-muted-foreground italic print:text-gray-400">
                      Nenhum paciente neste setor.
                    </div>
                  ) : (
                    <div className="border border-t-0 border-border/30 print:border-gray-300 rounded-b-lg p-3 print:p-2 space-y-2 print:space-y-1.5">
                      {sector.patients.map(p => (
                        <PatientCard
                          key={p.id}
                          patient={p}
                          accentCls={sector.accentCls}
                          state={getRow(p.id)}
                          onChange={patch => updateRow(p.id, patch)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* ── resumo geral ──────────────────────────────────────── */}
              <div className="rounded-xl border border-border/40 bg-card/50 p-5 print:border print:border-gray-400 print:rounded-none print:bg-white print:p-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground print:text-gray-700 mb-4 border-b border-border/30 print:border-gray-300 pb-2">
                  Resumo Geral
                </h2>

                <div className="flex flex-wrap gap-8 mb-4">
                  <div>
                    <span className="text-xs text-muted-foreground print:text-gray-500 uppercase font-semibold">Total de Pacientes: </span>
                    <span className="text-xl font-bold text-foreground print:text-black">{totalPatients}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground print:text-gray-500 uppercase font-semibold">Críticos (Vermelho/Laranja): </span>
                    <span className={cn(
                      "text-xl font-bold",
                      criticalCount > 0 ? "text-red-400 print:text-red-700" : "text-foreground print:text-black"
                    )}>{criticalCount}</span>
                  </div>
                </div>

                <div className="mb-4">
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
                      ? pendenciasGerais.split("\n").map((line, i) => <div key={i}>{line || "—"}</div>)
                      : [0, 1, 2].map(i => <div key={i} className="border-b border-gray-300 h-5" />)
                    }
                  </div>
                </div>

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

                {/* assinatura */}
                <div className="mt-6 print:mt-4 pt-4 border-t border-border/30 print:border-gray-300 flex justify-end">
                  <div className="text-center min-w-[200px]">
                    <div className="border-b border-border/50 print:border-gray-500 h-8 mb-1" />
                    <p className="text-xs text-muted-foreground print:text-gray-600 uppercase tracking-wide">Assinatura do Responsável</p>
                    {responsible && (
                      <p className="text-xs font-semibold text-foreground print:text-black mt-0.5">{responsible}</p>
                    )}
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
