import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useGetPatient,
  getGetPatientQueryKey,
  useDeletePatient,
  useUpdatePatientStatus,
  useGetPatientHistory,
  useGetPatientPrescriptions,
  useUpdatePrescriptionStatus,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
  getGetPatientHistoryQueryKey,
  getGetPatientPrescriptionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity, ArrowLeft, Edit, Trash2, HeartPulse,
  Wind, Droplet, Clock, MapPin, BedDouble, RefreshCw,
  UserCheck, ClipboardList, Stethoscope, Thermometer,
  Gauge, ClipboardCheck, CheckSquare, Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PatientForm } from "@/components/patient-form";
import { VitalsUpdateForm } from "@/components/vitals-update-form";
import { PrescriptionForm } from "@/components/prescription-form";
import { cn } from "@/lib/utils";

const TRIAGE_CONFIG = {
  red:    { label: "Vermelho",  sublabel: "Emergência",     colorClass: "text-triage-red",    borderClass: "border-triage-red/40",    bgClass: "bg-triage-red/10",    dotClass: "bg-triage-red" },
  orange: { label: "Laranja",   sublabel: "Muito Urgente",  colorClass: "text-triage-orange", borderClass: "border-triage-orange/40", bgClass: "bg-triage-orange/10", dotClass: "bg-triage-orange" },
  yellow: { label: "Amarelo",   sublabel: "Urgente",        colorClass: "text-triage-yellow", borderClass: "border-triage-yellow/40", bgClass: "bg-triage-yellow/10", dotClass: "bg-triage-yellow" },
  green:  { label: "Verde",     sublabel: "Pouco Urgente",  colorClass: "text-triage-green",  borderClass: "border-triage-green/40",  bgClass: "bg-triage-green/10",  dotClass: "bg-triage-green" },
  blue:   { label: "Azul",      sublabel: "Não Urgente",    colorClass: "text-triage-blue",   borderClass: "border-triage-blue/40",   bgClass: "bg-triage-blue/10",   dotClass: "bg-triage-blue" },
} as const;

type TriageKey = keyof typeof TRIAGE_CONFIG;

const TRIAGE_OPTIONS = [
  { value: "red",    label: "Vermelho — Emergência" },
  { value: "orange", label: "Laranja — Muito Urgente" },
  { value: "yellow", label: "Amarelo — Urgente" },
  { value: "green",  label: "Verde — Pouco Urgente" },
  { value: "blue",   label: "Azul — Não Urgente" },
] as const;

function VitalCard({ label, value, unit, icon, showZero = false }: {
  label: string;
  value?: number | null;
  unit: string;
  icon: React.ReactNode;
  showZero?: boolean;
}) {
  const hasValue = showZero ? value != null : (value != null && value > 0);
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="pb-3 px-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-mono font-bold">
            {hasValue ? value : "—"}
          </span>
          {hasValue && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function SoapBadge({ letter, colorClass }: { letter: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold shrink-0 mt-0.5 ${colorClass}`}>
      {letter}
    </span>
  );
}

export default function PatientDetail() {
  const [, params] = useRoute("/patients/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { data: patient, isLoading, isError } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) },
  });
  const { data: history, isLoading: isLoadingHistory } = useGetPatientHistory(id, {
    query: { enabled: !!id, queryKey: getGetPatientHistoryQueryKey(id) },
  });
  const { data: prescriptions, isLoading: isLoadingPrescriptions } = useGetPatientPrescriptions(id, {
    query: { enabled: !!id, queryKey: getGetPatientPrescriptionsQueryKey(id) },
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const deletePatient = useDeletePatient();
  const updateStatus = useUpdatePatientStatus();
  const updatePrescriptionStatus = useUpdatePrescriptionStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = () => {
    deletePatient.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
        toast({ title: "Alta registrada com sucesso" });
        setLocation("/");
      },
      onError: () => {
        toast({ title: "Não foi possível registrar a alta", variant: "destructive" });
        setIsDeleteOpen(false);
      },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate({ id, data: { status: newStatus as TriageKey } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
        toast({ title: "Reclassificação salva com sucesso" });
        setPendingStatus(null);
      },
      onError: () => toast({ title: "Não foi possível reclassificar a triagem", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto max-w-5xl">
          <Skeleton className="h-10 w-32 mb-6" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <Activity className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Paciente não encontrado</h2>
        <p className="text-muted-foreground mb-6">O registro solicitado não pôde ser carregado.</p>
        <Button asChild><Link href="/">Voltar ao Painel</Link></Button>
      </div>
    );
  }

  const cfg = TRIAGE_CONFIG[patient.status as TriageKey] ?? TRIAGE_CONFIG.blue;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold tracking-tight hidden sm:inline">UPA Breves — Gestão de Pacientes</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
              <Edit className="h-4 w-4 mr-1.5" /> Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Alta/Remover
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left column: 2/3 width */}
          <div className="md:col-span-2 space-y-5">

            {/* Patient Info */}
            <Card className={`border-l-4 ${cfg.borderClass} border-t-border/50 border-r-border/50 border-b-border/50`}>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">{patient.name}</h2>
                    <p className="text-sm mt-1 text-muted-foreground flex flex-wrap items-center gap-2">
                      <span>{patient.age} anos</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{patient.sector}</span>
                      {patient.bed && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />Leito {patient.bed}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg ${cfg.bgClass} border ${cfg.borderClass}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotClass} animate-pulse`} />
                    <div>
                      <div className={`text-sm font-bold ${cfg.colorClass}`}>{cfg.label}</div>
                      <div className="text-xs text-muted-foreground">{cfg.sublabel}</div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              {patient.diagnosis && (
                <CardContent>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Hipótese Diagnóstica</p>
                    <p className="text-base font-medium">{patient.diagnosis}</p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Vitals — 6-card grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Sinais Vitais
                </h3>
                <Button
                  size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                  onClick={() => setIsVitalsOpen(true)}
                  data-testid="button-update-vitals"
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  Registrar Evolução
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Row 1 */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1 px-1">PA (mmHg)</p>
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-2xl font-mono font-bold">
                          {patient.systolicBp > 0 && patient.diastolicBp > 0
                            ? <>{patient.systolicBp}<span className="text-muted-foreground text-lg">/</span>{patient.diastolicBp}</>
                            : "—"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <VitalCard
                  label="Freq. Cardíaca"
                  value={patient.heartRate}
                  unit="bpm"
                  icon={<HeartPulse className="h-4 w-4 text-triage-red" />}
                />
                <VitalCard
                  label="Freq. Respiratória"
                  value={patient.respiratoryRate}
                  unit="irpm"
                  icon={<Wind className="h-4 w-4 text-triage-blue" />}
                />
                <VitalCard
                  label="SpO₂"
                  value={patient.spO2}
                  unit="%"
                  icon={<span className="text-xs font-bold text-sky-400">O₂</span>}
                />
                <VitalCard
                  label="Temperatura"
                  value={patient.temperature}
                  unit="°C"
                  icon={<Thermometer className="h-4 w-4 text-triage-orange" />}
                />
                <VitalCard
                  label="Glicemia"
                  value={patient.glucose}
                  unit="mg/dL"
                  icon={<Droplet className="h-4 w-4 text-triage-yellow" />}
                />
              </div>
            </div>

            {/* Evolution History */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Histórico de Evolução de Enfermagem
              </h3>
              {isLoadingHistory ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : !history || history.length === 0 ? (
                <div className="text-center py-6 bg-card rounded-lg border border-border/50">
                  <p className="text-sm text-muted-foreground">Nenhuma evolução registrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map(entry => {
                    const hasVitals = entry.heartRate || entry.respiratoryRate || entry.spO2 || entry.temperature || entry.glucose || (entry.systolicBp && entry.diastolicBp);
                    const isInitial = entry.note === "Admissão inicial";
                    return (
                      <div key={entry.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                        {/* Entry Header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                          <span className="text-xs font-semibold">
                            {isInitial ? "📋 Admissão Inicial" : entry.responsible || "Sistema"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>

                        <div className="px-4 py-3 space-y-2.5">
                          {/* S — Subjetivo */}
                          {entry.subjective && (
                            <div className="flex gap-2.5 items-start">
                              <SoapBadge letter="S" colorClass="bg-blue-500/20 text-blue-400" />
                              <p className="text-sm text-muted-foreground italic">"{entry.subjective}"</p>
                            </div>
                          )}

                          {/* O — Objetivo: Vitals */}
                          {hasVitals && (
                            <div className="flex gap-2.5 items-start">
                              <SoapBadge letter="O" colorClass="bg-green-500/20 text-green-400" />
                              <div className="flex-1">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  {entry.systolicBp && entry.diastolicBp && (
                                    <span>PA: <strong className="text-foreground">{entry.systolicBp}/{entry.diastolicBp}</strong> mmHg</span>
                                  )}
                                  {entry.heartRate ? <span>FC: <strong className="text-foreground">{entry.heartRate}</strong> bpm</span> : null}
                                  {entry.respiratoryRate ? <span>FR: <strong className="text-foreground">{entry.respiratoryRate}</strong> irpm</span> : null}
                                  {entry.spO2 ? <span>SpO₂: <strong className="text-foreground">{entry.spO2}</strong>%</span> : null}
                                  {entry.temperature ? <span>Temp: <strong className="text-foreground">{entry.temperature}</strong>°C</span> : null}
                                  {entry.glucose ? <span>HGT: <strong className="text-foreground">{entry.glucose}</strong> mg/dL</span> : null}
                                </div>
                                {(entry.generalCondition || entry.consciousnessLevel || entry.painScale != null) && (
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                                    {entry.generalCondition && (
                                      <span>Estado: <strong className="text-foreground capitalize">{entry.generalCondition}</strong></span>
                                    )}
                                    {entry.consciousnessLevel && (
                                      <span>Consciência: <strong className="text-foreground capitalize">{entry.consciousnessLevel}</strong></span>
                                    )}
                                    {entry.painScale != null && entry.painScale > 0 && (
                                      <span>Dor: <strong className={cn(
                                        entry.painScale <= 3 ? "text-triage-green" :
                                        entry.painScale <= 6 ? "text-triage-yellow" : "text-triage-red"
                                      )}>{entry.painScale}/10</strong></span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* A — Avaliação */}
                          {entry.assessment && (
                            <div className="flex gap-2.5 items-start">
                              <SoapBadge letter="A" colorClass="bg-orange-500/20 text-orange-400" />
                              <p className="text-sm">{entry.assessment}</p>
                            </div>
                          )}

                          {/* P — Plano */}
                          {entry.plan && !isInitial && (
                            <div className="flex gap-2.5 items-start">
                              <SoapBadge letter="P" colorClass="bg-purple-500/20 text-purple-400" />
                              <p className="text-xs text-muted-foreground font-mono whitespace-pre-line">{entry.plan}</p>
                            </div>
                          )}

                          {/* Extra note */}
                          {entry.note && !isInitial && (
                            <p className="text-xs text-muted-foreground italic pl-7">{entry.note}</p>
                          )}

                          {/* Responsible (shown if not header) */}
                          {!isInitial && (
                            <p className="text-xs text-muted-foreground pl-7">
                              — {entry.responsible}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Prescription Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" /> Prescrição de Enfermagem
                </h3>
                <Button
                  size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                  onClick={() => setIsPrescriptionOpen(true)}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Nova Prescrição
                </Button>
              </div>

              {isLoadingPrescriptions ? (
                <div className="space-y-2">
                  {[1].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : !prescriptions || prescriptions.length === 0 ? (
                <div className="text-center py-6 bg-card rounded-lg border border-border/50">
                  <p className="text-sm text-muted-foreground">Nenhuma prescrição registrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prescriptions.map(rx => {
                    const items: string[] = (() => { try { return JSON.parse(rx.items); } catch { return []; } })();
                    const statusCfg = ({
                      pendente:     { label: "Pendente",     color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                      em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                      concluido:    { label: "Concluído",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
                    } as const)[rx.status as "pendente" | "em_andamento" | "concluido"] ?? { label: rx.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                    return (
                      <div key={rx.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", statusCfg.color)}>
                              {statusCfg.label}
                            </span>
                            {rx.scheduledTime && <span className="text-xs text-muted-foreground">{rx.scheduledTime}</span>}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(rx.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          <ul className="space-y-1.5 mb-3">
                            {items.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                {rx.status === "concluido"
                                  ? <CheckSquare className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                                  : <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                                <span className={cn(rx.status === "concluido" && "line-through text-muted-foreground")}>{item}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex items-center justify-between pt-2 border-t border-border/40">
                            <span className="text-xs text-muted-foreground">— {rx.responsible}</span>
                            {rx.status !== "concluido" && (
                              <div className="flex gap-1.5">
                                {rx.status === "pendente" && (
                                  <Button size="sm" variant="outline"
                                    className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => updatePrescriptionStatus.mutate(
                                      { id, prescriptionId: rx.id, data: { status: "em_andamento" } },
                                      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(id) }),
                                        onError: () => toast({ title: "Erro ao atualizar prescrição", variant: "destructive" }) }
                                    )}
                                  >Iniciar</Button>
                                )}
                                <Button size="sm" variant="outline"
                                  className="h-6 text-[10px] px-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                  onClick={() => updatePrescriptionStatus.mutate(
                                    { id, prescriptionId: rx.id, data: { status: "concluido" } },
                                    { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(id) }),
                                      onError: () => toast({ title: "Erro ao atualizar prescrição", variant: "destructive" }) }
                                  )}
                                >Concluir</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right column: 1/3 width */}
          <div className="space-y-5">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dados da Admissão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data/Hora de Entrada</p>
                    <p className="font-medium">{format(new Date(patient.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(patient.createdAt), "HH:mm 'h'", { locale: ptBR })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 opacity-40" />
                  <div>
                    <p className="text-xs text-muted-foreground">Última Atualização</p>
                    <p className="text-sm font-medium">
                      {formatDistanceToNow(new Date(patient.updatedAt), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Setor</p>
                    <p className="font-medium">{patient.sector}</p>
                  </div>
                </div>
                {patient.bed && (
                  <div className="flex items-start gap-3">
                    <BedDouble className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Leito</p>
                      <p className="font-medium">{patient.bed}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <UserCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Responsável</p>
                    <p className="font-medium">{patient.nurse || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reclassification */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Reclassificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={pendingStatus ?? patient.status} onValueChange={setPendingStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  disabled={!pendingStatus || pendingStatus === patient.status || updateStatus.isPending}
                  onClick={() => pendingStatus && handleStatusChange(pendingStatus)}
                >
                  {updateStatus.isPending ? "Salvando..." : "Confirmar Reclassificação"}
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      {/* Dialogs */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prontuário</DialogTitle>
            <DialogDescription>Atualize os dados clínicos do paciente.</DialogDescription>
          </DialogHeader>
          <PatientForm patient={patient} onSuccess={() => setIsEditOpen(false)} onCancel={() => setIsEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isVitalsOpen} onOpenChange={setIsVitalsOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Evolução de Enfermagem</DialogTitle>
            <DialogDescription>Preencha o SOAP e registre a evolução do paciente.</DialogDescription>
          </DialogHeader>
          <VitalsUpdateForm
            patient={patient}
            onSuccess={() => setIsVitalsOpen(false)}
            onCancel={() => setIsVitalsOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isPrescriptionOpen} onOpenChange={setIsPrescriptionOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Prescrição de Enfermagem</DialogTitle>
            <DialogDescription>Selecione as intervenções e defina o status desta prescrição.</DialogDescription>
          </DialogHeader>
          <PrescriptionForm
            patientId={id}
            patientName={patient.name}
            onSuccess={() => setIsPrescriptionOpen(false)}
            onCancel={() => setIsPrescriptionOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alta / Remoção do Paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma a alta ou remoção de <strong>{patient.name}</strong> do sistema? O registro será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePatient.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePatient.isPending}
            >
              {deletePatient.isPending ? "Processando..." : "Confirmar Alta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
