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
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
  getGetPatientHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity, ArrowLeft, Edit, Trash2, HeartPulse,
  Wind, Droplet, Clock, MapPin, BedDouble, RefreshCw,
  UserCheck, ClipboardList, Stethoscope,
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

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const deletePatient = useDeletePatient();
  const updateStatus = useUpdatePatientStatus();
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
        <div className="container mx-auto max-w-4xl">
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
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)} data-testid="button-edit">
              <Edit className="h-4 w-4 mr-1.5" /> Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)} data-testid="button-delete">
              <Trash2 className="h-4 w-4 mr-1.5" /> Alta/Remover
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left: Main Info + Vitals */}
          <div className="md:col-span-2 space-y-5">

            {/* Patient Info Card */}
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

            {/* Vitals */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Sinais Vitais
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setIsVitalsOpen(true)}
                  data-testid="button-update-vitals"
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  Atualizar Sinais Vitais
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Freq. Cardíaca</CardTitle>
                    <HeartPulse className="h-4 w-4 text-triage-red" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-mono font-bold" data-testid="text-heartRate">
                        {patient.heartRate > 0 ? patient.heartRate : "—"}
                      </span>
                      {patient.heartRate > 0 && <span className="text-sm text-muted-foreground">bpm</span>}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Freq. Respiratória</CardTitle>
                    <Wind className="h-4 w-4 text-triage-blue" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-mono font-bold" data-testid="text-respiratoryRate">
                        {patient.respiratoryRate > 0 ? patient.respiratoryRate : "—"}
                      </span>
                      {patient.respiratoryRate > 0 && <span className="text-sm text-muted-foreground">irpm</span>}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Glicemia</CardTitle>
                    <Droplet className="h-4 w-4 text-triage-yellow" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-mono font-bold" data-testid="text-glucose">
                        {patient.glucose > 0 ? patient.glucose : "—"}
                      </span>
                      {patient.glucose > 0 && <span className="text-sm text-muted-foreground">mg/dL</span>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Evolution History */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Histórico de Evolução
              </h3>
              {isLoadingHistory ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !history || history.length === 0 ? (
                <div className="text-center py-6 bg-card rounded-lg border border-border/50">
                  <p className="text-sm text-muted-foreground">Nenhuma evolução registrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(entry => (
                    <div key={entry.id} className="flex gap-3 p-3 bg-card rounded-lg border border-border/50">
                      <div className="shrink-0 w-0.5 self-stretch rounded-full bg-border/70" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-foreground">
                            {entry.responsible || "Sistema"}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(entry.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {(entry.heartRate || entry.respiratoryRate || entry.glucose) && (
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-1">
                            {entry.heartRate ? <span>FC: <strong className="text-foreground">{entry.heartRate}</strong> bpm</span> : null}
                            {entry.respiratoryRate ? <span>FR: <strong className="text-foreground">{entry.respiratoryRate}</strong> irpm</span> : null}
                            {entry.glucose ? <span>Gli: <strong className="text-foreground">{entry.glucose}</strong> mg/dL</span> : null}
                          </div>
                        )}
                        {entry.note && (
                          <p className="text-xs text-muted-foreground italic">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Admission Data + Quick Reclassification */}
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
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 opacity-50" />
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

            {/* Quick Reclassification */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Reclassificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={pendingStatus ?? patient.status}
                  onValueChange={setPendingStatus}
                >
                  <SelectTrigger data-testid="select-status-update">
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
                  data-testid="button-update-status"
                >
                  {updateStatus.isPending ? "Salvando..." : "Confirmar Reclassificação"}
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prontuário</DialogTitle>
            <DialogDescription>Atualize os dados clínicos e sinais vitais do paciente.</DialogDescription>
          </DialogHeader>
          <PatientForm patient={patient} onSuccess={() => setIsEditOpen(false)} onCancel={() => setIsEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Quick Vitals Update Dialog */}
      <Dialog open={isVitalsOpen} onOpenChange={setIsVitalsOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Atualizar Sinais Vitais</DialogTitle>
            <DialogDescription>
              Informe os valores atuais e o responsável pela aferição.
            </DialogDescription>
          </DialogHeader>
          <VitalsUpdateForm
            patient={patient}
            onSuccess={() => setIsVitalsOpen(false)}
            onCancel={() => setIsVitalsOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Alta AlertDialog */}
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
