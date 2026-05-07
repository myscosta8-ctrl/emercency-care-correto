import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useUpdatePatientStatus,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { Stethoscope, Clock, User, ArrowLeft, CheckCircle2, Eye, BedDouble, LogOut } from "lucide-react";
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

// ── tipos ────────────────────────────────────────────────────────────────────

type CareStatus =
  | "Em Triagem" | "Aguardando Atendimento"
  | "Em Atendimento (Cons. 1)" | "Em Atendimento (Cons. 2)"
  | "Em Medicação" | "Aguardando Exames" | "Aguardando Reavaliação"
  | "Em Observação" | "Internado" | "Em Transferência" | "Alta";

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
  const update = useUpdatePatientStatus();

  const handleConfirm = () => {
    if (!patient) return;
    const careStatus = (`Em Atendimento (Cons. ${consultorio})`) as CareStatus;
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

  return (
    <AlertDialog open={!!patient} onOpenChange={open => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Chamar para Consultório {consultorio}</AlertDialogTitle>
          <AlertDialogDescription>
            Confirma o atendimento de <strong>{patient?.full_name}</strong> no Consultório {consultorio}?
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

// ── main ──────────────────────────────────────────────────────────────────────

export default function FilaMedicoPage() {
  const { activeUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: patients, isLoading } = useListPatients();
  const userId = activeUser?.id ?? 0;

  // Consultório do médico logado: "1", "2", "ambos" ou "" (sem restrição)
  const consultorioDoMedico = activeUser?.consultorio ?? "";
  const soCons1 = consultorioDoMedico === "1";
  const soCons2 = consultorioDoMedico === "2";
  const mostrarCons1 = !soCons2;
  const mostrarCons2 = !soCons1;

  const [chamarPatient, setChamarPatient] = useState<Patient | null>(null);
  const [chamarConsultorio, setChamarConsultorio] = useState<1 | 2>(soCons2 ? 2 : 1);
  const [desfechoPatient, setDesfechoPatient] = useState<Patient | null>(null);

  const aguardando = (patients ?? [])
    .filter(p => p.careStatus === "Aguardando Atendimento")
    .sort((a, b) => (TRIAGE_ORDER[a.triage_level] ?? 9) - (TRIAGE_ORDER[b.triage_level] ?? 9));

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
                const tc = TRIAGE_CONFIG[p.triage_level as keyof typeof TRIAGE_CONFIG] ?? TRIAGE_CONFIG.blue;
                const elapsed = formatElapsed(p.careStatusChangedAt as string);
                return (
                  <div key={p.id} className={cn("flex items-center gap-3 px-4 py-3 border-l-4 hover:bg-muted/10 transition-colors", tc.border)}>
                    <div className="w-7 shrink-0 text-center text-xs font-bold text-muted-foreground/60">#{idx + 1}</div>
                    <div className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded", tc.bg, tc.text)}>{tc.label}</div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/patients/${p.id}`} className="text-sm font-semibold hover:underline truncate block">{p.full_name}</Link>
                      <p className="text-xs text-muted-foreground">{p.age}a · Aguardando {elapsed}</p>
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
