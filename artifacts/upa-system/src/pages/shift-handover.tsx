import { useState, useEffect } from "react";
import { Link } from "wouter";
import { PrintHeader } from "@/components/print-header";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Printer, ClipboardList,
  HeartPulse, Wind, Droplet, Thermometer, Gauge, Activity,
} from "lucide-react";
import { useListPatients } from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { useNurse } from "@/hooks/use-nurse";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface LatestVitals {
  bp?: string | null;
  hr?: number | null;
  rr?: number | null;
  spo2?: number | null;
  temp?: number | null;
  glucose?: number | null;
}

// ── sector config ──────────────────────────────────────────────────────────────

const SECTORS = [
  {
    key: "sala_vermelha",
    label: "SALA VERMELHA",
    sub: "Leitos críticos",
    headerCls: "bg-red-950/70 border-red-700/50 text-red-200",
    accentCls: "border-l-red-500",
  },
  {
    key: "observacao_adulto",
    label: "OBSERVAÇÃO ADULTO",
    sub: "",
    headerCls: "bg-yellow-950/50 border-yellow-700/40 text-yellow-200",
    accentCls: "border-l-yellow-500",
  },
  {
    key: "observacao_pediatrica",
    label: "OBSERVAÇÃO PEDIÁTRICA",
    sub: "",
    headerCls: "bg-green-950/50 border-green-700/40 text-green-200",
    accentCls: "border-l-green-500",
  },
  {
    key: "observacao_pre_adulto",
    label: "OBSERVAÇÃO PRÉ-ADULTO",
    sub: "",
    headerCls: "bg-blue-950/50 border-blue-700/40 text-blue-200",
    accentCls: "border-l-blue-500",
  },
] as const;

const TRIAGE_LABEL: Record<string, string> = {
  red: "Vermelho", orange: "Laranja", yellow: "Amarelo", green: "Verde", blue: "Azul",
};
const TRIAGE_SEVERITY: Record<string, number> = {
  red: 1, orange: 2, yellow: 3, green: 4, blue: 5,
};
const TRIAGE_COLOR_SCREEN: Record<string, string> = {
  red:    "text-red-400 bg-red-500/15 border-red-500/30",
  orange: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  yellow: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
  green:  "text-green-400 bg-green-500/15 border-green-500/30",
  blue:   "text-blue-400 bg-blue-500/15 border-blue-500/30",
};

const TURNOS = ["Manhã", "Tarde", "Noite"] as const;
function detectTurno(): (typeof TURNOS)[number] {
  const h = new Date().getHours();
  if (h >= 7 && h < 13) return "Manhã";
  if (h >= 13 && h < 19) return "Tarde";
  return "Noite";
}

// ── pendências estruturadas ────────────────────────────────────────────────────

const PEND_ITEMS = [
  { key: "acesso_venoso_periferico", label: "Acesso Venoso Periférico (AVP)" },
  { key: "acesso_venoso_central",    label: "Acesso Venoso Central (AVC)" },
  { key: "sonda_nasoenteral",        label: "Sonda Nasoenteral (SNE)" },
  { key: "sonda_nasogastrica",       label: "Sonda Nasogástrica (SNG)" },
  { key: "sonda_vesical_demora",     label: "Sonda Vesical de Demora (SVD)" },
  { key: "cateter_arterial",         label: "Cateter Arterial" },
  { key: "dreno_torax",              label: "Dreno de Tórax" },
  { key: "traqueostomia",            label: "Traqueostomia" },
  { key: "gastrostomia",             label: "Gastrostomia" },
  { key: "exames_laboratorio",       label: "Exames laboratoriais" },
  { key: "exames_imagem",            label: "Exames de imagem" },
  { key: "procedimento",             label: "Procedimento pendente" },
  { key: "medicacao",                label: "Medicação" },
] as const;

type PendKey = (typeof PEND_ITEMS)[number]["key"];

// ── row state ──────────────────────────────────────────────────────────────────

interface RowState {
  estado:     string;
  soap_s:     string;
  soap_o:     string;
  soap_a:     string;
  soap_p:     string;
  pends:      Set<PendKey>;
  pend_obs:   string;
  notif:      "ok" | "pendente" | null;
}

function defaultPlan(status: string): string {
  if (status === "red" || status === "orange") {
    return "- Monitorar 15/15 min\n- O2 contínuo\n- Acesso venoso";
  }
  if (status === "yellow") {
    return "- Monitorar 1/1h";
  }
  if (status === "green") {
    return "- Monitorar 6/6h";
  }
  return "";
}

const defaultRow = (status = ""): RowState => ({
  estado: "", soap_s: "", soap_o: "", soap_a: "", soap_p: defaultPlan(status),
  pends: new Set(), pend_obs: "", notif: null,
});

const ESTADO_OPTIONS = ["Estável", "Grave", "Instável", "Crítico"];

// ── helpers ────────────────────────────────────────────────────────────────────

function val(v: string | number | null | undefined, fallback = "—"): string {
  if (v === null || v === undefined || v === "" || v === 0) return fallback;
  return String(v);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = iso.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function endereco(p: Patient): string {
  return p.address || "—";
}

// ── vital cell ─────────────────────────────────────────────────────────────────

function VitalCell({ label, value, alert, icon }: {
  label: string; value: string; alert?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded border py-1 px-1.5 min-w-[50px]",
      "bg-muted/10 border-border/30 print:bg-white print:border-gray-300",
      alert ? "border-red-500/50 bg-red-950/20 print:border-red-400" : "",
    )}>
      <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500 leading-none mb-0.5 flex items-center gap-0.5">
        {icon}<span>{label}</span>
      </span>
      <span className={cn(
        "text-sm font-bold font-mono leading-none print:text-black",
        alert ? "text-red-400 print:text-red-700" : "text-foreground",
      )}>{value}</span>
    </div>
  );
}

// ── soap badge ─────────────────────────────────────────────────────────────────

const SOAP_CFG = {
  S: { color: "bg-blue-500/20 text-blue-300 border-blue-500/40",   border: "border-l-blue-500/60",   placeholder: "Paciente refere... queixas, sintomas, evolução subjetiva." },
  O: { color: "bg-green-500/20 text-green-300 border-green-500/40", border: "border-l-green-500/60",  placeholder: "Achados clínicos, exame físico, sinais objetivos observados." },
  A: { color: "bg-orange-500/20 text-orange-300 border-orange-500/40", border: "border-l-orange-500/60", placeholder: "Análise e avaliação do quadro clínico atual." },
  P: { color: "bg-purple-500/20 text-purple-300 border-purple-500/40", border: "border-l-purple-500/60", placeholder: "- Manter monitorização\n- Administrar medicação conforme prescrição\n- Reavaliar em ___ min" },
} as const;

type SoapKey = keyof typeof SOAP_CFG;

function SoapField({ letter, value, onChange }: {
  letter: SoapKey; value: string; onChange: (v: string) => void;
}) {
  const cfg = SOAP_CFG[letter];
  return (
    <div className={cn("border-l-2 pl-2", cfg.border)}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold border shrink-0",
          cfg.color, "print:bg-transparent print:border-gray-400 print:text-black",
        )}>{letter}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-500">
          {{ S: "Subjetivo", O: "Objetivo", A: "Avaliação", P: "Plano" }[letter]}
        </span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={letter === "P" ? 3 : 2}
        placeholder={cfg.placeholder}
        className={cn(
          "w-full bg-transparent border border-border/30 rounded px-2 py-1 text-xs text-foreground",
          "placeholder:text-muted-foreground/50 resize-none outline-none focus:border-primary/50",
          "print:hidden",
        )}
      />
      <div className={cn(
        "hidden print:block text-[8pt] text-black whitespace-pre-wrap min-h-[28px] border-b border-gray-300 pb-0.5",
        letter === "P" ? "min-h-[48px]" : "",
      )}>
        {value || ""}
      </div>
    </div>
  );
}

// ── patient card ───────────────────────────────────────────────────────────────

interface PatientCardProps {
  patient: Patient;
  accentCls: string;
  state: RowState;
  onChange: (patch: Partial<RowState>) => void;
  staffId: number;
}

function PatientCard({ patient: p, accentCls, state, onChange, staffId }: PatientCardProps) {
  const triage = TRIAGE_COLOR_SCREEN[p.triage_level] ?? TRIAGE_COLOR_SCREEN.blue;
  const [vitals, setVitals] = useState<LatestVitals | null>(null);

  useEffect(() => {
    if (!staffId || !p.id) return;
    fetch(`/api/patients/${p.id}/vitals`, {
      headers: { "x-staff-id": String(staffId) },
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: LatestVitals[]) => { if (data.length > 0) setVitals(data[0]); })
      .catch(() => {});
  }, [p.id, staffId]);

  function fmtVital(v: number | null | undefined): string {
    if (v === null || v === undefined || v === 0) return "—";
    return String(v);
  }

  const pa   = vitals?.bp   || "—";
  const fc   = fmtVital(vitals?.hr);
  const fr   = fmtVital(vitals?.rr);
  const spo2 = fmtVital(vitals?.spo2);
  const temp = vitals?.temp ? String(vitals.temp) : "—";
  const hgt  = fmtVital(vitals?.glucose);

  const hrVal   = vitals?.hr   ?? 0;
  const rrVal   = vitals?.rr   ?? 0;
  const spo2Val = vitals?.spo2 ?? 100;
  const tempVal = vitals?.temp ?? 0;
  const fcAlert   = hrVal   > 0 && (hrVal > 100 || hrVal < 50);
  const spo2Alert = spo2Val > 0 && spo2Val < 95;
  const tempAlert = tempVal > 0 && (tempVal > 37.8 || tempVal < 35);
  const _rrAlert  = rrVal   > 0 && rrVal > 25;

  const dataHora    = [p.attendanceDate ? fmtDate(p.attendanceDate) : "", p.attendanceTime || ""].filter(Boolean).join(" ") || "—";
  const profissional = val(p.responsibleProfessional);

  function togglePend(key: PendKey) {
    const next = new Set(state.pends);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ pends: next });
  }

  return (
    <div className={cn(
      "rounded-lg border border-border/40 border-l-4 overflow-hidden",
      "print:border print:border-gray-300 print:border-l-4 print:rounded-none print:mb-2",
      accentCls,
    )}>

      {/* ── cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/20 print:bg-gray-50 print:px-2 print:py-1 border-b border-border/30 print:border-gray-200">
        <div className="min-w-0">
          <span className="font-bold text-sm text-foreground print:text-black">{p.full_name}</span>
          {p.diagnosis && (
            <span className="ml-2 text-xs text-muted-foreground print:text-gray-500 hidden sm:inline">— {p.diagnosis}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide",
            triage, "print:text-gray-800 print:bg-gray-100 print:border-gray-400",
          )}>
            {TRIAGE_LABEL[p.triage_level] ?? p.triage_level}
          </span>
          <span className="text-xs font-mono font-semibold text-foreground print:text-black bg-muted/40 print:bg-gray-100 border border-border/40 print:border-gray-300 rounded px-1.5 py-0.5">
            Leito {val(p.bed)}
          </span>
        </div>
      </div>

      {/* ── identificação + vitais ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto] gap-0 divide-y md:divide-y-0 md:divide-x divide-border/20 print:divide-x print:divide-gray-200">

        {/* identificação */}
        <div className="px-3 py-2 print:px-2 print:py-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-1">Identificação</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-x-4 gap-y-0.5 text-xs">
            <F label="Mãe"      value={val(p.motherName)} />
            <F label="Nasc."    value={fmtDate(p.birthDate)} />
            <F label="Idade"    value={p.age ? `${p.age} anos` : "—"} />
            <F label="Sexo"     value={p.sex === "M" ? "Masculino" : p.sex === "F" ? "Feminino" : val(p.sex)} />
            <F label="CPF"      value={val(p.cpf)} mono />
            <F label="RG"       value={val(p.rg)} mono />
            <F label="CNS"      value={val(p.cns)} mono />
            <F label="Setor"    value={val(p.sector).replace(/_/g, " ")} />
            <F label="Endereço" value={endereco(p)} className="col-span-2 sm:col-span-1 print:col-span-1" />
          </div>
        </div>

        {/* sinais vitais */}
        <div className="px-3 py-2 print:px-2 print:py-1 md:w-[290px] print:w-[275px]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-1">Sinais Vitais</p>
          <div className="flex flex-wrap gap-1 mb-1.5">
            <VitalCell label="PA"    value={pa}   icon={<Gauge       className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="FC"    value={fc}   alert={fcAlert}   icon={<HeartPulse  className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="FR"    value={fr}   icon={<Wind        className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="SpO₂"  value={spo2} alert={spo2Alert} icon={<Droplet     className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="Temp." value={temp} alert={tempAlert} icon={<Thermometer className="h-2 w-2 mr-0.5" />} />
            <VitalCell label="HGT"   value={hgt}  icon={<Activity    className="h-2 w-2 mr-0.5" />} />
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground print:text-gray-500">
            <span><span className="font-semibold uppercase">Data/Hora:</span> <span className="font-mono text-foreground print:text-black">{dataHora}</span></span>
            <span className="truncate"><span className="font-semibold uppercase">Prof.:</span> <span className="text-foreground print:text-black">{profissional}</span></span>
          </div>
        </div>
      </div>

      {/* ── SOAP ──────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 print:px-2 print:py-1 border-t border-border/20 print:border-gray-200">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-1.5">Evolução SOAP</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-4 gap-y-2">
          {(["S", "O", "A", "P"] as SoapKey[]).map(letter => (
            <SoapField
              key={letter}
              letter={letter}
              value={state[`soap_${letter.toLowerCase()}` as "soap_s" | "soap_o" | "soap_a" | "soap_p"]}
              onChange={v => onChange({ [`soap_${letter.toLowerCase()}`]: v } as Partial<RowState>)}
            />
          ))}
        </div>
      </div>

      {/* ── pendências estruturadas ────────────────────────────────────── */}
      <div className="px-3 py-2 print:px-2 print:py-1 border-t border-border/20 print:border-gray-200">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 mb-1.5">Pendências</p>

        {/* checkboxes */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 print:hidden">
          {PEND_ITEMS.map(item => (
            <label key={item.key} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={state.pends.has(item.key)}
                onChange={() => togglePend(item.key)}
                className="accent-primary h-3.5 w-3.5 rounded"
              />
              <span className={cn(
                "text-xs transition-colors",
                state.pends.has(item.key) ? "text-foreground font-semibold" : "text-muted-foreground",
              )}>
                {item.label}
              </span>
            </label>
          ))}
        </div>

        {/* print version checkboxes */}
        <div className="hidden print:flex flex-wrap gap-x-4 gap-y-0.5 mb-1.5">
          {PEND_ITEMS.map(item => (
            <span key={item.key} className="text-[8pt] text-black">
              ({state.pends.has(item.key) ? "✓" : " "}) {item.label}
            </span>
          ))}
        </div>

        {/* obs livre */}
        <input
          type="text"
          value={state.pend_obs}
          onChange={e => onChange({ pend_obs: e.target.value })}
          placeholder="Outras pendências / observações..."
          className="w-full bg-transparent border-b border-border/40 print:border-gray-400 outline-none text-xs text-foreground print:text-black placeholder:text-muted-foreground/50 py-0.5 print:hidden"
        />
        <div className="hidden print:block text-[8pt] text-black border-b border-gray-300 min-h-[14px]">
          {state.pend_obs || ""}
        </div>
      </div>

      {/* ── rodapé: estado + notificação ──────────────────────────────── */}
      <div className="flex items-center gap-4 px-3 py-1.5 print:px-2 print:py-1 border-t border-border/20 print:border-gray-200 bg-muted/5 print:bg-white">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400 shrink-0">Estado:</span>
          <select
            value={state.estado}
            onChange={e => onChange({ estado: e.target.value })}
            className="bg-transparent border border-border/40 rounded px-1.5 py-0.5 text-xs text-foreground print:hidden focus:outline-none focus:border-primary/60"
          >
            <option value="">—</option>
            {ESTADO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="hidden print:inline text-xs text-black font-semibold">
            {state.estado || "___________"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-400">Notificação:</span>
          <div className="flex gap-1 print:hidden">
            {(["ok", "pendente"] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ notif: state.notif === v ? null : v })}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors",
                  state.notif === v
                    ? v === "ok"
                      ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                      : "bg-red-500/20 border-red-500/60 text-red-300"
                    : "border-border/40 text-muted-foreground hover:bg-muted/30",
                )}
              >
                {v === "ok" ? "OK" : "Pend."}
              </button>
            ))}
          </div>
          <span className="hidden print:inline text-xs text-black">
            ({state.notif === "ok" ? "✓" : " "}) OK  ({state.notif === "pendente" ? "✓" : " "}) Pend.
          </span>
        </div>
      </div>
    </div>
  );
}

// ── field helper ───────────────────────────────────────────────────────────────

function F({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={cn("leading-snug", className)}>
      <span className="text-muted-foreground print:text-gray-500 text-[9px] font-semibold uppercase">{label}: </span>
      <span className={cn("text-foreground print:text-black", mono ? "font-mono" : "")}>{value}</span>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function ShiftHandover() {
  const { nurseName: nurse } = useNurse();
  const { activeUser } = useAuth();
  const staffId = activeUser?.id ?? 0;
  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  const [date,        setDate]      = useState(today);
  const [turno,       setTurno]     = useState<(typeof TURNOS)[number]>(detectTurno());
  const [responsible, setResp]      = useState(nurse);
  const [rowStates,   setRowStates] = useState<Record<number, RowState>>({});
  const [pendGerais,  setPendGerais] = useState("");
  const [obsGerais,   setObsGerais] = useState("");

  const { data: patients, isLoading } = useListPatients();

  const grouped = SECTORS.map(s => ({
    ...s,
    patients: (patients ?? [])
      .filter(p => p.sector === s.key)
      .sort((a, b) => (TRIAGE_SEVERITY[a.triage_level] ?? 99) - (TRIAGE_SEVERITY[b.triage_level] ?? 99)),
  }));

  const totalPatients = grouped.reduce((n, g) => n + g.patients.length, 0);
  const criticalCount = (patients ?? []).filter(p => p.triage_level === "red" || p.triage_level === "orange").length;

  const getRow    = (id: number, triage_level = ""): RowState => rowStates[id] ?? defaultRow(triage_level);
  const updateRow = (id: number, triage_level: string, patch: Partial<RowState>) =>
    setRowStates(prev => ({ ...prev, [id]: { ...getRow(id, triage_level), ...patch } }));

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 7mm 9mm; size: A4; }
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
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-5 max-w-5xl print:px-0 print:py-0 print:max-w-none">

          {/* ── título impressão ─────────────────────────────────────── */}
          <div className="hidden print:block mb-3">
            <PrintHeader
              baseUrl={import.meta.env.BASE_URL}
              title="Passagem de Plantão"
            />
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
                  <div className={cn(
                    "flex items-center justify-between gap-3 px-4 py-2 rounded-t-lg border",
                    sector.headerCls, "print:rounded-none",
                  )}>
                    <span className="font-bold text-sm tracking-wide">{sector.label}</span>
                    {sector.sub && <span className="text-xs opacity-70">({sector.sub})</span>}
                    <span className="ml-auto text-xs font-semibold opacity-80 tabular-nums">
                      {sector.patients.length} {sector.patients.length === 1 ? "paciente" : "pacientes"}
                    </span>
                  </div>

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
                          state={getRow(p.id, p.triage_level)}
                          onChange={patch => updateRow(p.id, p.triage_level, patch)}
                          staffId={staffId}
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
                      criticalCount > 0 ? "text-red-400 print:text-red-700" : "text-foreground print:text-black",
                    )}>{criticalCount}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1.5">
                    Pendências Gerais
                  </label>
                  <Textarea
                    className="text-sm min-h-[70px] print:hidden"
                    placeholder={"- \n- \n- "}
                    value={pendGerais}
                    onChange={e => setPendGerais(e.target.value)}
                  />
                  <div className="hidden print:block text-sm text-black space-y-1.5">
                    {pendGerais
                      ? pendGerais.split("\n").map((line, i) => <div key={i}>{line || "—"}</div>)
                      : [0, 1, 2].map(i => <div key={i} className="border-b border-gray-300 h-5" />)
                    }
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1.5">
                    Observações Importantes
                  </label>
                  <Textarea
                    className="text-sm min-h-[50px] print:hidden"
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
