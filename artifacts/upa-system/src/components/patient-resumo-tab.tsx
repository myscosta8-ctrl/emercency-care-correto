import { format, formatDistanceToNow, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity, BedDouble, Clock, Stethoscope, ClipboardList,
  Pill, FlaskConical, User, AlertTriangle, Heart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Patient {
  id: number;
  full_name: string;
  birthDate?: string | null;
  age?: number | null;
  sex?: string | null;
  triage_level?: string | null;
  sector?: string | null;
  bed?: string | null;
  diagnosis?: string | null;
  careStatus?: string | null;
  responsibleProfessional?: string | null;
  createdAt: string;
  updatedAt: string;
  prontuarioNumber?: string | null;
  atendimentoNumber?: string | null;
  cpf?: string | null;
  cns?: string | null;
}

interface VitalRecord {
  bp?: string | null;
  hr?: number | null;
  rr?: number | null;
  temp?: number | null;
  spo2?: number | null;
  glucose?: number | null;
  pain?: number | null;
  createdAt: string;
}

interface EvolutionEntry {
  id: number;
  soapText: string;
  createdAt: string;
  userId: number;
  professionalCategory?: string | null;
  invalidado?: boolean;
}

interface PrescriptionEntry {
  id: number;
  medications: string;
  status: string;
  invalidado?: boolean;
  createdAt: string;
}

interface ExamRequest {
  id: number;
  status: string;
  laboratoriais?: string[] | null;
  imagem?: string[] | null;
  createdAt: string;
}

const TRIAGE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  red:    { label: "Vermelho — Emergência",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
  orange: { label: "Laranja — Muito Urgente",  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  yellow: { label: "Amarelo — Urgente",        color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  green:  { label: "Verde — Pouco Urgente",    color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
  blue:   { label: "Azul — Não Urgente",       color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30" },
};

function tempoInternacao(createdAt: string) {
  const now = new Date();
  const start = new Date(createdAt);
  const days = differenceInDays(now, start);
  const hours = differenceInHours(now, start) % 24;
  if (days === 0) return `${hours}h de atendimento`;
  return `${days}d ${hours}h de atendimento`;
}

export function PatientResumoTab({
  patient,
  vitals,
  history,
  prescriptions,
  examRequests,
  staffMap,
}: {
  patient: Patient;
  vitals?: VitalRecord[];
  history?: EvolutionEntry[];
  prescriptions?: PrescriptionEntry[];
  examRequests?: ExamRequest[];
  staffMap: Record<number, { name: string; role: string }>;
}) {
  const triage = patient.triage_level ? (TRIAGE_CFG[patient.triage_level] ?? null) : null;
  const latestVitals = vitals?.[0];

  const activeEvols  = (history ?? []).filter(e => !e.invalidado && e.soapText !== "Admissão inicial");
  const lastMedEvol  = activeEvols.find(e => e.professionalCategory === "medico" || (!e.professionalCategory && e.soapText.startsWith("EVOLUÇÃO")));
  const lastEvol     = activeEvols[0];
  const activeRx     = (prescriptions ?? []).filter(p => !p.invalidado && p.status !== "encerrada");
  const pendingExams = (examRequests ?? []).filter(e => e.status !== "laudado" && !(e as unknown as { invalidado?: boolean }).invalidado);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        {triage && (
          <div className={cn("px-3 py-1.5 rounded-lg border text-sm font-semibold", triage.bg, triage.color)}>
            {triage.label}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {tempoInternacao(patient.createdAt)}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 opacity-50" />
          Admissão: {format(new Date(patient.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Dados da Internação */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Dados da Internação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Prontuário</span>
              <span className="font-mono text-xs font-semibold">{patient.prontuarioNumber ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Nº Registro</span>
              <span className="font-mono text-xs font-semibold">{patient.atendimentoNumber ?? "—"}</span>
            </div>
            {patient.bed && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><BedDouble className="h-3 w-3" /> Leito</span>
                <span className="text-xs font-semibold">{patient.bed}</span>
              </div>
            )}
            {patient.sector && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Setor</span>
                <span className="text-xs font-medium">{patient.sector}</span>
              </div>
            )}
            {patient.responsibleProfessional && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Médico Resp.</span>
                <span className="text-xs font-medium">{patient.responsibleProfessional}</span>
              </div>
            )}
            {patient.diagnosis && (
              <div className="pt-1 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-0.5">Diagnóstico</p>
                <p className="text-xs font-medium italic">{patient.diagnosis}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos Sinais Vitais */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Últimos Sinais Vitais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!latestVitals ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum sinal vital registrado.</p>
            ) : (
              <div className="space-y-1.5">
                {[
                  { label: "PA",   value: latestVitals.bp,      unit: "mmHg", warn: false },
                  { label: "FC",   value: latestVitals.hr,      unit: "bpm",  warn: (latestVitals.hr ?? 0) > 100 || (latestVitals.hr ?? 999) < 50 },
                  { label: "FR",   value: latestVitals.rr,      unit: "/min", warn: (latestVitals.rr ?? 0) > 25 },
                  { label: "Temp", value: latestVitals.temp,    unit: "°C",   warn: (latestVitals.temp ?? 0) > 37.8 },
                  { label: "SpO₂", value: latestVitals.spo2,   unit: "%",    warn: (latestVitals.spo2 ?? 100) < 95 },
                  { label: "HGT",  value: latestVitals.glucose, unit: "mg/dL",warn: (latestVitals.glucose ?? 0) > 200 || (latestVitals.glucose ?? 999) < 60 },
                ].filter(x => x.value != null && x.value !== "" && x.value !== 0).map(x => (
                  <div key={x.label} className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">{x.label}</span>
                    <span className={cn("text-xs font-semibold font-mono", x.warn && "text-orange-400")}>
                      {x.value} <span className="text-muted-foreground font-normal text-[10px]">{x.unit}</span>
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/50 pt-1 border-t border-border/20">
                  {formatDistanceToNow(new Date(latestVitals.createdAt), { locale: ptBR, addSuffix: true })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prescrições e Exames */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Heart className="h-3.5 w-3.5" /> Status Assistencial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs text-muted-foreground">Prescrições Ativas</span>
              </div>
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded border",
                activeRx.length > 0
                  ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                  : "bg-muted/20 text-muted-foreground border-border/30"
              )}>
                {activeRx.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-xs text-muted-foreground">Exames Pendentes</span>
              </div>
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded border",
                pendingExams.length > 0
                  ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                  : "bg-muted/20 text-muted-foreground border-border/30"
              )}>
                {pendingExams.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs text-muted-foreground">Evoluções</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded border bg-blue-500/15 text-blue-400 border-blue-500/30">
                {activeEvols.length}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Última Evolução Médica */}
        {(lastMedEvol ?? lastEvol) && (
          <Card className="border-border/50 md:col-span-2 xl:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Stethoscope className="h-3.5 w-3.5" /> Última Evolução
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const ev = lastMedEvol ?? lastEvol;
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted-foreground">
                        {staffMap[ev!.userId]?.name ?? `Profissional ID ${ev!.userId}`}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(ev!.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-foreground/80 line-clamp-4 whitespace-pre-wrap">
                      {ev!.soapText}
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
