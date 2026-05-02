import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Printer, ClipboardList } from "lucide-react";
import {
  useListPatients,
  useGetPatientPrescriptions,
  useGetPatientTasks,
  useGetPatientHistory,
} from "@workspace/api-client-react";
import type {
  Patient,
  PatientPrescription,
  PatientTask,
  PatientEvolution,
} from "@workspace/api-client-react/src/generated/api.schemas";
import { useNurse } from "@/hooks/use-nurse";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ── constants ────────────────────────────────────────────────────────────────

const SECTOR_ORDER = ["Sala Vermelha", "Observação Adulto", "Observação Pediátrica"] as const;

const SECTOR_META: Record<string, { emoji: string; headerCls: string }> = {
  "Sala Vermelha":          { emoji: "🔴", headerCls: "bg-red-950/70 border-red-700/60 text-red-200 print:bg-red-100 print:border-red-400 print:text-red-900" },
  "Observação Adulto":      { emoji: "🟡", headerCls: "bg-yellow-950/40 border-yellow-700/40 text-yellow-200 print:bg-yellow-50 print:border-yellow-400 print:text-yellow-900" },
  "Observação Pediátrica":  { emoji: "🟢", headerCls: "bg-green-950/40 border-green-700/40 text-green-200 print:bg-green-50 print:border-green-400 print:text-green-900" },
};

const TRIAGE_LABEL: Record<string, string> = {
  red: "Vermelho", orange: "Laranja", yellow: "Amarelo", green: "Verde", blue: "Azul",
};
const TRIAGE_SEVERITY: Record<string, number> = {
  red: 1, orange: 2, yellow: 3, green: 4, blue: 5,
};

const FIXED_PENDENCIAS = [
  "Coleta de exames",
  "Resultado de exames",
  "Exames externos agendados",
  "Reavaliação médica",
  "Medicação pendente",
] as const;

const TURNOS = ["Manhã", "Tarde", "Noite"] as const;

function detectTurno(): (typeof TURNOS)[number] {
  const h = new Date().getHours();
  if (h >= 7 && h < 13) return "Manhã";
  if (h >= 13 && h < 19) return "Tarde";
  return "Noite";
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseItems<T>(raw: string): T[] {
  try { return JSON.parse(raw) as T[]; } catch { return []; }
}

function fmtVital(v: number | undefined | null, decimals = 0) {
  if (!v) return "—";
  return decimals > 0 ? v.toFixed(decimals) : String(v);
}

// ── per-patient block ─────────────────────────────────────────────────────────

interface PatientBlockProps {
  patient: Patient;
  idx: number;
}

function PatientBlock({ patient, idx }: PatientBlockProps) {
  const [summary, setSummary]   = useState("");
  const [obs, setObs]           = useState("");
  const [notifType, setNotifType] = useState("");
  const [notifDone, setNotifDone] = useState<"realizado" | "pendente" | null>(null);
  const [fixedChecks, setFixedChecks] = useState<Record<string, boolean>>({});

  const { data: prescriptions } = useGetPatientPrescriptions(patient.id);
  const { data: tasks }         = useGetPatientTasks(patient.id);
  const { data: history }       = useGetPatientHistory(patient.id);

  const triageLabel = TRIAGE_LABEL[patient.status] ?? patient.status;

  // latest evolution for pre-filling summary
  const latestEvol: PatientEvolution | undefined = history?.[0];

  // condutas = active prescriptions (non-concluido)
  const activePrescriptions = (prescriptions ?? []).filter(
    (rx: PatientPrescription) => rx.status !== "concluido",
  );

  // pendências = pending / in_progress tasks
  const pendingTasks = (tasks ?? []).filter(
    (t: PatientTask) => t.status === "pendente" || t.status === "em_andamento",
  );

  const toggleFixed = (label: string) =>
    setFixedChecks(prev => ({ ...prev, [label]: !prev[label] }));

  const summaryPlaceholder = latestEvol?.note
    ? latestEvol.note
    : "Paciente em (estado geral), com quadro de _________.";

  return (
    <div
      className={`
        rounded-xl border border-border/40 bg-card/50 overflow-hidden
        print:border print:border-gray-400 print:bg-white print:rounded-none
        print:break-inside-avoid
        ${idx > 0 ? "mt-4 print:mt-6" : ""}
      `}
    >
      {/* patient header */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border/40 print:bg-gray-100 print:border-gray-300">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold text-base print:text-black">{patient.name}</span>
          {patient.bed && (
            <span className="text-sm text-muted-foreground print:text-gray-600">
              Leito: <strong className="text-foreground print:text-black">{patient.bed}</strong>
            </span>
          )}
          <span className="text-sm text-muted-foreground print:text-gray-600">
            Setor: <strong className="text-foreground print:text-black">{patient.sector}</strong>
          </span>
          <span className={`
            text-sm font-semibold px-2 py-0.5 rounded
            ${patient.status === "red" ? "text-red-400 bg-red-950/40 print:text-red-800 print:bg-red-100" : ""}
            ${patient.status === "orange" ? "text-orange-400 bg-orange-950/40 print:text-orange-800 print:bg-orange-100" : ""}
            ${patient.status === "yellow" ? "text-yellow-400 bg-yellow-950/40 print:text-yellow-800 print:bg-yellow-100" : ""}
            ${patient.status === "green" ? "text-green-400 bg-green-950/40 print:text-green-800 print:bg-green-100" : ""}
            ${patient.status === "blue" ? "text-blue-400 bg-blue-950/40 print:text-blue-800 print:bg-blue-100" : ""}
          `}>
            ● {triageLabel}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${patient.internmentStatus === "internado" ? "text-blue-400 bg-blue-950/40 print:text-blue-800 print:bg-blue-100" : "text-emerald-400 bg-emerald-950/30 print:text-emerald-800 print:bg-emerald-100"}`}>
            {patient.internmentStatus === "internado" ? "Internado" : "Não internado"}
          </span>
        </div>
        {patient.diagnosis && (
          <p className="text-sm text-muted-foreground print:text-gray-700 mt-1">
            Diagnóstico: <span className="text-foreground print:text-black font-medium">{patient.diagnosis}</span>
          </p>
        )}
      </div>

      <div className="p-4 space-y-4 print:space-y-3">

        {/* sinais vitais */}
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-2">
            Sinais Vitais
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {[
              { label: "PA", value: patient.systolicBp && patient.diastolicBp ? `${patient.systolicBp}/${patient.diastolicBp}` : "—", unit: "mmHg" },
              { label: "FC",  value: fmtVital(patient.heartRate),       unit: "bpm"   },
              { label: "FR",  value: fmtVital(patient.respiratoryRate), unit: "irpm"  },
              { label: "SpO₂", value: fmtVital(patient.spO2),          unit: "%"     },
              { label: "Temp", value: fmtVital(patient.temperature, 1), unit: "°C"   },
              { label: "HGT", value: fmtVital(patient.glucose, 1),      unit: "mg/dL" },
            ].map(sv => (
              <div key={sv.label} className="rounded-lg bg-muted/30 px-2 py-2 border border-border/30 print:border-gray-300 print:bg-gray-50">
                <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase font-semibold">{sv.label}</p>
                <p className="text-sm font-bold text-foreground print:text-black">{sv.value}</p>
                <p className="text-[10px] text-muted-foreground print:text-gray-400">{sv.unit}</p>
              </div>
            ))}
          </div>
        </section>

        {/* resumo clínico */}
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1.5">
            Resumo Clínico
          </h4>
          <Textarea
            className="text-sm min-h-[72px] print:hidden"
            placeholder={summaryPlaceholder}
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
          <div className="hidden print:block text-sm text-black border-b border-gray-300 min-h-[48px] pb-1">
            {summary || summaryPlaceholder}
          </div>
        </section>

        {/* condutas em andamento */}
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1.5">
            Condutas em Andamento
          </h4>
          {activePrescriptions.length > 0 ? (
            <ul className="space-y-1">
              {activePrescriptions.map((rx: PatientPrescription) => {
                const items = parseItems<string>(rx.items);
                return items.map((item, i) => (
                  <li key={`${rx.id}-${i}`} className="flex items-start gap-2 text-sm text-foreground print:text-black">
                    <span className="mt-0.5 shrink-0 text-muted-foreground print:text-gray-500">–</span>
                    <span>{item}</span>
                  </li>
                ));
              })}
            </ul>
          ) : (
            <>
              <div className="text-sm text-muted-foreground print:hidden italic">Nenhuma conduta ativa registrada</div>
              <div className="hidden print:block space-y-2">
                {[0, 1].map(i => (
                  <div key={i} className="border-b border-gray-300 h-5" />
                ))}
              </div>
            </>
          )}
        </section>

        {/* pendências */}
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-2">
            Pendências
          </h4>

          {/* system tasks */}
          {pendingTasks.length > 0 && (
            <div className="mb-2 space-y-1">
              {pendingTasks.map((t: PatientTask) => {
                const items = parseItems<{ label: string; done: boolean }>(t.items);
                const pending = items.filter(i => !i.done);
                return pending.map((item, i) => (
                  <div key={`${t.id}-${i}`} className="flex items-center gap-2 text-sm text-foreground print:text-black">
                    <span className="w-4 h-4 shrink-0 rounded border border-yellow-500/60 bg-yellow-900/20 print:border-gray-400 print:bg-white" />
                    <span>{item.label}</span>
                  </div>
                ));
              })}
            </div>
          )}

          {/* fixed template checkboxes */}
          <div className="space-y-1.5">
            {FIXED_PENDENCIAS.map(label => (
              <label
                key={label}
                className="flex items-center gap-2 text-sm cursor-pointer select-none group"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-yellow-500 print:accent-black"
                  checked={!!fixedChecks[label]}
                  onChange={() => toggleFixed(label)}
                />
                <span className="text-foreground print:text-black group-hover:text-yellow-300 transition-colors print:group-hover:text-black">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* notificações compulsórias */}
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-2">
            Notificações Compulsórias
          </h4>
          <div className="flex flex-wrap gap-4 mb-2">
            {(["realizado", "pendente"] as const).map(v => (
              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name={`notif-${patient.id}`}
                  className="accent-primary print:accent-black"
                  checked={notifDone === v}
                  onChange={() => setNotifDone(v)}
                />
                <span className="text-foreground print:text-black capitalize">
                  {v === "realizado" ? "Já realizadas" : "Pendentes"}
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground print:text-gray-600 shrink-0">Tipo:</span>
            <input
              type="text"
              className="flex-1 bg-transparent border-b border-border/50 print:border-gray-400 outline-none text-foreground print:text-black placeholder:text-muted-foreground text-sm py-0.5"
              placeholder="____________________________________________"
              value={notifType}
              onChange={e => setNotifType(e.target.value)}
            />
          </div>
        </section>

        {/* observações importantes */}
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1.5">
            Observações Importantes
          </h4>
          <Textarea
            className="text-sm min-h-[60px] print:hidden"
            placeholder="Registre observações clínicas relevantes para o próximo turno..."
            value={obs}
            onChange={e => setObs(e.target.value)}
          />
          <div className="hidden print:block text-sm text-black border-b border-gray-300 min-h-[40px] pb-1">
            {obs}
          </div>
        </section>

      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ShiftHandover() {
  const { nurse } = useNurse();
  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  const [date, setDate]         = useState(today);
  const [turno, setTurno]       = useState<(typeof TURNOS)[number]>(detectTurno());
  const [responsible, setResp]  = useState(nurse);

  const { data: patients, isLoading } = useListPatients();

  const grouped = SECTOR_ORDER.map(sector => ({
    sector,
    meta: SECTOR_META[sector],
    patients: (patients ?? [])
      .filter(p => p.sector === sector)
      .sort((a, b) => (TRIAGE_SEVERITY[a.status] ?? 99) - (TRIAGE_SEVERITY[b.status] ?? 99)),
  }));

  const totalPatients = grouped.reduce((n, g) => n + g.patients.length, 0);

  return (
    <>
      {/* print styles */}
      <style>{`
        @media print {
          @page { margin: 15mm 12mm; size: A4; }
          body { background: white !important; color: black !important; }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-background text-foreground print:bg-white print:text-black">

        {/* screen header */}
        <header className="print-hide border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <ClipboardList className="h-5 w-5 text-primary" />
              <h1 className="text-base sm:text-lg font-bold tracking-tight">Passagem de Plantão</h1>
            </div>
            <Button onClick={() => window.print()} className="shrink-0 gap-2">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-4xl print:px-0 print:py-0">

          {/* ── handover meta ─────────────────────────────────────────────── */}
          <div className="mb-6 rounded-xl border border-border/40 bg-card/50 p-5 print:border print:border-gray-400 print:rounded-none print:bg-white print:mb-4">

            {/* print title */}
            <div className="hidden print:block text-center mb-4 border-b border-gray-300 pb-3">
              <h1 className="text-xl font-bold text-black">UPA Breves — Passagem de Plantão</h1>
              <p className="text-sm text-gray-600">{totalPatients} paciente{totalPatients !== 1 ? "s" : ""} no sistema</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* data */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1">
                  Data
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-border/60 print:border-gray-400 outline-none text-foreground print:text-black placeholder:text-muted-foreground py-1 text-sm print:hidden"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
                <div className="hidden print:block text-sm text-black border-b border-gray-400 pb-1">{date}</div>
              </div>

              {/* turno */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1">
                  Turno
                </label>
                <div className="flex gap-3 print:hidden">
                  {TURNOS.map(t => (
                    <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="turno"
                        className="accent-primary"
                        checked={turno === t}
                        onChange={() => setTurno(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
                <div className="hidden print:flex gap-4 text-sm text-black">
                  {TURNOS.map(t => (
                    <span key={t}>( {turno === t ? "✓" : " "} ) {t}</span>
                  ))}
                </div>
              </div>

              {/* responsável */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground print:text-gray-500 mb-1">
                  Responsável
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-border/60 print:border-gray-400 outline-none text-foreground print:text-black placeholder:text-muted-foreground py-1 text-sm print:hidden"
                  placeholder="Nome do enfermeiro(a) responsável"
                  value={responsible}
                  onChange={e => setResp(e.target.value)}
                />
                <div className="hidden print:block text-sm text-black border-b border-gray-400 pb-1">
                  {responsible || "________________________________"}
                </div>
              </div>
            </div>
          </div>

          {/* ── loading ────────────────────────────────────────────────────── */}
          {isLoading && (
            <div className="text-center py-16 text-muted-foreground">
              Carregando pacientes...
            </div>
          )}

          {/* ── sector sections ────────────────────────────────────────────── */}
          {!isLoading && (
            <div className="space-y-8 print:space-y-6">
              {grouped.map(({ sector, meta, patients: sPatients }) => (
                <div key={sector}>
                  {/* sector header */}
                  <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border mb-4 print:rounded-none print:mb-3 ${meta.headerCls}`}>
                    <span className="text-base leading-none">{meta.emoji}</span>
                    <span className="font-bold text-sm tracking-wide">{sector}</span>
                    <span className="ml-auto text-xs font-semibold opacity-80">
                      {sPatients.length} {sPatients.length === 1 ? "paciente" : "pacientes"}
                    </span>
                  </div>

                  {sPatients.length === 0 ? (
                    <p className="text-sm text-muted-foreground print:text-gray-500 italic px-2 mb-2">
                      Nenhum paciente neste setor.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {sPatients.map((p, idx) => (
                        <PatientBlock key={p.id} patient={p} idx={idx} />
                      ))}
                    </div>
                  )}

                  {/* sector divider for print */}
                  <div className="hidden print:block border-t-2 border-gray-300 mt-4" />
                </div>
              ))}

              {totalPatients === 0 && (
                <div className="text-center py-12 text-muted-foreground print:text-gray-500">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum paciente registrado no sistema.</p>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </>
  );
}
