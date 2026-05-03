import { useState } from "react";
import { usePode } from "@/hooks/use-pode";
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
  useGetPatientTasks,
  useUpdateTaskStatus,
  useGetPatientNotifications,
  useDeletePatientNotification,
  useUpdatePatientNotification,
  useGetPatientVitals,
  useListStaff,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
  getGetPatientHistoryQueryKey,
  getGetPatientPrescriptionsQueryKey,
  getGetPatientTasksQueryKey,
  getGetPatientNotificationsQueryKey,
  getGetPatientVitalsQueryKey,
} from "@workspace/api-client-react";
import type { PatientNotification } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity, ArrowLeft, Edit, Trash2, HeartPulse,
  Wind, Droplet, Clock, MapPin, BedDouble, RefreshCw,
  UserCheck, ClipboardList, Stethoscope, Thermometer,
  Gauge, ClipboardCheck, CheckSquare, Square, ListTodo, Pencil, UserCircle, Printer,
  Bell, Trash, Download, FileDown, Calendar, Building2,
} from "lucide-react";
import { downloadSinanPdf, generateSinanPdfBlob, downloadIdentificacaoPdf } from "@/lib/pdf-fill";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useNurse } from "@/hooks/use-nurse";
import { PatientForm } from "@/components/patient-form";
import { VitalsUpdateForm } from "@/components/vitals-update-form";
import { VitalsRecordForm } from "@/components/vitals-record-form";
import { PrescriptionForm } from "@/components/prescription-form";
import { TasksForm } from "@/components/tasks-form";
import { NotificationForm } from "@/components/notification-form";
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

function VitalCard({ label, value, unit, icon, showZero = false, alertClass = "" }: {
  label: string;
  value?: number | null;
  unit: string;
  icon: React.ReactNode;
  showZero?: boolean;
  alertClass?: string;
}) {
  const hasValue = showZero ? value != null : (value != null && value > 0);
  const isAlert  = hasValue && alertClass !== "";
  return (
    <Card className={cn(
      "border-border/50 bg-card/50 transition-colors",
      isAlert && alertClass.includes("red")    ? "border-red-500/50 bg-red-950/20"    : "",
      isAlert && alertClass.includes("orange") ? "border-orange-500/40 bg-orange-950/10" : "",
      isAlert && alertClass.includes("yellow") ? "border-yellow-500/30" : "",
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="pb-3 px-4">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-3xl font-mono font-bold", isAlert ? alertClass : "")}>
            {hasValue ? value : "—"}
          </span>
          {hasValue && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {isAlert && alertClass.includes("red") && (
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Atenção</span>
        )}
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
  const { data: tasks, isLoading: isLoadingTasks } = useGetPatientTasks(id, {
    query: { enabled: !!id, queryKey: getGetPatientTasksQueryKey(id) },
  });
  const { data: notifications, isLoading: isLoadingNotifications } = useGetPatientNotifications(id, {
    query: { enabled: !!id, queryKey: getGetPatientNotificationsQueryKey(id) },
  });
  const { data: vitals } = useGetPatientVitals(id, {
    query: { enabled: !!id, queryKey: getGetPatientVitalsQueryKey(id) },
  });
  const latestVitals = vitals?.[0];

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);
  const [isVitalsRecordOpen, setIsVitalsRecordOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<PatientNotification | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const { nurseName, setNurseName } = useNurse();
  const [isEditingNurse, setIsEditingNurse] = useState(false);
  const [nurseInput, setNurseInput] = useState("");
  const [downloadingFicha, setDownloadingFicha] = useState(false);

  const pode = usePode();
  const podeGerarPDF = pode("gerar_pdf", "sinan_pdf");
  const deletePatient = useDeletePatient();
  const updateStatus = useUpdatePatientStatus();
  const updatePrescriptionStatus = useUpdatePrescriptionStatus();
  const { data: staffList } = useListStaff();
  const staffMap = Object.fromEntries((staffList ?? []).map(s => [s.id, s]));
  const deleteNotification = useDeletePatientNotification();
  const updateNotification = useUpdatePatientNotification();
  const updateTaskStatus = useUpdateTaskStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);

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
    updateStatus.mutate({ id, data: { triage_level: newStatus as TriageKey } }, {
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

  const cfg = TRIAGE_CONFIG[patient.triage_level as TriageKey] ?? TRIAGE_CONFIG.blue;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; color: black !important; font-size: 10pt; }
          .print-hide { display: none !important; }
          .print-only { display: block !important; }
          .no-print { display: none !important; }
          .print-section { margin-bottom: 8pt; padding-bottom: 6pt; border-bottom: 1px solid #d1d5db; }
          .print-table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
          .print-table th, .print-table td { border: 1px solid #9ca3af; padding: 3px 6px; font-size: 9pt; }
          .print-table th { background: #e5e7eb; font-weight: 700; }
          .soap-entry { margin-bottom: 8pt; padding: 6pt; border: 1px solid #d1d5db; page-break-inside: avoid; }
          .soap-entry-header { background: #f3f4f6; padding: 3px 6px; margin-bottom: 4pt; border-bottom: 1px solid #d1d5db; }
          .soap-badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 3px; font-size: 9pt; font-weight: 700; margin-right: 4px; }
          .badge-s { background: #dbeafe; color: #1e40af; }
          .badge-o { background: #dcfce7; color: #166534; }
          .badge-a { background: #ffedd5; color: #9a3412; }
          .badge-p { background: #f3e8ff; color: #6b21a8; }
          .print-sig-area { margin-top: 20pt; border-top: 1px solid #9ca3af; padding-top: 8pt; display: flex; justify-content: flex-end; }
          .print-sig-box { text-align: center; border-top: 1px solid black; min-width: 200px; padding-top: 4pt; font-size: 9pt; }
        }
        .print-only { display: none; }
      `}</style>

      <header className="print-hide border-b border-border bg-card sticky top-0 z-10">
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
            {isEditingNurse ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={e => {
                  e.preventDefault();
                  if (nurseInput.trim()) setNurseName(nurseInput.trim());
                  setIsEditingNurse(false);
                }}
              >
                <Input
                  autoFocus
                  value={nurseInput}
                  onChange={e => setNurseInput(e.target.value)}
                  placeholder="Seu nome"
                  className="h-8 w-40 text-sm"
                  onBlur={() => {
                    if (nurseInput.trim()) setNurseName(nurseInput.trim());
                    setIsEditingNurse(false);
                  }}
                  onKeyDown={e => e.key === "Escape" && setIsEditingNurse(false)}
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => { setNurseInput(nurseName); setIsEditingNurse(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors min-h-[36px]"
                title="Clique para alterar o profissional"
              >
                <UserCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline max-w-[120px] truncate">{nurseName || "Profissional"}</span>
                <Pencil className="h-3 w-3 opacity-50 shrink-0" />
              </button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()} className="print-hide hidden sm:flex">
              <Printer className="h-4 w-4 mr-1.5" /> Imprimir Evolução
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="print-hide hidden sm:flex"
              disabled={downloadingFicha || !patient || !pode("gerar_pdf")}
              onClick={async () => {
                if (!patient) return;
                setDownloadingFicha(true);
                try {
                  await downloadIdentificacaoPdf({
                    full_name: patient.full_name,
                    birthDate: patient.birthDate,
                    age: patient.age,
                    sex: patient.sex,
                    motherName: patient.motherName,
                    cns: patient.cns,
                    cpf: patient.cpf,
                    rg: patient.rg,
                    phone: patient.phone,
                    email: patient.email,
                    street: patient.address ?? "",
                    addressNumber: "",
                    addressComplement: "",
                    neighborhood: "",
                    city: patient.municipioNotificacao ?? "",
                    addressState: "",
                    zipCode: "",
                    weight: 0,
                    height: 0,
                    symptoms: patient.symptoms,
                    symptomOnsetDate: patient.symptomOnsetDate,
                    triageStatus: patient.triage_level,
                    attendanceDate: patient.attendanceDate,
                    attendanceTime: patient.attendanceTime,
                    healthUnit: patient.healthUnit,
                    responsibleProfessional: patient.responsibleProfessional,
                  });
                } catch {
                  toast({ title: "Erro ao gerar ficha", variant: "destructive" });
                } finally {
                  setDownloadingFicha(false);
                }
              }}
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              {downloadingFicha ? "Gerando…" : "Ficha ID"}
            </Button>
            {pode("editar_paciente") && (
              <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                <Edit className="h-4 w-4 mr-1.5" /> Editar
              </Button>
            )}
            {pode("excluir_paciente") && (
              <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Alta/Remover
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="no-print flex-1 container mx-auto px-4 py-8 max-w-5xl pb-28 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left column: 2/3 width */}
          <div className="md:col-span-2 space-y-5">

            {/* Patient Info */}
            <Card className={`border-l-4 ${cfg.borderClass} border-t-border/50 border-r-border/50 border-b-border/50`}>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">{patient.full_name}</h2>
                    <p className="text-sm mt-1 text-muted-foreground flex flex-wrap items-center gap-2">
                      <span>{patient.age} anos</span>
                      {patient.sex && patient.sex !== "O" && (
                        <><span>&bull;</span><span>{patient.sex === "M" ? "Masculino" : "Feminino"}</span></>
                      )}
                      {patient.birthDate && (
                        <><span>&bull;</span><span>{patient.birthDate.split("-").reverse().join("/")}</span></>
                      )}
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
              {(patient.diagnosis || patient.symptoms || patient.symptomOnsetDate) && (
                <CardContent className="space-y-2">
                  {patient.diagnosis && (
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Hipótese Diagnóstica</p>
                      <p className="text-base font-medium">{patient.diagnosis}</p>
                    </div>
                  )}
                  {(patient.symptoms || patient.symptomOnsetDate) && (
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-1">
                      {patient.symptomOnsetDate && (
                        <p className="text-xs text-muted-foreground">
                          Início dos sintomas: <span className="font-medium text-foreground">{patient.symptomOnsetDate.split("-").reverse().join("/")}</span>
                        </p>
                      )}
                      {patient.symptoms && (
                        <p className="text-sm">{patient.symptoms}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Vitals — 6-card grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Sinais Vitais
                </h3>
                <div className="flex items-center gap-2">
                  {pode("registrar_sinais_vitais") && (
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                      onClick={() => setIsVitalsRecordOpen(true)}
                    >
                      <Activity className="h-3.5 w-3.5" />
                      Registrar SVs
                    </Button>
                  )}
                  {pode("registrar_evolucao") && (
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                      onClick={() => setIsVitalsOpen(true)}
                      data-testid="button-update-vitals"
                    >
                      <Stethoscope className="h-3.5 w-3.5" />
                      Registrar Evolução
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Row 1 */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1 px-1">PA (mmHg)</p>
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
                        {(() => {
                          const bp = latestVitals?.bp ?? "";
                          const [sys, dia] = bp.split("/").map(Number);
                          const valid = sys > 0 && dia > 0;
                          return (
                            <span className={cn(
                              "text-2xl font-mono font-bold",
                              valid && (sys > 180 || sys < 80) ? "text-red-400" :
                              valid && (sys > 160 || sys < 90) ? "text-orange-400" : ""
                            )}>
                              {valid ? <>{sys}<span className="text-muted-foreground text-lg">/</span>{dia}</> : "—"}
                            </span>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <VitalCard
                  label="Freq. Cardíaca"
                  value={latestVitals?.hr ?? 0}
                  unit="bpm"
                  icon={<HeartPulse className="h-4 w-4 text-triage-red" />}
                  alertClass={
                    (latestVitals?.hr ?? 0) > 120 || (latestVitals?.hr ?? 0) < 50 ? "text-red-400" :
                    (latestVitals?.hr ?? 0) > 100 || ((latestVitals?.hr ?? 0) > 0 && (latestVitals?.hr ?? 0) < 60) ? "text-orange-400" : ""
                  }
                />
                <VitalCard
                  label="Freq. Respiratória"
                  value={latestVitals?.rr ?? 0}
                  unit="irpm"
                  icon={<Wind className="h-4 w-4 text-triage-blue" />}
                  alertClass={
                    (latestVitals?.rr ?? 0) > 25 || ((latestVitals?.rr ?? 0) > 0 && (latestVitals?.rr ?? 0) < 10) ? "text-red-400" :
                    (latestVitals?.rr ?? 0) > 20 || ((latestVitals?.rr ?? 0) > 0 && (latestVitals?.rr ?? 0) < 12) ? "text-orange-400" : ""
                  }
                />
                <VitalCard
                  label="SpO₂"
                  value={latestVitals?.spo2 ?? 0}
                  unit="%"
                  icon={<span className="text-xs font-bold text-sky-400">O₂</span>}
                  alertClass={
                    (latestVitals?.spo2 ?? 0) > 0 && (latestVitals?.spo2 ?? 0) < 90 ? "text-red-400" :
                    (latestVitals?.spo2 ?? 0) > 0 && (latestVitals?.spo2 ?? 0) < 94 ? "text-orange-400" :
                    (latestVitals?.spo2 ?? 0) > 0 && (latestVitals?.spo2 ?? 0) < 97 ? "text-yellow-400" : ""
                  }
                />
                <VitalCard
                  label="Temperatura"
                  value={latestVitals?.temp ?? 0}
                  unit="°C"
                  icon={<Thermometer className="h-4 w-4 text-triage-orange" />}
                  alertClass={
                    (latestVitals?.temp ?? 0) >= 39   ? "text-red-400" :
                    (latestVitals?.temp ?? 0) >= 38   ? "text-orange-400" :
                    (latestVitals?.temp ?? 0) > 37.5  ? "text-yellow-400" :
                    (latestVitals?.temp ?? 0) > 0 && (latestVitals?.temp ?? 0) < 36 ? "text-blue-400" : ""
                  }
                />
                <VitalCard
                  label="Glicemia"
                  value={latestVitals?.glucose ?? 0}
                  unit="mg/dL"
                  icon={<Droplet className="h-4 w-4 text-triage-yellow" />}
                  alertClass={
                    (latestVitals?.glucose ?? 0) > 400 || ((latestVitals?.glucose ?? 0) > 0 && (latestVitals?.glucose ?? 0) < 60) ? "text-red-400" :
                    (latestVitals?.glucose ?? 0) > 250 || ((latestVitals?.glucose ?? 0) > 0 && (latestVitals?.glucose ?? 0) < 70) ? "text-orange-400" : ""
                  }
                />
              </div>
            </div>

            {/* Evolution History */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Histórico de Evolução de Enfermagem
                </h3>
                {history && history.filter(e => e.soapText !== "Admissão inicial").length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                    {history.filter(e => e.soapText !== "Admissão inicial").length}
                  </span>
                )}
              </div>
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
                    const isInitial = entry.soapText === "Admissão inicial";
                    return (
                      <div key={entry.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                          <span className="text-xs font-semibold">
                            {isInitial ? "📋 Admissão Inicial" : `Profissional ID ${entry.userId}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          {isInitial ? (
                            <p className="text-sm text-muted-foreground italic">Paciente admitido na unidade.</p>
                          ) : (
                            <p className="text-sm font-mono whitespace-pre-wrap text-foreground/90">{entry.soapText}</p>
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
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" /> Prescrição de Enfermagem
                  </h3>
                  {prescriptions && prescriptions.filter(p => p.status !== "concluido").length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      {prescriptions.filter(p => p.status !== "concluido").length}
                    </span>
                  )}
                </div>
                {pode("registrar_prescricao") && (
                  <Button
                    size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                    onClick={() => setIsPrescriptionOpen(true)}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Nova Prescrição
                  </Button>
                )}
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
                    const statusCfg = ({
                      pendente:     { label: "Pendente",     color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                      em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                      concluido:    { label: "Concluído",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
                    } as const)[rx.status as "pendente" | "em_andamento" | "concluido"] ?? { label: rx.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                    const typeCfg = rx.type === "medical"
                      ? { label: "Médica",      color: "bg-purple-500/10 text-purple-400 border-purple-500/30" }
                      : { label: "Enfermagem",  color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
                    const staffName = staffMap[rx.userId]?.name ?? (rx.userId > 0 ? `#${rx.userId}` : "—");
                    return (
                      <div key={rx.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", typeCfg.color)}>
                              {typeCfg.label}
                            </span>
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", statusCfg.color)}>
                              {statusCfg.label}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(rx.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          <pre className={cn(
                            "text-sm whitespace-pre-wrap font-sans mb-3",
                            rx.status === "concluido" && "line-through text-muted-foreground"
                          )}>{rx.content}</pre>
                          <div className="flex items-center justify-between pt-2 border-t border-border/40">
                            <span className="text-xs text-muted-foreground">— {staffName}</span>
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

            {/* Tasks / Pendências Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-primary" /> Pendências
                  </h3>
                  {tasks && tasks.filter(t => t.status !== "concluido").length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      {tasks.filter(t => t.status !== "concluido").length}
                    </span>
                  )}
                </div>
                <Button
                  size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                  onClick={() => setIsTasksOpen(true)}
                >
                  <ListTodo className="h-3.5 w-3.5" />
                  Nova Pendência
                </Button>
              </div>

              {isLoadingTasks ? (
                <div className="space-y-2">
                  {[1].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="text-center py-6 bg-card rounded-lg border border-border/50">
                  <p className="text-sm text-muted-foreground">Nenhuma pendência registrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => {
                    type TaskItem = { text: string; time?: string };
                    const items: TaskItem[] = (() => { try { return JSON.parse(task.items); } catch { return []; } })();
                    const statusCfg = ({
                      pendente:     { label: "Pendente",     color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                      em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                      concluido:    { label: "Concluído",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
                    } as const)[task.status as "pendente" | "em_andamento" | "concluido"] ?? { label: task.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                    return (
                      <div key={task.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", statusCfg.color)}>
                            {statusCfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(task.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          <ul className="space-y-1.5 mb-3">
                            {items.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                {task.status === "concluido"
                                  ? <CheckSquare className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                                  : <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                                <span className={cn(task.status === "concluido" && "line-through text-muted-foreground")}>
                                  {item.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex items-center justify-between pt-2 border-t border-border/40">
                            <span className="text-xs text-muted-foreground">— {task.responsible}</span>
                            {task.status !== "concluido" && (
                              <div className="flex gap-1.5">
                                {task.status === "pendente" && (
                                  <Button size="sm" variant="outline"
                                    className="h-8 text-xs px-3 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => updateTaskStatus.mutate(
                                      { id, taskId: task.id, data: { status: "em_andamento" } },
                                      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientTasksQueryKey(id) }),
                                        onError: () => toast({ title: "Erro ao atualizar pendência", variant: "destructive" }) }
                                    )}
                                  >Iniciar</Button>
                                )}
                                <Button size="sm" variant="outline"
                                  className="h-8 text-xs px-3 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                  onClick={() => updateTaskStatus.mutate(
                                    { id, taskId: task.id, data: { status: "concluido" } },
                                    { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientTasksQueryKey(id) }),
                                      onError: () => toast({ title: "Erro ao atualizar pendência", variant: "destructive" }) }
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

            {/* Notificações Compulsórias */}
            {podeGerarPDF && <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-400" /> Notificações Compulsórias
                  </h3>
                  {notifications && notifications.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {notifications.length}
                    </span>
                  )}
                </div>
                <Button
                  size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  disabled={!pode("editar_paciente")}
                  onClick={() => { setEditingNotification(null); setIsNotificationOpen(true); }}
                >
                  <Bell className="h-3.5 w-3.5" />
                  Nova Notificação
                </Button>
              </div>

              {isLoadingNotifications ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : !notifications || notifications.length === 0 ? (
                <div className="text-center py-6 bg-card rounded-lg border border-border/50">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação compulsória registrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map(notif => {
                    return (
                      <div key={notif.id} className="bg-card rounded-lg border border-amber-500/30 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                          <div className="flex items-center gap-2 flex-wrap">
                            {notif.disease && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider bg-amber-500/20 text-amber-400 border-amber-500/30">
                                {notif.disease}
                              </span>
                            )}
                            {notif.classification && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/40">
                                {notif.classification}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(notif.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="px-4 py-3 space-y-1.5">
                          <div className="flex items-center justify-between pt-1.5 border-t border-border/40 mt-1.5">
                            <div className="flex items-center gap-2">
                              {notif.pdfUrl && (
                                <a
                                  href={notif.pdfUrl}
                                  download={`SINAN_${patient.full_name.replace(/\s+/g, "_")}.pdf`}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                                  title="PDF SINAN gerado — clique para baixar novamente"
                                >
                                  <FileDown className="h-3 w-3" />
                                  PDF salvo
                                </a>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline"
                                className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                title="Imprimir / Gerar PDF SINAN"
                                disabled={!podeGerarPDF}
                                onClick={() => window.open(`${import.meta.env.BASE_URL}patients/${id}/notifications/${notif.id}/print`, "_blank")}
                              ><Printer className="h-3 w-3" /></Button>
                              <Button size="sm" variant="outline"
                                className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                title="Gerar e salvar PDF SINAN"
                                disabled={!podeGerarPDF || generatingPdfId === notif.id}
                                onClick={async () => {
                                  setGeneratingPdfId(notif.id);
                                  try {
                                    const blob = await generateSinanPdfBlob(patient, notif, import.meta.env.BASE_URL);
                                    const reader = new FileReader();
                                    const dataUrl: string = await new Promise((resolve, reject) => {
                                      reader.onload = () => resolve(reader.result as string);
                                      reader.onerror = reject;
                                      reader.readAsDataURL(blob);
                                    });
                                    updateNotification.mutate(
                                      { id, notificationId: notif.id, data: { pdfUrl: dataUrl } },
                                      {
                                        onSuccess: () => {
                                          queryClient.invalidateQueries({ queryKey: getGetPatientNotificationsQueryKey(id) });
                                          const href = URL.createObjectURL(blob);
                                          const a = Object.assign(document.createElement("a"), {
                                            href,
                                            download: `SINAN_${patient.full_name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
                                          });
                                          document.body.appendChild(a);
                                          a.click();
                                          document.body.removeChild(a);
                                          URL.revokeObjectURL(href);
                                          toast({ title: "PDF SINAN gerado e salvo com sucesso" });
                                        },
                                        onError: () => toast({ title: "Erro ao salvar PDF", variant: "destructive" }),
                                      }
                                    );
                                  } catch (e) {
                                    toast({ title: "Erro ao gerar PDF", description: String(e), variant: "destructive" });
                                  } finally {
                                    setGeneratingPdfId(null);
                                  }
                                }}
                              >{generatingPdfId === notif.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}</Button>
                              <Button size="sm" variant="outline"
                                className="h-6 text-[10px] px-2 border-muted-foreground/20 text-muted-foreground hover:bg-muted/30"
                                disabled={!pode("editar_paciente")}
                                onClick={() => { setEditingNotification(notif); setIsNotificationOpen(true); }}
                              ><Pencil className="h-3 w-3" /></Button>
                              <Button size="sm" variant="outline"
                                className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                disabled={!pode("editar_paciente")}
                                onClick={() => deleteNotification.mutate(
                                  { id, notificationId: notif.id },
                                  {
                                    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientNotificationsQueryKey(id) }),
                                    onError: () => toast({ title: "Erro ao remover notificação", variant: "destructive" }),
                                  }
                                )}
                              ><Trash className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>}

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
                <div className="flex items-start gap-3">
                  <span className="h-4 w-4 mt-0.5 shrink-0 flex items-center justify-center">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${patient.internmentStatus === "internado" ? "bg-blue-500" : "bg-emerald-500"}`} />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Status de Internação</p>
                    <p className="font-medium">{patient.internmentStatus === "internado" ? "Internado" : "Não internado"}</p>
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
                    <p className="font-medium">{patient.responsibleProfessional || "—"}</p>
                  </div>
                </div>
                {patient.attendanceDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Data do Atendimento</p>
                      <p className="font-medium">
                        {patient.attendanceDate.split("-").reverse().join("/")}
                        {patient.attendanceTime && <span className="ml-2 text-muted-foreground">às {patient.attendanceTime}</span>}
                      </p>
                    </div>
                  </div>
                )}
                {patient.healthUnit && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Unidade de Saúde</p>
                      <p className="font-medium">{patient.healthUnit}</p>
                    </div>
                  </div>
                )}
                {patient.responsibleProfessional && (
                  <div className="flex items-start gap-3">
                    <Stethoscope className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Profissional Responsável</p>
                      <p className="font-medium">{patient.responsibleProfessional}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Patient Demographics */}
            {(patient.cns || patient.cpf || patient.rg || patient.phone || patient.email || patient.motherName || patient.address) && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <UserCircle className="h-3.5 w-3.5" /> Dados do Paciente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {patient.motherName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Nome da Mãe</p>
                      <p className="text-sm font-medium">{patient.motherName}</p>
                    </div>
                  )}

                  {(patient.cns || patient.cpf || patient.rg) && (
                    <div className="space-y-1.5 pt-1 border-t border-border/40">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Documentos</p>
                      {patient.cns && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-muted-foreground">CNS</span>
                          <span className="text-xs font-mono font-medium">{patient.cns}</span>
                        </div>
                      )}
                      {patient.cpf && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-muted-foreground">CPF</span>
                          <span className="text-xs font-mono font-medium">{patient.cpf}</span>
                        </div>
                      )}
                      {patient.rg && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-muted-foreground">RG</span>
                          <span className="text-xs font-mono font-medium">{patient.rg}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {(patient.phone || patient.email) && (
                    <div className="space-y-1.5 pt-1 border-t border-border/40">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Contato</p>
                      {patient.phone && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-muted-foreground">Telefone</span>
                          <span className="text-sm font-medium">{patient.phone}</span>
                        </div>
                      )}
                      {patient.email && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-muted-foreground">E-mail</span>
                          <span className="text-sm font-medium">{patient.email}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {patient.address && (
                    <div className="space-y-1 pt-1 border-t border-border/40">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Endereço</p>
                      <p className="text-xs text-foreground leading-relaxed">{patient.address}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reclassification */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Reclassificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={pendingStatus ?? patient.triage_level} onValueChange={setPendingStatus}>
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
                  disabled={!pendingStatus || pendingStatus === patient.triage_level || updateStatus.isPending}
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

      <Dialog open={isVitalsRecordOpen} onOpenChange={setIsVitalsRecordOpen}>
        <DialogContent className="sm:max-w-[420px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registro de Sinais Vitais</DialogTitle>
            <DialogDescription>Registre os sinais vitais aferidos agora.</DialogDescription>
          </DialogHeader>
          <VitalsRecordForm
            patient={patient}
            onSuccess={() => setIsVitalsRecordOpen(false)}
            onCancel={() => setIsVitalsRecordOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isVitalsOpen} onOpenChange={setIsVitalsOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto">
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
            <DialogTitle>Nova Prescrição</DialogTitle>
            <DialogDescription>Registre uma prescrição de enfermagem ou médica para este paciente.</DialogDescription>
          </DialogHeader>
          <PrescriptionForm
            patient={patient}
            onSuccess={() => setIsPrescriptionOpen(false)}
            onCancel={() => setIsPrescriptionOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isTasksOpen} onOpenChange={setIsTasksOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Pendência</DialogTitle>
            <DialogDescription>Registre tarefas pendentes para este paciente.</DialogDescription>
          </DialogHeader>
          <TasksForm
            patientId={id}
            patientName={patient.full_name}
            defaultResponsible={patient.responsibleProfessional ?? ""}
            onSuccess={() => setIsTasksOpen(false)}
            onCancel={() => setIsTasksOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isNotificationOpen} onOpenChange={(open) => {
        setIsNotificationOpen(open);
        if (!open) setEditingNotification(null);
      }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400" />
              {editingNotification ? "Editar Notificação Compulsória" : "Nova Notificação Compulsória"}
            </DialogTitle>
            <DialogDescription>
              Registre o agravo de notificação obrigatória conforme a legislação sanitária vigente.
            </DialogDescription>
          </DialogHeader>
          <NotificationForm
            patient={patient}
            notification={editingNotification ?? undefined}
            onSuccess={() => { setIsNotificationOpen(false); setEditingNotification(null); }}
            onCancel={() => { setIsNotificationOpen(false); setEditingNotification(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Mobile sticky bottom action bar */}
      <div className="no-print fixed bottom-0 left-0 right-0 md:hidden bg-card/95 backdrop-blur-sm border-t border-border z-30">
        <div className="flex pb-safe">
          {([
            pode("registrar_sinais_vitais") && { icon: <Activity className="h-5 w-5" />, label: "SVs",        action: () => setIsVitalsRecordOpen(true) },
            pode("registrar_evolucao")      && { icon: <ClipboardList className="h-5 w-5" />, label: "SOAP",  action: () => setIsVitalsOpen(true) },
            pode("registrar_prescricao")    && { icon: <ClipboardCheck className="h-5 w-5" />, label: "Prescrição", action: () => setIsPrescriptionOpen(true) },
            { icon: <ListTodo className="h-5 w-5" />, label: "Pendência",  action: () => setIsTasksOpen(true) },
            { icon: <Bell className="h-5 w-5" />, label: "Notif.",  action: () => { setEditingNotification(null); setIsNotificationOpen(true); } },
          ].filter(Boolean) as { icon: React.ReactNode; label: string; action: () => void }[]).map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={item.action}
              className="flex flex-col items-center justify-center gap-1 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors text-primary"
            >
              {item.icon}
              <span className="text-[10px] font-medium text-muted-foreground leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="no-print">
          <AlertDialogHeader>
            <AlertDialogTitle>Alta / Remoção do Paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma a alta ou remoção de <strong>{patient.full_name}</strong> do sistema? O registro será excluído permanentemente.
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

      {/* ── PRINT-ONLY EVOLUTION REPORT ─────────────────────────────── */}
      <div className="print-only" style={{ fontFamily: "Arial, sans-serif", color: "#000", background: "#fff" }}>
        {/* Hospital header */}
        <div className="print-section" style={{ textAlign: "center", borderBottom: "2px solid #374151", paddingBottom: "8pt" }}>
          <div style={{ fontSize: "14pt", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            UPA Breves — Gestão de Pacientes
          </div>
          <div style={{ fontSize: "12pt", fontWeight: 600, marginTop: "2pt" }}>
            Relatório de Evolução de Enfermagem
          </div>
          <div style={{ fontSize: "9pt", color: "#6b7280", marginTop: "3pt" }}>
            Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {nurseName ? ` | Profissional: ${nurseName}` : ""}
          </div>
        </div>

        {/* Patient info */}
        <div className="print-section">
          <table className="print-table">
            <tbody>
              <tr>
                <th style={{ width: "15%", textAlign: "left" }}>Paciente</th>
                <td style={{ width: "35%" }}><strong>{patient.full_name}</strong></td>
                <th style={{ width: "10%", textAlign: "left" }}>Idade</th>
                <td style={{ width: "10%" }}>{patient.age} anos</td>
                <th style={{ width: "10%", textAlign: "left" }}>Leito</th>
                <td style={{ width: "20%" }}>{patient.bed || "—"}</td>
              </tr>
              <tr>
                <th style={{ textAlign: "left" }}>Setor</th>
                <td>{patient.sector}</td>
                <th style={{ textAlign: "left" }}>Triagem</th>
                <td>
                  <span style={{
                    fontWeight: 700,
                    color: patient.triage_level === "red" ? "#dc2626" : patient.triage_level === "orange" ? "#ea580c" :
                           patient.triage_level === "yellow" ? "#ca8a04" : patient.triage_level === "green" ? "#16a34a" : "#2563eb"
                  }}>
                    {cfg.label}
                  </span>
                </td>
                <th style={{ textAlign: "left" }}>Responsável</th>
                <td>{patient.responsibleProfessional || "—"}</td>
              </tr>
              {patient.diagnosis && (
                <tr>
                  <th style={{ textAlign: "left" }}>Diagnóstico</th>
                  <td colSpan={5}>{patient.diagnosis}</td>
                </tr>
              )}
              {(patient.internmentStatus === "internado") && (
                <tr>
                  <th style={{ textAlign: "left" }}>Status</th>
                  <td colSpan={5}>Internado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Current vitals */}
        <div className="print-section">
          <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: "4pt", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Sinais Vitais Atuais
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th>PA (mmHg)</th>
                <th>FC (bpm)</th>
                <th>FR (irpm)</th>
                <th>SpO₂ (%)</th>
                <th>Temp. (°C)</th>
                <th>HGT (mg/dL)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ textAlign: "center" }}>
                <td><strong>{latestVitals?.bp || "—"}</strong></td>
                <td><strong>{(latestVitals?.hr ?? 0) > 0 ? latestVitals!.hr : "—"}</strong></td>
                <td><strong>{(latestVitals?.rr ?? 0) > 0 ? latestVitals!.rr : "—"}</strong></td>
                <td><strong>{(latestVitals?.spo2 ?? 0) > 0 ? `${latestVitals!.spo2}%` : "—"}</strong></td>
                <td><strong>{(latestVitals?.temp ?? 0) > 0 ? `${latestVitals!.temp}°C` : "—"}</strong></td>
                <td><strong>{(latestVitals?.glucose ?? 0) > 0 ? `${latestVitals!.glucose}` : "—"}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Evolution history */}
        <div className="print-section">
          <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: "6pt", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Histórico de Evoluções ({history ? history.filter(e => e.soapText !== "Admissão inicial").length : 0} registros)
          </div>
          {history && history.map(entry => {
            const isInitial = entry.soapText === "Admissão inicial";
            return (
              <div key={entry.id} className="soap-entry">
                <div className="soap-entry-header" style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{isInitial ? "📋 Admissão Inicial" : `Profissional ID ${entry.userId}`}</strong>
                  <span style={{ color: "#6b7280" }}>
                    {format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div style={{ padding: "4pt 0 0" }}>
                  {isInitial ? (
                    <em style={{ color: "#6b7280" }}>Paciente admitido na unidade.</em>
                  ) : (
                    <pre style={{ fontFamily: "monospace", fontSize: "9pt", whiteSpace: "pre-wrap", color: "#374151", margin: 0 }}>{entry.soapText}</pre>
                  )}
                </div>
              </div>
            );
          })}
          {(!history || history.length === 0) && (
            <p style={{ color: "#6b7280", fontStyle: "italic" }}>Nenhuma evolução registrada.</p>
          )}
        </div>

        {/* Signature */}
        <div className="print-sig-area">
          <div className="print-sig-box">
            <div>{nurseName || "___________________________________"}</div>
            <div style={{ marginTop: "2pt" }}>Profissional Responsável</div>
            {patient.responsibleProfessional && <div style={{ color: "#6b7280" }}>{patient.responsibleProfessional}</div>}
          </div>
        </div>
      </div>

    </div>
  );
}
