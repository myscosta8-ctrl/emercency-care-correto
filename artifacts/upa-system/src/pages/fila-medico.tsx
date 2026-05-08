import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useUpdatePatientStatus,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import {
  Stethoscope, Clock, User, ArrowLeft, CheckCircle2, Eye,
  BedDouble, LogOut, AlertTriangle, Thermometer, Wind,
  Activity, ShieldAlert,
} from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/use-auth";
import { useFeatures } from "@/lib/features-context";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { useCriticalAlerts } from "@/hooks/use-critical-alerts";

// ── tipos ────────────────────────────────────────────────────────────────────

type CareStatus =
  | "Aguardando Triagem" | "Em Triagem" | "Aguardando Atendimento"
  | "Em Atendimento (Cons. 1)" | "Em Atendimento (Cons. 2)"
  | "Em Medicação" | "Aguardando Exames" | "Aguardando Reavaliação"
  | "Em Observação" | "Internado" | "Em Transferência" | "Alta";

// Manchester triage recommended max wait times (minutes)
const TRIAGE_MAX_WAIT: Record<string, number> = {
  red: 0, orange: 10, yellow: 30, green: 60, blue: 120,
};

const TRIAGE_CONFIG = {
  red:    { label: "Vermelho",  dot: "bg-red-500",    text: "text-red-400",    bg: "bg-red-500/15",    border: "border-l-red-500"    },
  orange: { label: "Laranja",   dot: "bg-orange-500", text: "text-orange-400", bg: "bg-orange-500/15", border: "border-l-orange-500" },
  yellow: { label: "Amarelo",   dot: "bg-yellow-400", text: "text-yellow-400", bg: "bg-yellow-400/15", border: "border-l-yellow-400" },
  green:  { label: "Verde",     dot: "bg-green-500",  text: "text-green-400",  bg: "bg-green-500/15",  border: "border-l-green-500"  },
  blue:   { label: "Azul",      dot: "bg-blue-500",   text: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-l-blue-500"   },
} as const;
const TRIAGE_ORDER: Record<string, number> = { red: 0, orange: 1, yellow: 2, green: 3, blue: 4 };

function minutesSince(iso: string) { return (Date.now() - new Date(iso).getTime()) / 60_000; }
function formatElapsed(iso: string): string {
  const m = Math.floor(minutesSince(iso));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}

// ── desfecho modal ────────────────────────────────────────────────────────────

interface DesfechoModalProps {
  patient: Patient | null;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
}

function DesfechoModal({ patient, onClose, onSuccess, userId }: DesfechoModalProps) {
  const { toast } = useToast();
  const update = useUpdatePatientStatus();
  const [status, setStatus] = useState<CareStatus>("Em Observação");
  const [sector, setSector] = useState("");

  useEffect(() => {
    if (patient) { setStatus("Em Observação"); setSector(patient.sector ?? ""); }
  }, [patient]);

  const OPCOES: { value: CareStatus; label: string; desc: string; color: string }[] = [
    { value: "Alta",                   label: "Alta",                    desc: "Paciente recebe alta médica",                    color: "text-green-400"  },
    { value: "Em Medicação",           label: "Em Medicação",            desc: "Aguardando/recebendo medicação prescrita",        color: "text-pink-400"   },
    { value: "Aguardando Exames",      label: "Aguardando Exames",       desc: "Aguardando resultado de exames solicitados",      color: "text-cyan-400"   },
    { value: "Aguardando Reavaliação", label: "Aguardando Reavaliação",  desc: "Aguardando reavaliação médica após conduta",      color: "text-amber-400"  },
    { value: "Em Observação",          label: "Em Observação",           desc: "Manter em observação no setor atual",            color: "text-orange-400" },
    { value: "Internado",              label: "Internação",              desc: "Internar o paciente",                            color: "text-red-400"    },
    { value: "Em Transferência",       label: "Transferência",           desc: "Transferir para outro serviço/hospital",         color: "text-purple-400" },
  ];

  const { featureAtiva } = useFeatures();
  const preAdultoAtivo = featureAtiva("setor_pre_adulto");
  const SETORES = [
    { value: "sala_vermelha",         label: "Sala Vermelha" },
    { value: "observacao_adulto",     label: "Observação Adulto" },
    { value: "observacao_pediatrica", label: "Observação Pediátrica" },
    ...(preAdultoAtivo ? [{ value: "observacao_pre_adulto", label: "Observação Pré-Adulto" }] : []),
  ];

  const handleConfirm = () => {
    if (!patient) return;
    update.mutate(
      {
        id: patient.id,
        data: {
          care_status: status as "Em Triagem" | "Aguardando Atendimento" | "Em Medicação" | "Aguardando Exames" | "Aguardando Reavaliação" | "Em Observação" | "Internado" | "Em Transferência" | "Alta",
          triage_level: patient.triage_level as "red" | "orange" | "yellow" | "green" | "blue",
          user_id: userId,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Desfecho registrado", description: `${patient.full_name} — ${status}` });
          onSuccess();
        },
        onError: () => toast({ title: "Erro ao registrar desfecho", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={!!patient} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Desfecho do Atendimento</DialogTitle>
          <DialogDescription>{patient?.full_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {OPCOES.map(op => (
            <button
              key={op.value}
              type="button"
              onClick={() => setStatus(op.value)}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                status === op.value
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border hover:bg-muted/30"
              )}
            >
              <div className={cn(
                "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                status === op.value ? "border-primary" : "border-muted-foreground/40"
              )}>
                {status === op.value && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className={cn("text-sm font-semibold", op.color)}>{op.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{op.desc}</p>
              </div>
            </button>
          ))}

          {(status === "Em Observação" || status === "Internado") && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setor de destino</label>
              <select
                value={sector}
                onChange={e => setSector(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                <BedDouble className="h-3 w-3 flex-shrink-0" />
                Leito definido pela enfermagem/recepção na Gestão de Leitos
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleConfirm}
              disabled={update.isPending}
            >
              {update.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── chamar paciente modal ─────────────────────────────────────────────────────

interface ChamarModalProps {
  patient: Patient | null;
  consultorio: 1 | 2;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
}

function ChamarModal({ patient, consultorio, onClose, onSuccess, userId }: ChamarModalProps) {
  const { toast } = useToast();
  const { activeUser } = useAuth();
  const update = useUpdatePatientStatus();
  const p = patient as (Patient & { alertaEnfermeiro?: string }) | null;

  const handleConfirm = () => {
    if (!patient) return;
    const careStatus = (`Em Atendimento (Cons. ${consultorio})`) as CareStatus;

    // Record call for the TV panel (non-blocking)
    fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: patient.id,
        patientName: patient.full_name,
        staffName: activeUser?.name ?? "",
        sector: `consultorio_${consultorio}`,
        localDisplay: `Consultório ${consultorio}`,
      }),
    }).catch(() => {});

    update.mutate(
      {
        id: patient.id,
        data: {
          care_status: careStatus as "Em Triagem" | "Aguardando Atendimento" | "Em Medicação" | "Aguardando Exames" | "Aguardando Reavaliação" | "Em Observação" | "Internado" | "Em Transferência" | "Alta",
          triage_level: patient.triage_level as "red" | "orange" | "yellow" | "green" | "blue",
          user_id: userId,
        },
      },
      {
        onSuccess: () => {
          toast({ title: `Paciente chamado para Consultório ${consultorio}`, description: patient.full_name });
          onSuccess();
        },
        onError: () => toast({ title: "Erro ao chamar paciente", variant: "destructive" }),
      }
    );
  };

  const tc = p ? (TRIAGE_CONFIG[p.triage_level as keyof typeof TRIAGE_CONFIG] ?? TRIAGE_CONFIG.blue) : null;

  return (
    <AlertDialog open={!!patient} onOpenChange={open => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Chamar para Consultório {consultorio}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>Confirma o atendimento de <strong>{p?.full_name}</strong> no Consultório {consultorio}?</p>
              {tc && (
                <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded", tc.bg, tc.text)}>
                  <span className={cn("h-2 w-2 rounded-full inline-block", tc.dot)} />
                  {tc.label}
                </span>
              )}
              {p?.alertaEnfermeiro && (
                <div className="flex items-start gap-2 mt-2 rounded-md border border-orange-500/50 bg-orange-950/30 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-200 font-medium">{p.alertaEnfermeiro}</p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={update.isPending}>
            {update.isPending ? "Chamando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── card de consultório ────────────────────────────────────────────────────────

interface ConsultorioCardProps {
  numero: 1 | 2;
  label: string;
  sub: string;
  patients: Patient[];
  onChamar: (p: Patient, c: 1 | 2) => void;
  onDesfecho: (p: Patient) => void;
}

function ConsultorioCard({ numero, label, sub, patients, onChamar, onDesfecho }: ConsultorioCardProps) {
  const emAtendimento = patients.filter(p => p.careStatus === `Em Atendimento (Cons. ${numero})`);
  const cor = numero === 1 ? "border-blue-500/50 bg-blue-950/20" : "border-purple-500/50 bg-purple-950/20";
  const headerCor = numero === 1 ? "text-blue-300" : "text-purple-300";

  return (
    <div className={cn("rounded-lg border overflow-hidden", cor)}>
      <div className={cn("px-4 py-2.5 border-b border-border/30 flex items-center gap-2", numero === 1 ? "bg-blue-900/20" : "bg-purple-900/20")}>
        <Stethoscope className={cn("h-4 w-4 shrink-0", headerCor)} />
        <div>
          <p className={cn("text-sm font-bold", headerCor)}>Consultório {numero}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className="ml-auto">
          {emAtendimento.length > 0
            ? <span className="text-xs font-mono font-bold text-green-400">{emAtendimento.length} em atend.</span>
            : <span className="text-xs text-muted-foreground/50">livre</span>}
        </div>
      </div>
      <div className="divide-y divide-border/20">
        {emAtendimento.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground/40">Nenhum paciente em atendimento</div>
        ) : (
          emAtendimento.map(p => {
            const tc = TRIAGE_CONFIG[p.triage_level as keyof typeof TRIAGE_CONFIG] ?? TRIAGE_CONFIG.blue;
            return (
              <div key={p.id} className={cn("flex items-center gap-3 px-4 py-3 border-l-4", tc.border)}>
                <div className="flex-1 min-w-0">
                  <Link href={`/patients/${p.id}`} className="text-sm font-semibold hover:underline truncate block">{p.full_name}</Link>
                  <p className="text-xs text-muted-foreground">{p.age}a · {tc.label}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onDesfecho(p)}>
                  <CheckCircle2 className="h-3 w-3" />
                  Desfecho
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── badge de alerta de sinal vital ────────────────────────────────────────────

interface VitalBadgeProps { icon: React.ReactNode; label: string; critical?: boolean }
function VitalBadge({ icon, label, critical }: VitalBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded",
      critical
        ? "bg-red-500/20 text-red-300 border border-red-500/40"
        : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
    )}>
      {icon}
      {label}
    </span>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function FilaMedicoPage() {
  const { activeUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: patients, isLoading } = useListPatients();
  const userId = activeUser?.id ?? 0;

  // Alertas críticos em tempo real (30s de polling)
  const { criticalPatientIds, criticalDetailMap } = useCriticalAlerts({
    alertsEnabled: false,
  });

  // Consultório do médico logado: "1", "2", "ambos" ou "" (sem restrição)
  const consultorioDoMedico = activeUser?.consultorio ?? "";
  const soCons1 = consultorioDoMedico === "1";
  const soCons2 = consultorioDoMedico === "2";
  const mostrarCons1 = !soCons2;
  const mostrarCons2 = !soCons1;

  const [chamarPatient, setChamarPatient] = useState<Patient | null>(null);
  const [chamarConsultorio, setChamarConsultorio] = useState<1 | 2>(soCons2 ? 2 : 1);
  const [desfechoPatient, setDesfechoPatient] = useState<Patient | null>(null);

  const aguardando = useMemo(() =>
    (patients ?? [])
      .filter(p => p.careStatus === "Aguardando Atendimento")
      .sort((a, b) => {
        // Pacientes com alerta do enfermeiro têm prioridade extra dentro do mesmo nível
        const aAlerta = !!((a as Patient & { alertaEnfermeiro?: string }).alertaEnfermeiro);
        const bAlerta = !!((b as Patient & { alertaEnfermeiro?: string }).alertaEnfermeiro);
        const aOrder = (TRIAGE_ORDER[a.triage_level] ?? 9) * 10 + (aAlerta ? 0 : 1);
        const bOrder = (TRIAGE_ORDER[b.triage_level] ?? 9) * 10 + (bAlerta ? 0 : 1);
        return aOrder - bOrder;
      }),
    [patients]
  );

  // Pacientes em triagem — ordenados por Manchester (classificados primeiro, depois por tempo de espera)
  const emTriagem = useMemo(() =>
    (patients ?? [])
      .filter(p => p.careStatus === "Em Triagem" || p.careStatus === "Aguardando Triagem")
      .sort((a, b) => {
        const aLvl = TRIAGE_ORDER[a.triage_level] ?? 99;
        const bLvl = TRIAGE_ORDER[b.triage_level] ?? 99;
        if (aLvl !== bLvl) return aLvl - bLvl;
        // Mesmo nível: mais antigo primeiro
        return new Date(a.careStatusChangedAt as string).getTime() - new Date(b.careStatusChangedAt as string).getTime();
      }),
    [patients]
  );

  const cons1Livre = !(patients ?? []).some(p => p.careStatus === "Em Atendimento (Cons. 1)");
  const cons2Livre = !(patients ?? []).some(p => p.careStatus === "Em Atendimento (Cons. 2)");

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
    setChamarPatient(null);
    setDesfechoPatient(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <RoleHeader title="Fila Médica" icon={<Stethoscope className="h-5 w-5 text-primary" />} />

      <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl space-y-6">

        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>

        {/* ── Consultórios ── */}
        <div className={cn("grid gap-4", mostrarCons1 && mostrarCons2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-lg")}>
          {mostrarCons1 && (
            <ConsultorioCard
              numero={1}
              label="Consultório 1"
              sub="Adulto / Clínica Geral"
              patients={patients ?? []}
              onChamar={(p, c) => { setChamarPatient(p); setChamarConsultorio(c); }}
              onDesfecho={setDesfechoPatient}
            />
          )}
          {mostrarCons2 && (
            <ConsultorioCard
              numero={2}
              label="Consultório 2"
              sub="Pediatria / Pré-Adulto"
              patients={patients ?? []}
              onChamar={(p, c) => { setChamarPatient(p); setChamarConsultorio(c); }}
              onDesfecho={setDesfechoPatient}
            />
          )}
        </div>

        {/* ── Fila em Triagem (informativo para os consultórios) ── */}
        {emTriagem.length > 0 && (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-card border-b border-border/30">
              <Activity className="h-4 w-4 text-violet-400 shrink-0" />
              <span className="text-sm font-bold text-violet-300">Em Triagem</span>
              <span className="text-xs text-muted-foreground/60 ml-1">— classificações em andamento pela enfermagem</span>
              <span className="ml-auto text-xs font-mono text-muted-foreground">{emTriagem.length} paciente{emTriagem.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-border/20">
              {emTriagem.map((p, idx) => {
                const hasLevel = !!p.triage_level && p.triage_level !== "blue" || p.triage_level === "blue";
                const classified = !!p.triage_level;
                const tc = classified ? (TRIAGE_CONFIG[p.triage_level as keyof typeof TRIAGE_CONFIG] ?? TRIAGE_CONFIG.blue) : null;
                const elapsed = formatElapsed(p.careStatusChangedAt as string);
                const maxWait = p.triage_level ? (TRIAGE_MAX_WAIT[p.triage_level] ?? 120) : 120;
                const waitMins = minutesSince(p.careStatusChangedAt as string);
                const isOverdue = classified && waitMins > maxWait;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 border-l-4",
                      tc ? tc.border : "border-l-violet-500/40",
                    )}
                  >
                    <div className="w-7 shrink-0 text-center text-xs font-bold text-muted-foreground/60">#{idx + 1}</div>
                    {tc ? (
                      <div className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded", tc.bg, tc.text)}>{tc.label}</div>
                    ) : (
                      <div className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">Aguard.</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link href={`/patients/${p.id}`} className="text-sm font-semibold hover:underline truncate block">{p.full_name}</Link>
                      <p className={cn(
                        "text-xs",
                        isOverdue ? "text-amber-400 font-semibold" : "text-muted-foreground",
                      )}>
                        {p.age}a · Aguardando há {elapsed}
                        {isOverdue && <span className="ml-1.5 text-[10px] font-bold uppercase">⚠ Prazo excedido</span>}
                      </p>
                    </div>
                    <span className="text-[10px] text-violet-400/60 italic shrink-0 hidden md:block">
                      {p.careStatus === "Aguardando Triagem" ? "Ag. triagem" : "Em triagem"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Fila de aguardando atendimento ── */}
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-card border-b border-border/30">
            <Clock className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="text-sm font-bold text-yellow-300">Aguardando Atendimento</span>
            <span className="ml-auto text-xs font-mono text-muted-foreground">{aguardando.length} paciente{aguardando.length !== 1 ? "s" : ""}</span>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border/20">
              {[0,1,2].map(i => <div key={i} className="h-14 bg-muted/10 animate-pulse" />)}
            </div>
          ) : aguardando.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground/50">
              <Clock className="h-6 w-6 mx-auto mb-2 opacity-30" />
              Nenhum paciente aguardando atendimento
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {aguardando.map((p, idx) => {
                const pt = p as Patient & { alertaEnfermeiro?: string };
                const tc = TRIAGE_CONFIG[p.triage_level as keyof typeof TRIAGE_CONFIG] ?? TRIAGE_CONFIG.blue;
                const elapsed = formatElapsed(p.careStatusChangedAt as string);
                const maxWait = TRIAGE_MAX_WAIT[p.triage_level] ?? 60;
                const waitMins = minutesSince(p.careStatusChangedAt as string);
                const isOverdue = waitMins > maxWait;
                const isCritical = criticalPatientIds.has(p.id);
                const vitalDetail = criticalDetailMap.get(p.id) ?? "";
                const hasNurseAlert = !!pt.alertaEnfermeiro;
                const hasAnyAlert = isCritical || hasNurseAlert;

                // Extrair alertas de sinais vitais do detail map
                const hasFever     = vitalDetail.includes("Temp");
                const hasRR        = vitalDetail.includes("FR");
                const hasSpo2      = vitalDetail.includes("SpO₂");
                const hasFC        = vitalDetail.includes("FC");
                const hasPAS       = vitalDetail.includes("PAS");

                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex flex-col gap-1 px-4 py-3 border-l-4 transition-colors",
                      tc.border,
                      hasAnyAlert && "bg-orange-950/10",
                      isCritical && p.triage_level === "red" && "bg-red-950/15 animate-pulse-subtle",
                    )}
                  >
                    {/* Linha principal */}
                    <div className="flex items-center gap-3">
                      <div className="w-7 shrink-0 text-center text-xs font-bold text-muted-foreground/60">#{idx + 1}</div>
                      <div className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded", tc.bg, tc.text)}>{tc.label}</div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/patients/${p.id}`} className="text-sm font-semibold hover:underline truncate block">{p.full_name}</Link>
                        <p className={cn(
                          "text-xs",
                          isOverdue
                            ? p.triage_level === "red" || p.triage_level === "orange"
                              ? "text-red-400 font-bold"
                              : "text-amber-400 font-semibold"
                            : "text-muted-foreground",
                        )}>
                          {p.age}a · Aguardando {elapsed}
                          {isOverdue && (
                            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide">
                              {p.triage_level === "red" ? "⚠ EMERGÊNCIA" : p.triage_level === "orange" ? "⚠ ACIMA DO PRAZO" : "⚠ Prazo excedido"}
                            </span>
                          )}
                        </p>
                      </div>
                      {p.prontuarioNumber && (
                        <span className="text-[10px] font-mono text-muted-foreground/60 hidden md:block shrink-0">{p.prontuarioNumber}</span>
                      )}
                      <div className="flex gap-1 shrink-0">
                        {mostrarCons1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              "h-7 text-xs gap-1",
                              cons1Livre
                                ? "border-green-500/50 text-green-400 hover:bg-green-500/10"
                                : "border-blue-500/40 text-blue-400 hover:bg-blue-500/10",
                            )}
                            onClick={() => { setChamarPatient(p); setChamarConsultorio(1); }}
                          >
                            <Stethoscope className="h-3 w-3" />
                            Cons. 1
                            {cons1Livre && <span className="text-[9px] opacity-80">livre</span>}
                          </Button>
                        )}
                        {mostrarCons2 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              "h-7 text-xs gap-1",
                              cons2Livre
                                ? "border-green-500/50 text-green-400 hover:bg-green-500/10"
                                : "border-purple-500/40 text-purple-400 hover:bg-purple-500/10",
                            )}
                            onClick={() => { setChamarPatient(p); setChamarConsultorio(2); }}
                          >
                            <Stethoscope className="h-3 w-3" />
                            Cons. 2
                            {cons2Livre && <span className="text-[9px] opacity-80">livre</span>}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Alerta do enfermeiro */}
                    {hasNurseAlert && (
                      <div className="ml-10 flex items-start gap-2 rounded-md border border-orange-500/50 bg-orange-950/30 px-3 py-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-orange-200 font-semibold leading-snug">{pt.alertaEnfermeiro}</p>
                      </div>
                    )}

                    {/* Badges de sinais vitais críticos */}
                    {isCritical && (
                      <div className="ml-10 flex flex-wrap gap-1.5 items-center">
                        {p.triage_level === "red" && !hasNurseAlert && (
                          <VitalBadge icon={<ShieldAlert className="h-2.5 w-2.5" />} label="Triagem Vermelha" critical />
                        )}
                        {hasFever && (
                          <VitalBadge icon={<Thermometer className="h-2.5 w-2.5" />} label={vitalDetail.match(/Temp [\d.]+°C/)?.[0] ?? "Febre"} critical />
                        )}
                        {hasSpo2 && (
                          <VitalBadge icon={<Activity className="h-2.5 w-2.5" />} label={vitalDetail.match(/SpO₂ \d+%/)?.[0] ?? "SpO₂ baixo"} critical />
                        )}
                        {hasFC && (
                          <VitalBadge icon={<Activity className="h-2.5 w-2.5" />} label={vitalDetail.match(/FC \d+ bpm/)?.[0] ?? "FC alta"} critical />
                        )}
                        {hasPAS && (
                          <VitalBadge icon={<Activity className="h-2.5 w-2.5" />} label={vitalDetail.match(/PAS \d+ mmHg/)?.[0] ?? "PA baixa"} critical />
                        )}
                        {hasRR && (
                          <VitalBadge icon={<Wind className="h-2.5 w-2.5" />} label={vitalDetail.match(/FR \d+ irpm/)?.[0] ?? "FR alta"} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <ChamarModal
        patient={chamarPatient}
        consultorio={chamarConsultorio}
        onClose={() => setChamarPatient(null)}
        onSuccess={handleSuccess}
        userId={userId}
      />
      <DesfechoModal
        patient={desfechoPatient}
        onClose={() => setDesfechoPatient(null)}
        onSuccess={handleSuccess}
        userId={userId}
      />
    </div>
  );
}
