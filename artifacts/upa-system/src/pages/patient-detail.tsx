import { useState } from "react";
import { PrintHeader } from "@/components/print-header";
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
  useGetPatientPharmacyEntries,
  useAddPatientPharmacyEntry,
  useUpdatePharmacyEntryStatus,
  getGetPatientPharmacyEntriesQueryKey,
  useGetPatientTransfers,
  getGetPatientTransfersQueryKey,
  useGetPatientExamRequests,
  useUpdateExamRequestStatus,
  getGetPatientExamRequestsQueryKey,
  useGetPatientDevices,
  useAddPatientDevice,
  useUpdatePatientDevice,
  getGetPatientDevicesQueryKey,
  AddPatientDeviceBodyDeviceType,
} from "@workspace/api-client-react";
import type { Patient, PatientNotification } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/use-auth";
import {
  Activity, ArrowLeft, Edit, Trash2, HeartPulse,
  Wind, Droplet, Droplets, Clock, MapPin, BedDouble, RefreshCw,
  UserCheck, ClipboardList, Stethoscope, Thermometer,
  Gauge, ClipboardCheck, CheckSquare, Square, ListTodo, Pencil, UserCircle, Printer,
  Bell, Trash, Download, FileDown, Calendar, Building2,
  MessageSquare, UtensilsCrossed, Pill, Truck, Plus, Send, FlaskConical,
  Plug, Unplug, AlertCircle, ChevronDown, Ban, X as XIcon,
  Package, ShieldAlert, AlertTriangle, BookOpen, FileText,
} from "lucide-react";
import { downloadSinanPdf, generateSinanPdfBlob, downloadIdentificacaoPdf } from "@/lib/pdf-fill";
import { buildInstitutionalHeader, buildPrintDocStyles, type PrintPatientInfo } from "@/lib/print-header-html";
import { PatientLabTab } from "@/components/patient-lab-tab";
import { PatientAlertsPanel } from "@/components/patient-alerts-panel";
import { PatientTimelineTab } from "@/components/patient-timeline-tab";
import { PatientNirTab } from "@/components/patient-nir-tab";
import { PatientResumoTab } from "@/components/patient-resumo-tab";
import { PatientAllergiesTab } from "@/components/patient-allergies-tab";
import { PatientTcleTab } from "@/components/patient-tcle-tab";
import { PatientObitoTab } from "@/components/patient-obito-tab";
import { PatientProceduresTab } from "@/components/patient-procedures-tab";
import { PatientInterconsultsTab } from "@/components/patient-interconsults-tab";
import { PatientCarePlanTab } from "@/components/patient-care-plan-tab";
import { PatientControlledMedsTab } from "@/components/patient-controlled-meds-tab";
import { PatientDispensationsTab } from "@/components/patient-dispensations-tab";
import { PatientInventarioTab } from "@/components/patient-inventario-tab";
import { PatientEscalasRiscoTab } from "@/components/patient-escalas-risco-tab";
import { PatientEventoAdversoTab } from "@/components/patient-evento-adverso-tab";
import { PatientChecklistAltaTab } from "@/components/patient-checklist-alta-tab";
import { PatientAtestadoTab } from "@/components/patient-atestado-tab";
import { PatientOrientacoesAltaTab } from "@/components/patient-orientacoes-alta-tab";
import { PatientSumarioAltaTab } from "@/components/patient-sumario-alta-tab";
import { EvolutionEnfermagemDiaria } from "@/components/evolution-enfermagem-diaria";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { TransferForm } from "@/components/transfer-form";
import { EvolutionMedico } from "@/components/evolution-medico";
import { EvolutionEnfermeiro } from "@/components/evolution-enfermeiro";
import { EvolutionTecnico } from "@/components/evolution-tecnico";
import { EvolutionSocial } from "@/components/evolution-social";
import { EvolutionNutricionista } from "@/components/evolution-nutricionista";
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

const TRANSFER_STATUS_COLORS: Record<string, string> = {
  "Solicitado":      "bg-yellow-500/20 text-yellow-200 border-yellow-500/30",
  "Autorizado":      "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Em transferência":"bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Transferido":     "bg-green-500/20 text-green-400 border-green-500/30",
  "Recusado":        "bg-red-500/20 text-red-400 border-red-500/30",
};

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

const DEVICE_LABELS: Record<string, string> = {
  acesso_venoso_periferico: "Acesso Venoso Periférico (AVP)",
  acesso_venoso_central:    "Acesso Venoso Central (AVC)",
  sonda_nasoenteral:        "Sonda Nasoenteral (SNE)",
  sonda_nasogastrica:       "Sonda Nasogástrica (SNG)",
  sonda_vesical_demora:     "Sonda Vesical de Demora (SVD)",
  cateter_arterial:         "Cateter Arterial",
  dreno_torax:              "Dreno de Tórax",
  traqueostomia:            "Traqueostomia",
  gastrostomia:             "Gastrostomia",
  cateter_duplo_lumen:      "Cateter de Duplo Lúmen",
  dissecao_vascular:        "Dissecção Vascular",
  outro:                    "Outro Dispositivo",
};

const DEVICE_TYPES = Object.entries(DEVICE_LABELS);

function fmtDeviceDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (y && m && d) return `${d}/${m}/${y}`;
  return iso;
}

function daysSince(iso: string): number {
  const start = new Date(iso + "T00:00:00");
  const now   = new Date();
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
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
  const { activeUser } = useAuth();

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
  const { data: pharmacyEntries, isLoading: isLoadingPharmacy } = useGetPatientPharmacyEntries(id, {
    query: { enabled: !!id, queryKey: getGetPatientPharmacyEntriesQueryKey(id) },
  });
  const { data: transfers, isLoading: isLoadingTransfers } = useGetPatientTransfers(id, {
    query: { enabled: !!id, queryKey: getGetPatientTransfersQueryKey(id) },
  });
  const { data: examRequests, isLoading: isLoadingExamRequests } = useGetPatientExamRequests(id, {
    query: { enabled: !!id, queryKey: getGetPatientExamRequestsQueryKey(id) },
  });
  const { data: devices, isLoading: isLoadingDevices } = useGetPatientDevices(id, undefined, {
    query: { enabled: !!id, queryKey: getGetPatientDevicesQueryKey(id) },
  });

  const latestVitals = vitals?.[0];

  const [activeGroup, setActiveGroup] = useState<"admissao" | "internacao" | "documentos" | "alta">("admissao");
  const [activeTab, setActiveTab] = useState("resumo");

  function switchGroup(g: "admissao" | "internacao" | "documentos" | "alta") {
    setActiveGroup(g);
    setActiveTab(GROUP_DEFAULTS[g]);
  }

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [tipoAlta, setTipoAlta] = useState("Alta com melhora clínica");
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);
  const [showPrintBanner, setShowPrintBanner] = useState(false);
  const [isVitalsRecordOpen, setIsVitalsRecordOpen] = useState(false);
  const [isPrescricaoMedicaOpen, setIsPrescricaoMedicaOpen] = useState(false);
  const [isPrescricaoEnfermagemOpen, setIsPrescricaoEnfermagemOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<PatientNotification | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [deviceType, setDeviceType]           = useState("");
  const [deviceDate, setDeviceDate]           = useState(() => new Date().toISOString().split("T")[0]);
  const [deviceSite, setDeviceSite]           = useState("");
  const [deviceNotes, setDeviceNotes]         = useState("");
  const [removingDeviceId, setRemovingDeviceId] = useState<number | null>(null);

  const [isLaudarOpen, setIsLaudarOpen] = useState(false);
  const [laudarExamId, setLaudarExamId] = useState<number | null>(null);
  const [laudarResultText, setLaudarResultText] = useState("");
  const [laudarFileName, setLaudarFileName] = useState("");
  const [laudarFileData, setLaudarFileData] = useState("");
  const [laudarFileMime, setLaudarFileMime] = useState("");
  const [laudarSubmitting, setLaudarSubmitting] = useState(false);
  const [laudarFileReading, setLaudarFileReading] = useState(false);

  const [pharmacyMed, setPharmacyMed]         = useState("");
  const [pharmacyNotes, setPharmacyNotes]     = useState("");
  const [pharmacyStatus, setPharmacyStatus]   = useState<"pendente" | "dispensado" | "devolvido">("pendente");

  const { nurseName, setNurseName } = useNurse();
  const [isEditingNurse, setIsEditingNurse] = useState(false);
  const [nurseInput, setNurseInput] = useState("");
  const [downloadingFicha, setDownloadingFicha] = useState(false);

  const pode = usePode();
  const podeGerarPDF = pode("gerar_pdf", "sinan_pdf");

  // ── Contexto de setor: ambulatorial (consultório) vs internação ──────────
  const OBS_SECTORS_DETAIL = new Set([
    "sala_vermelha", "observacao_adulto", "observacao_pediatrica", "observacao_pre_adulto",
  ]);
  const INPATIENT_STATUSES = new Set(["Em Observação", "Internado", "Em Transferência"]);
  const isInpatient = OBS_SECTORS_DETAIL.has(patient?.sector ?? "")
    || INPATIENT_STATUSES.has(patient?.careStatus ?? "");

  // Helpers de cargo para separar prescrições
  const isMedico      = ["medico", "administrador", "diretoria_geral"].includes(activeUser?.role ?? "");
  const isEnfermeiro  = ["enfermeiro", "tecnico_enfermagem", "administrador", "diretoria_geral"].includes(activeUser?.role ?? "");
  const role          = activeUser?.role ?? "";
  const canEditMedico       = ["medico", "administrador", "diretoria_geral"].includes(role);
  const canEditEnfermeiro   = ["enfermeiro", "administrador", "diretoria_geral"].includes(role);
  const canEditTecnico      = ["tecnico_enfermagem", "administrador", "diretoria_geral"].includes(role);
  const canEditSocial       = ["assistente_social", "administrador", "diretoria_geral"].includes(role);
  const canEditNutricionista = ["nutricionista", "administrador", "diretoria_geral"].includes(role);

  const GROUP_DEFAULTS: Record<string, string> = {
    admissao:   "resumo",
    internacao: canEditMedico ? "evol-medico" : "vitais",
    documentos: "sinan",
    alta:       canEditMedico ? "sumario-alta" : "checklist-alta",
  };
  const deletePatient = useDeletePatient();
  const updateStatus = useUpdatePatientStatus();
  const updatePrescriptionStatus = useUpdatePrescriptionStatus();
  const { data: staffList } = useListStaff();
  const staffMap = Object.fromEntries((staffList ?? []).map(s => [s.id, s]));
  const deleteNotification = useDeletePatientNotification();
  const updateNotification = useUpdatePatientNotification();
  const updateTaskStatus = useUpdateTaskStatus();
  const updateExamStatus = useUpdateExamRequestStatus();
  const addPharmacyEntry = useAddPatientPharmacyEntry();
  const updatePharmacyStatus = useUpdatePharmacyEntryStatus();
  const addDevice = useAddPatientDevice();
  const updateDevice = useUpdatePatientDevice();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [printingRxId, setPrintingRxId] = useState<number | null>(null);

  const [isInvalidarOpen, setIsInvalidarOpen]   = useState(false);
  const [invalidarTarget, setInvalidarTarget]   = useState<{ type: "prescricao" | "evolucao" | "exame"; id: number } | null>(null);
  const [invalidarMotivo, setInvalidarMotivo]   = useState("");
  const [invalidarLoading, setInvalidarLoading] = useState(false);

  const [solExameLabs, setSolExameLabs]             = useState<string[]>([]);
  const [solExameImagem, setSolExameImagem]         = useState<string[]>([]);
  const [solExamePrioridade, setSolExamePrioridade] = useState<"urgente" | "rotina" | "eletivo">("rotina");
  const [solExameJustificativa, setSolExameJustificativa] = useState("");
  const [solExameLabInput, setSolExameLabInput]     = useState("");
  const [solExameImgInput, setSolExameImgInput]     = useState("");
  const [solExameLoading, setSolExameLoading]       = useState(false);
  const [downloadingApac, setDownloadingApac]         = useState(false);
  const [downloadingFichaRef, setDownloadingFichaRef] = useState(false);
  const [downloadingAih, setDownloadingAih]           = useState(false);
  const [downloadingFichaTriagem, setDownloadingFichaTriagem] = useState(false);

  const [prevVisits, setPrevVisits]               = useState<Patient[] | null>(null);
  const [prevVisitsLoading, setPrevVisitsLoading] = useState(false);
  const [showPrevVisits, setShowPrevVisits]       = useState(false);

  async function loadPrevVisits() {
    if (!patient?.cpf) return;
    setPrevVisitsLoading(true);
    try {
      const resp = await fetch(
        `/api/patients/previous-visits?cpf=${encodeURIComponent(patient.cpf)}&excludeId=${id}`,
        { headers: { "x-staff-id": String(activeUser?.id ?? 0) } }
      );
      const data = await resp.json();
      setPrevVisits(Array.isArray(data) ? data : []);
      setShowPrevVisits(true);
    } catch {
      // ignore
    } finally {
      setPrevVisitsLoading(false);
    }
  }

  const handleInvalidar = async () => {
    if (!invalidarTarget) return;
    setInvalidarLoading(true);
    try {
      const { type, id: targetId } = invalidarTarget;
      const path =
        type === "prescricao"
          ? `/api/patients/${id}/prescriptions/${targetId}/invalidar`
          : type === "evolucao"
          ? `/api/patients/${id}/evolutions/${targetId}/invalidar`
          : `/api/patients/${id}/exam-requests/${targetId}/invalidar`;
      const resp = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-staff-id": String(activeUser?.id ?? 0) },
        body: JSON.stringify({ motivo: invalidarMotivo }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao invalidar");
      }
      if (type === "prescricao") queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(id) });
      else if (type === "evolucao") queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(id) });
      else queryClient.invalidateQueries({ queryKey: getGetPatientExamRequestsQueryKey(id) });
      toast({ title: "Registro invalidado com sucesso" });
      setIsInvalidarOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao invalidar registro";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setInvalidarLoading(false);
    }
  };

  const handleSolicitarExame = async () => {
    if (solExameLabs.length === 0 && solExameImagem.length === 0) return;
    setSolExameLoading(true);
    try {
      const resp = await fetch(`/api/patients/${id}/exam-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-staff-id": String(activeUser?.id ?? 0) },
        body: JSON.stringify({
          laboratoriais: solExameLabs,
          imagem: solExameImagem,
          prioridade: solExamePrioridade,
          justificativa: solExameJustificativa,
        }),
      });
      if (!resp.ok) throw new Error("Erro");
      queryClient.invalidateQueries({ queryKey: getGetPatientExamRequestsQueryKey(id) });
      setSolExameLabs([]); setSolExameImagem([]); setSolExameJustificativa("");
      setSolExameLabInput(""); setSolExameImgInput("");
      toast({ title: "Solicitação de exame registrada" });
    } catch {
      toast({ title: "Erro ao solicitar exame", variant: "destructive" });
    } finally {
      setSolExameLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/patients/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-staff-id": String(activeUser?.id ?? 0) },
        body: JSON.stringify({
          care_status: "Alta",
          triage_level: patient?.triage_level ?? "green",
          user_id: activeUser?.id ?? 0,
          tipo_alta: tipoAlta,
        }),
      });
      if (!resp.ok) throw new Error("Erro ao registrar alta");
      queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
      toast({ title: "Alta registrada com sucesso", description: `Motivo: ${tipoAlta}. Dados preservados no histórico.` });
      setLocation("/");
    } catch {
      toast({ title: "Não foi possível registrar a alta", variant: "destructive" });
      setIsDeleteOpen(false);
    }
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

  const handleAddPharmacy = () => {
    if (!pharmacyMed.trim()) return;
    addPharmacyEntry.mutate(
      { id, data: { userId: activeUser?.id ?? 0, medication: pharmacyMed.trim(), status: pharmacyStatus, notes: pharmacyNotes.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientPharmacyEntriesQueryKey(id) });
          setPharmacyMed(""); setPharmacyNotes(""); setPharmacyStatus("pendente");
          toast({ title: "Registro farmacêutico salvo" });
        },
        onError: () => toast({ title: "Erro ao salvar registro", variant: "destructive" }),
      },
    );
  };

  // ── Funções de impressão de documentos internos ──────────────────────────

  const _printBase = () => window.location.origin + (import.meta.env.BASE_URL ?? "/");

  const handlePrintVitals = () => {
    if (!patient) return;
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    const now = new Date();
    const dateStr = now.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const aferido = latestVitals?.createdAt
      ? new Date(latestVitals.createdAt as string).toLocaleString("pt-BR")
      : dateStr;
    const row = (bg: string, label: string, val: string | number | null | undefined, unit: string, ref: string) =>
      `<tr style="background:${bg}"><td style="border:1px solid #bbb;padding:3px 8px;">${label}</td><td style="border:1px solid #bbb;padding:3px 8px;text-align:center;font-weight:700;">${val ?? "—"}</td><td style="border:1px solid #bbb;padding:3px 8px;text-align:center;">${unit}</td><td style="border:1px solid #bbb;padding:3px 8px;text-align:center;font-size:7.5pt;color:#555;">${ref}</td></tr>`;
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Sinais Vitais — ${patient.full_name}</title><style>${buildPrintDocStyles("#0369a1")}</style></head><body>
${buildInstitutionalHeader(patient as unknown as PrintPatientInfo, "REGISTRO DE SINAIS VITAIS", _printBase())}
<p class="doc-meta"><strong>Aferição registrada em:</strong> ${aferido}</p>
<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:10px;">
<thead><tr style="background:#e0f2fe;"><th style="border:1px solid #bbb;padding:4px 8px;text-align:left;">Parâmetro</th><th style="border:1px solid #bbb;padding:4px 8px;text-align:center;">Valor</th><th style="border:1px solid #bbb;padding:4px 8px;text-align:center;">Unidade</th><th style="border:1px solid #bbb;padding:4px 8px;text-align:center;">Referência</th></tr></thead>
<tbody>
${row("#fff","Pressão Arterial",(latestVitals as {bp?:string}|undefined)?.bp,"mmHg","&lt;120/80")}
${row("#f8fafc","Frequência Cardíaca",(latestVitals as {hr?:number}|undefined)?.hr,"bpm","60–100")}
${row("#fff","Frequência Respiratória",(latestVitals as {rr?:number}|undefined)?.rr,"irpm","12–20")}
${row("#f8fafc","SpO₂ — Saturação de O₂",(latestVitals as {spo2?:number}|undefined)?.spo2,"%","≥95")}
${row("#fff","Temperatura",(latestVitals as {temp?:number}|undefined)?.temp,"°C","36,1–37,2")}
${row("#f8fafc","Glicemia Capilar",(latestVitals as {glucose?:number}|undefined)?.glucose,"mg/dL","70–99 (jejum)")}
</tbody></table>
<div class="sig-area"><div class="sig-line">__________________________________________</div><div class="sig-sub">Profissional Responsável pela Aferição — Carimbo / Assinatura</div></div>
<script>window.onload=()=>{window.print();}</script></body></html>`);
    win.document.close();
  };

  const handlePrintAdmissaoMedica = () => {
    if (!patient) return;
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    const entryDate = format(new Date(patient.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const dash = "border:1px dashed #ccc; padding:4px;";
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Admissão Médica — ${patient.full_name}</title><style>${buildPrintDocStyles("#1e3a8a")}</style></head><body>
${buildInstitutionalHeader(patient as unknown as PrintPatientInfo, "ADMISSÃO MÉDICA", _printBase())}
<p class="doc-meta"><strong>Data/Hora da Admissão:</strong> ${entryDate} &nbsp;|&nbsp; <strong>Setor:</strong> ${patient.sector ?? "—"} &nbsp;|&nbsp; <strong>Leito:</strong> ${(patient as {bed?:string}).bed ?? "—"}</p>
<div class="section"><div class="section-label">Queixa Principal e HDA</div><div class="section-body" style="${dash} min-height:55px;"> </div></div>
<div class="two-col">
  <div class="section"><div class="section-label">Antecedentes Patológicos / Comorbidades</div><div class="section-body" style="${dash} min-height:45px;"> </div></div>
  <div class="section"><div class="section-label">Medicamentos em Uso Habitual</div><div class="section-body" style="${dash} min-height:45px;"> </div></div>
</div>
<div class="section"><div class="section-label">Exame Físico Inicial</div><div class="section-body" style="${dash} min-height:65px;"> </div></div>
<div class="two-col">
  <div class="section"><div class="section-label">Hipótese Diagnóstica / CID-10</div><div class="section-body" style="${dash} min-height:40px;"> </div></div>
  <div class="section"><div class="section-label">Classificação de Risco (Manchester)</div><div class="section-body" style="${dash} min-height:40px;"> </div></div>
</div>
<div class="section"><div class="section-label">Conduta Médica Inicial</div><div class="section-body" style="${dash} min-height:55px;"> </div></div>
<div class="section"><div class="section-label">Alergias</div><div class="section-body" style="${dash} min-height:18px;">☐ Não &nbsp; ☐ Sim → Qual: _______________________________________</div></div>
<div class="sig-area"><div class="sig-line">__________________________________________</div><div class="sig-sub">Médico Responsável — Nome completo / CRM / Assinatura</div></div>
<script>window.onload=()=>{window.print();}</script></body></html>`);
    win.document.close();
  };

  const handlePrintAdmissaoEnfermagem = () => {
    if (!patient) return;
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    const entryDate = format(new Date(patient.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const dash = "border:1px dashed #ccc; padding:4px;";
    const bp = (latestVitals as {bp?:string}|undefined)?.bp ?? "___/___";
    const hr = (latestVitals as {hr?:number}|undefined)?.hr ?? "___";
    const rr = (latestVitals as {rr?:number}|undefined)?.rr ?? "___";
    const spo2 = (latestVitals as {spo2?:number}|undefined)?.spo2 ? `${(latestVitals as {spo2?:number}).spo2}%` : "___%";
    const temp = (latestVitals as {temp?:number}|undefined)?.temp ? `${(latestVitals as {temp?:number}).temp}°C` : "___°C";
    const glic = (latestVitals as {glucose?:number}|undefined)?.glucose ? `${(latestVitals as {glucose?:number}).glucose} mg/dL` : "___ mg/dL";
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Admissão de Enfermagem — ${patient.full_name}</title><style>${buildPrintDocStyles("#0d9488")}</style></head><body>
${buildInstitutionalHeader(patient as unknown as PrintPatientInfo, "ADMISSÃO DE ENFERMAGEM", _printBase())}
<p class="doc-meta"><strong>Data/Hora da Admissão:</strong> ${entryDate} &nbsp;|&nbsp; <strong>Setor:</strong> ${patient.sector ?? "—"} &nbsp;|&nbsp; <strong>Leito:</strong> ${(patient as {bed?:string}).bed ?? "—"}</p>
<div class="section"><div class="section-label">Queixa Principal (referida pelo paciente)</div><div class="section-body" style="${dash} min-height:35px;"> </div></div>
<div class="two-col">
  <div class="section"><div class="section-label">Dados Vitais na Admissão</div><div class="section-body" style="${dash} font-size:8.5pt; line-height:1.8;">PA: ${bp} &nbsp; FC: ${hr} bpm &nbsp; FR: ${rr} irpm<br/>SpO₂: ${spo2} &nbsp; Temp: ${temp} &nbsp; Glicemia: ${glic}</div></div>
  <div class="section"><div class="section-label">Estado Geral</div><div class="section-body" style="${dash} min-height:40px;"> </div></div>
</div>
<div class="two-col">
  <div class="section"><div class="section-label">Nível de Consciência</div><div class="section-body" style="${dash}">☐ Alerta &nbsp; ☐ Confuso &nbsp; ☐ Sonolento &nbsp; ☐ Inconsciente</div></div>
  <div class="section"><div class="section-label">Escala de Dor (EVA 0–10)</div><div class="section-body" style="${dash}">Intensidade: ___ &nbsp; Local: _______________________</div></div>
</div>
<div class="section"><div class="section-label">Avaliação de Enfermagem por Sistemas</div><div class="section-body" style="${dash} min-height:65px;"> </div></div>
<div class="two-col">
  <div class="section"><div class="section-label">Histórico de Saúde / Comorbidades</div><div class="section-body" style="${dash} min-height:40px;"> </div></div>
  <div class="section"><div class="section-label">Alergias Conhecidas</div><div class="section-body" style="${dash}">☐ Não &nbsp; ☐ Sim → ___________________________</div></div>
</div>
<div class="section"><div class="section-label">Prescrição de Enfermagem na Admissão</div><div class="section-body" style="${dash} min-height:55px;"> </div></div>
<div class="section"><div class="section-label">Observações Gerais</div><div class="section-body" style="${dash} min-height:28px;"> </div></div>
<div class="sig-area"><div class="sig-line">__________________________________________</div><div class="sig-sub">Enfermeiro(a) Responsável — Nome completo / COREN / Assinatura</div></div>
<script>window.onload=()=>{window.print();}</script></body></html>`);
    win.document.close();
  };

  const handlePrintAtualizacaoQuadro = () => {
    if (!patient) return;
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    const entryDate = format(new Date(patient.createdAt), "dd/MM/yyyy", { locale: ptBR });
    const today = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const dash = "border:1px dashed #ccc; padding:4px;";
    const bp = (latestVitals as {bp?:string}|undefined)?.bp ?? "___/___";
    const hr = (latestVitals as {hr?:number}|undefined)?.hr ?? "___";
    const rr = (latestVitals as {rr?:number}|undefined)?.rr ?? "___";
    const spo2 = (latestVitals as {spo2?:number}|undefined)?.spo2 ? `${(latestVitals as {spo2?:number}).spo2}%` : "___%";
    const temp = (latestVitals as {temp?:number}|undefined)?.temp ? `${(latestVitals as {temp?:number}).temp}°C` : "___°C";
    const glic = (latestVitals as {glucose?:number}|undefined)?.glucose ? `${(latestVitals as {glucose?:number}).glucose} mg/dL` : "___ mg/dL";
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Atualização de Quadro Clínico — ${patient.full_name}</title><style>${buildPrintDocStyles("#7c3aed")}</style></head><body>
${buildInstitutionalHeader(patient as unknown as PrintPatientInfo, "ATUALIZAÇÃO DE QUADRO CLÍNICO", _printBase())}
<p class="doc-meta"><strong>Emissão:</strong> ${today} &nbsp;|&nbsp; <strong>Admissão:</strong> ${entryDate} &nbsp;|&nbsp; <strong>Destinatário:</strong> Central de Regulação / NIR</p>
<div class="section"><div class="section-label">Diagnóstico Atual / Hipótese Diagnóstica / CID-10</div><div class="section-body" style="${dash} min-height:35px;"> </div></div>
<div class="two-col">
  <div class="section"><div class="section-label">Situação Clínica Atual (últimas 24 horas)</div><div class="section-body" style="${dash} min-height:75px;"> </div></div>
  <div>
    <div class="section"><div class="section-label">Sinais Vitais Atuais</div><div class="section-body" style="${dash} font-size:8.5pt; line-height:1.8;">PA: ${bp} mmHg<br/>FC: ${hr} bpm &nbsp; FR: ${rr} irpm<br/>SpO₂: ${spo2} &nbsp; Temp: ${temp}<br/>Glicemia: ${glic}</div></div>
    <div class="section" style="margin-top:6px;"><div class="section-label">Prioridade de Regulação</div><div class="section-body" style="${dash} font-size:8.5pt;">☐ Urgência &nbsp; ☐ Alta Urgência &nbsp; ☐ Emergência</div></div>
  </div>
</div>
<div class="section"><div class="section-label">Exames Realizados e Resultados Relevantes</div><div class="section-body" style="${dash} min-height:45px;"> </div></div>
<div class="section"><div class="section-label">Prescrições e Condutas Atuais</div><div class="section-body" style="${dash} min-height:45px;"> </div></div>
<div class="two-col">
  <div class="section"><div class="section-label">Necessidade de Transferência</div><div class="section-body" style="${dash} font-size:8.5pt; line-height:1.8;">☐ Sim &nbsp; ☐ Não<br/>Motivo: ___________________________<br/>Destino solicitado: ___________________________</div></div>
  <div class="section"><div class="section-label">Prognóstico</div><div class="section-body" style="${dash} font-size:8.5pt; line-height:1.8;">☐ Favorável &nbsp; ☐ Reservado<br/>☐ Grave &nbsp; ☐ Crítico</div></div>
</div>
<div class="section"><div class="section-label">Informações Adicionais à Regulação / NIR</div><div class="section-body" style="${dash} min-height:28px;"> </div></div>
<div class="sig-area"><div class="sig-line">__________________________________________</div><div class="sig-sub">Médico Responsável — Nome completo / CRM / Assinatura &nbsp;|&nbsp; Data: ___/___/______</div></div>
<script>window.onload=()=>{window.print();}</script></body></html>`);
    win.document.close();
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
          .print-section { margin-bottom: 14pt; padding-bottom: 8pt; border-bottom: 1px solid #d1d5db; }
          .print-table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
          .print-table th, .print-table td { border: 1px solid #9ca3af; padding: 5px 8px; font-size: 9pt; }
          .print-table th { background: #e5e7eb; font-weight: 700; }
          .soap-entry { margin-bottom: 10pt; padding: 8pt; border: 1px solid #d1d5db; page-break-inside: avoid; }
          .soap-entry-header { background: #f3f4f6; padding: 4px 8px; margin-bottom: 5pt; border-bottom: 1px solid #d1d5db; }
          .soap-badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 3px; font-size: 9pt; font-weight: 700; margin-right: 4px; }
          .badge-s { background: #dbeafe; color: #1e40af; }
          .badge-o { background: #dcfce7; color: #166534; }
          .badge-a { background: #ffedd5; color: #9a3412; }
          .badge-p { background: #f3e8ff; color: #6b21a8; }
          .print-sig-area { margin-top: 30pt; padding-top: 38mm; display: flex; justify-content: center; }
          .print-sig-box { text-align: center; width: 60%; padding-top: 6pt; font-size: 9pt; font-weight: 600; border-top: 1.5px solid #111; }
        }
        .print-only { display: none; }
      `}</style>

      <header className="print-hide border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold tracking-tight hidden sm:inline">UPA Breves — Prontuário Eletrônico</span>
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

      <main className="no-print flex-1 container mx-auto px-4 py-6 max-w-5xl pb-28 md:pb-8">

        {/* Patient Info Card — always visible above tabs */}
        <Card className={`border-l-4 ${cfg.borderClass} border-t-border/50 border-r-border/50 border-b-border/50 mb-5`}>
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
                  {patient.symptoms && <p className="text-sm">{patient.symptoms}</p>}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── Visitas Anteriores (mesmo CPF) ───────────────────────── */}
        {patient.cpf && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => {
                if (!showPrevVisits && prevVisits === null) {
                  loadPrevVisits();
                } else {
                  setShowPrevVisits(v => !v);
                }
              }}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-3 rounded-lg border border-border/30 bg-card hover:bg-muted/20 w-full"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="flex-1 text-left font-medium">Visitas Anteriores — mesmo CPF</span>
              {prevVisitsLoading
                ? <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
                : <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", showPrevVisits ? "rotate-180" : "")} />
              }
            </button>
            {showPrevVisits && prevVisits && (
              <div className="mt-1.5 border border-border/30 rounded-lg bg-card/50 divide-y divide-border/20 overflow-hidden">
                {prevVisits.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhuma visita anterior registrada para este CPF.
                  </p>
                ) : (
                  prevVisits.map(v => (
                    <Link
                      key={v.id}
                      href={`/patients/${v.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{v.full_name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(v.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {v.diagnosis && <> &bull; <span className="italic">{v.diagnosis}</span></>}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 shrink-0">
                        Alta
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Alertas Clínicos */}
        <div className="mb-4">
          <PatientAlertsPanel patientId={id} userName={activeUser?.name ?? ""} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* ── Group selector — 4 fases do atendimento ────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {/* ADMISSÃO */}
            <button
              onClick={() => switchGroup("admissao")}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                activeGroup === "admissao"
                  ? "bg-blue-50 text-blue-700 border-blue-300 shadow-sm"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/40",
              )}
            >
              <span className="text-base leading-none">📥</span>
              <span className="mt-0.5">Admissão</span>
              <span className={cn("text-[9px] font-normal", activeGroup === "admissao" ? "text-blue-400" : "text-muted-foreground/60")}>
                Identificação · TCLE
              </span>
            </button>
            {/* INTERNAÇÃO */}
            <button
              onClick={() => switchGroup("internacao")}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                activeGroup === "internacao"
                  ? "bg-amber-50 text-amber-700 border-amber-300 shadow-sm"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-amber-200 hover:text-amber-600 hover:bg-amber-50/40",
              )}
            >
              <span className="text-base leading-none">🏥</span>
              <span className="mt-0.5">Internação</span>
              <span className={cn("text-[9px] font-normal", activeGroup === "internacao" ? "text-amber-400" : "text-muted-foreground/60")}>
                Evolução · Tratamento
              </span>
            </button>
            {/* DOCUMENTOS */}
            <button
              onClick={() => switchGroup("documentos")}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                activeGroup === "documentos"
                  ? "bg-purple-50 text-purple-700 border-purple-300 shadow-sm"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-purple-200 hover:text-purple-600 hover:bg-purple-50/40",
              )}
            >
              <span className="text-base leading-none">📋</span>
              <span className="mt-0.5">Documentos</span>
              <span className={cn("text-[9px] font-normal", activeGroup === "documentos" ? "text-purple-400" : "text-muted-foreground/60")}>
                SINAN · NIR · Eventos
              </span>
            </button>
            {/* ALTA */}
            <button
              onClick={() => switchGroup("alta")}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                activeGroup === "alta"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-emerald-200 hover:text-emerald-600 hover:bg-emerald-50/40",
              )}
            >
              <span className="text-base leading-none">🚪</span>
              <span className="mt-0.5">Alta</span>
              <span className={cn("text-[9px] font-normal", activeGroup === "alta" ? "text-emerald-500" : "text-muted-foreground/60")}>
                Sumário · Checklist
              </span>
            </button>
          </div>

          {/* ── Sub-tabs for active group ──────────────────────────────── */}
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4 bg-muted/20 p-1 rounded-lg border border-border/50">

            {/* ── ADMISSÃO: entrada do paciente na unidade ── */}
            {activeGroup === "admissao" && <>
              <TabsTrigger value="resumo" className="text-xs">📋 Resumo</TabsTrigger>
              <TabsTrigger value="identificacao" className="text-xs">Ficha de Identificação</TabsTrigger>
              <TabsTrigger value="inventario-pertences" className="text-xs">Inventário de Pertences</TabsTrigger>
              {pode("registrar_consentimento") && <TabsTrigger value="tcle" className="text-xs">TCLE</TabsTrigger>}
              {pode("registrar_alergia") && <TabsTrigger value="alergias" className="text-xs">Alergias</TabsTrigger>}
              {isEnfermeiro && <TabsTrigger value="ficha-triagem" className="text-xs">Ficha de Triagem</TabsTrigger>}
              <TabsTrigger value="timeline" className="text-xs">Linha do Tempo</TabsTrigger>
            </>}

            {/* ── INTERNAÇÃO: ciclo clínico diário ── */}
            {activeGroup === "internacao" && <>
              {/* Evoluções por categoria profissional */}
              <TabsTrigger value="evol-medico" className="text-xs">Evolução Médica</TabsTrigger>
              <TabsTrigger value="enfermagem" className="text-xs">Enfermagem</TabsTrigger>
              <TabsTrigger value="sae" className="text-xs">SAE</TabsTrigger>
              <TabsTrigger value="tecnico" className="text-xs">Téc. Enfermagem</TabsTrigger>
              {isInpatient && <TabsTrigger value="social" className="text-xs">Serviço Social</TabsTrigger>}
              {isInpatient && <TabsTrigger value="nutricao" className="text-xs">Nutrição</TabsTrigger>}
              {/* Sinais vitais + escalas */}
              <TabsTrigger value="vitais" className="text-xs">Sinais Vitais</TabsTrigger>
              <TabsTrigger value="escalas-risco" className="text-xs">Escalas de Risco</TabsTrigger>
              {pode("registrar_plano_cuidados") && <TabsTrigger value="plano-cuidados" className="text-xs">Plano de Cuidados</TabsTrigger>}
              {/* Tratamento */}
              {pode("registrar_prescricao") && <TabsTrigger value="prescricao" className="text-xs">Prescrição</TabsTrigger>}
              {pode("registrar_prescricao") && (
                <TabsTrigger value="sol-exames" className="text-xs flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" /> Sol. Exames
                </TabsTrigger>
              )}
              {(pode("registrar_prescricao") || pode("registrar_exames") || pode("visualizar_setores")) && (
                <TabsTrigger value="exames" className="text-xs flex items-center gap-1">
                  Exames
                  {examRequests && examRequests.filter(e => e.status !== "laudado").length > 0 && (
                    <span className="text-[10px] font-bold px-1 rounded-full bg-orange-500/20 text-orange-400 min-w-[16px] text-center">
                      {examRequests.filter(e => e.status !== "laudado").length}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {(["laboratorio", "administrador", "diretoria_geral"].includes(activeUser?.role ?? "")) && (
                <TabsTrigger value="laboratorio" className="text-xs flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" /> Laboratório
                </TabsTrigger>
              )}
              {isInpatient && pode("registrar_farmacia") && <TabsTrigger value="farmacia" className="text-xs">Farmácia</TabsTrigger>}
              {isInpatient && (
                <TabsTrigger value="dispositivos" className="text-xs flex items-center gap-1">
                  <Plug className="h-3 w-3" /> Dispositivos
                  {devices && devices.filter(d => !d.removedAt).length > 0 && (
                    <span className="text-[10px] font-bold px-1 rounded-full bg-cyan-500/20 text-cyan-400 min-w-[16px] text-center">
                      {devices.filter(d => !d.removedAt).length}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {isInpatient && pode("registrar_medicamento_controlado") && <TabsTrigger value="med-controlados" className="text-xs">Med. Controlados</TabsTrigger>}
              {isInpatient && pode("registrar_dispensacao") && <TabsTrigger value="dispensacao" className="text-xs">Dispensação</TabsTrigger>}
            </>}

            {/* ── DOCUMENTOS: notificações, regulação, transferência ── */}
            {activeGroup === "documentos" && <>
              {podeGerarPDF && <TabsTrigger value="sinan" className="text-xs">🔴 SINAN</TabsTrigger>}
              <TabsTrigger value="evento-adverso" className="text-xs">Evento Adverso</TabsTrigger>
              {isInpatient && <TabsTrigger value="regulacao" className="text-xs">Regulação/NIR</TabsTrigger>}
              {pode("mudar_setor") && <TabsTrigger value="transferencia" className="text-xs">Transferência</TabsTrigger>}
              {isInpatient && pode("registrar_procedimento") && <TabsTrigger value="procedimentos" className="text-xs">Procedimentos</TabsTrigger>}
              {isInpatient && pode("registrar_interconsulta") && <TabsTrigger value="interconsulta" className="text-xs">Interconsulta</TabsTrigger>}
            </>}

            {/* ── ALTA: encerramento do atendimento ── */}
            {activeGroup === "alta" && <>
              {canEditMedico && <TabsTrigger value="sumario-alta" className="text-xs">Sumário de Alta</TabsTrigger>}
              <TabsTrigger value="checklist-alta" className="text-xs">Checklist de Alta</TabsTrigger>
              {canEditMedico && <TabsTrigger value="atestado-medico" className="text-xs">Atestado Médico</TabsTrigger>}
              <TabsTrigger value="orientacoes-alta" className="text-xs">Orientações de Alta</TabsTrigger>
              {isMedico && pode("gerar_pdf") && <TabsTrigger value="ficha-referencia" className="text-xs">Ficha de Referência</TabsTrigger>}
              {pode("registrar_obito") && <TabsTrigger value="obito" className="text-xs text-red-500">⚠ Óbito</TabsTrigger>}
            </>}

          </TabsList>

          {/* ── AIH: ação rápida na aba Internação (médicos) ─────────── */}
          {activeGroup === "internacao" && isMedico && pode("gerar_pdf") && (
            <div className="flex items-center gap-2 mb-3 -mt-1 px-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Documentos PDF:</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                disabled={downloadingAih}
                onClick={async () => {
                  setDownloadingAih(true);
                  try {
                    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                    const resp = await fetch(`${base}/api/patients/${id}/pdf/aih`, { headers: { "x-staff-id": String(activeUser?.id ?? 0) } });
                    if (!resp.ok) throw new Error();
                    const blob = await resp.blob();
                    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `AIH_${patient?.full_name?.replace(/\s+/g,"_")}.pdf` });
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  } catch { toast({ title: "Erro ao gerar AIH", variant: "destructive" }); }
                  finally { setDownloadingAih(false); }
                }}
              >
                <FileDown className="h-3 w-3" />
                {downloadingAih ? "Gerando…" : "↓ AIH"}
              </Button>
            </div>
          )}

          {/* ── TAB: RESUMO CLÍNICO ───────────────────────────────────────── */}
          <TabsContent value="resumo">
            <PatientResumoTab
              patient={patient as Parameters<typeof PatientResumoTab>[0]["patient"]}
              vitals={vitals as Parameters<typeof PatientResumoTab>[0]["vitals"]}
              history={history as Parameters<typeof PatientResumoTab>[0]["history"]}
              prescriptions={prescriptions as Parameters<typeof PatientResumoTab>[0]["prescriptions"]}
              examRequests={examRequests as Parameters<typeof PatientResumoTab>[0]["examRequests"]}
              staffMap={staffMap}
            />
          </TabsContent>

          {/* ── TAB: ADMISSÃO INICIAL ──────────────────────────────────── */}
          <TabsContent value="identificacao">
            <div className="flex justify-end gap-2 mb-3">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handlePrintAdmissaoMedica}>
                <Printer className="h-3.5 w-3.5" /> Admissão Médica
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handlePrintAdmissaoEnfermagem}>
                <Printer className="h-3.5 w-3.5" /> Admissão de Enfermagem
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </CardContent>
              </Card>

              <div className="space-y-4">
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

                {["enfermeiro", "administrador", "diretoria_geral"].includes(activeUser?.role ?? "") &&
                 (["Em Triagem", "Aguardando Atendimento"].includes(patient.careStatus ?? "") || patient.sector === "sala_vermelha") && (
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
                )}
              </div>
            </div>

            {/* ── Avaliações Multiprofissionais na Admissão ── */}
            {(pode("registrar_nota_social") || pode("registrar_avaliacao_nutricional") || pode("registrar_farmacia")) && (
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Avaliações Multiprofissionais na Admissão</h3>
                </div>
                {pode("registrar_nota_social") && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5 mb-2">
                      <MessageSquare className="h-3.5 w-3.5" /> Serviço Social
                    </p>
                    <EvolutionSocial
                      patientId={id}
                      userId={activeUser?.id ?? 0}
                      patientName={patient.full_name}
                      patient={patient}
                      staffMap={staffMap}
                      mode="admissao"
                      staffCorenCrm={activeUser?.corenCrm ?? ""}
                      canEdit={canEditSocial}
                    />
                  </div>
                )}
                {pode("registrar_avaliacao_nutricional") && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                      <UtensilsCrossed className="h-3.5 w-3.5" /> Nutrição
                    </p>
                    <EvolutionNutricionista
                      patientId={id}
                      userId={activeUser?.id ?? 0}
                      patientName={patient.full_name}
                      patient={patient}
                      staffMap={staffMap}
                      mode="admissao"
                      staffCorenCrm={activeUser?.corenCrm ?? ""}
                      canEdit={canEditNutricionista}
                    />
                  </div>
                )}
                {pode("registrar_farmacia") && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5 mb-2">
                      <Pill className="h-3.5 w-3.5" /> Farmácia
                    </p>
                    {isLoadingPharmacy ? (
                      <div className="h-14 bg-card rounded-lg border border-border/50 animate-pulse" />
                    ) : !pharmacyEntries || pharmacyEntries.length === 0 ? (
                      <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Medicamento *</label>
                            <Input placeholder="Nome do medicamento…" value={pharmacyMed} onChange={e => setPharmacyMed(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                            <Select value={pharmacyStatus} onValueChange={v => setPharmacyStatus(v as typeof pharmacyStatus)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="dispensado">Dispensado</SelectItem>
                                <SelectItem value="devolvido">Devolvido</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Textarea placeholder="Observações (opcional)…" value={pharmacyNotes} onChange={e => setPharmacyNotes(e.target.value)} rows={2} className="resize-none" />
                        <div className="flex justify-end">
                          <Button size="sm" disabled={!pharmacyMed.trim() || addPharmacyEntry.isPending} onClick={handleAddPharmacy} className="gap-1.5">
                            <Send className="h-3.5 w-3.5" /> {addPharmacyEntry.isPending ? "Salvando…" : "Registrar Admissão"}
                          </Button>
                        </div>
                      </div>
                    ) : (() => {
                      const fp = [...pharmacyEntries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
                      if (!fp) return null;
                      const cfg = ({
                        pendente:   { label: "Pendente",   color: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30" },
                        dispensado: { label: "Dispensado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
                        devolvido:  { label: "Devolvido",  color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
                      } as const)[fp.status as "pendente" | "dispensado" | "devolvido"] ?? { label: fp.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                      return (
                        <div className="bg-card rounded-lg border border-sky-500/20 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-sky-500/5 border-b border-sky-500/10">
                            <div className="flex items-center gap-2">
                              <Pill className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                              <span className="text-sm font-semibold">{fp.medication}</span>
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", cfg.color)}>{cfg.label}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-sky-500/40 bg-sky-500/10 text-sky-300 uppercase tracking-wider">Admissão Inicial</span>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{format(new Date(fp.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                          {fp.notes && <div className="px-4 py-2.5"><p className="text-xs text-muted-foreground">{fp.notes}</p></div>}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: SINAIS VITAIS ────────────────────────────────────── */}
          <TabsContent value="vitais">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Sinais Vitais
              </h3>
              <div className="flex items-center gap-2">
                {pode("registrar_sinais_vitais") && (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setIsVitalsRecordOpen(true)}>
                    <Activity className="h-3.5 w-3.5" /> Registrar SVs
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handlePrintVitals}>
                  <Printer className="h-3.5 w-3.5" /> Imprimir SVs
                </Button>

              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
              <VitalCard label="Freq. Cardíaca" value={latestVitals?.hr ?? 0} unit="bpm" icon={<HeartPulse className="h-4 w-4 text-triage-red" />}
                alertClass={(latestVitals?.hr ?? 0) > 120 || (latestVitals?.hr ?? 0) < 50 ? "text-red-400" : (latestVitals?.hr ?? 0) > 100 || ((latestVitals?.hr ?? 0) > 0 && (latestVitals?.hr ?? 0) < 60) ? "text-orange-400" : ""} />
              <VitalCard label="Freq. Respiratória" value={latestVitals?.rr ?? 0} unit="irpm" icon={<Wind className="h-4 w-4 text-triage-blue" />}
                alertClass={(latestVitals?.rr ?? 0) > 25 || ((latestVitals?.rr ?? 0) > 0 && (latestVitals?.rr ?? 0) < 10) ? "text-red-400" : (latestVitals?.rr ?? 0) > 20 || ((latestVitals?.rr ?? 0) > 0 && (latestVitals?.rr ?? 0) < 12) ? "text-orange-400" : ""} />
              <VitalCard label="SpO₂" value={latestVitals?.spo2 ?? 0} unit="%" icon={<span className="text-xs font-bold text-sky-400">O₂</span>}
                alertClass={(latestVitals?.spo2 ?? 0) > 0 && (latestVitals?.spo2 ?? 0) < 90 ? "text-red-400" : (latestVitals?.spo2 ?? 0) > 0 && (latestVitals?.spo2 ?? 0) < 94 ? "text-orange-400" : (latestVitals?.spo2 ?? 0) > 0 && (latestVitals?.spo2 ?? 0) < 97 ? "text-yellow-400" : ""} />
              <VitalCard label="Temperatura" value={latestVitals?.temp ?? 0} unit="°C" icon={<Thermometer className="h-4 w-4 text-triage-orange" />}
                alertClass={(latestVitals?.temp ?? 0) >= 39 ? "text-red-400" : (latestVitals?.temp ?? 0) >= 38 ? "text-orange-400" : (latestVitals?.temp ?? 0) > 37.5 ? "text-yellow-400" : (latestVitals?.temp ?? 0) > 0 && (latestVitals?.temp ?? 0) < 36 ? "text-blue-400" : ""} />
              <VitalCard label="Glicemia" value={latestVitals?.glucose ?? 0} unit="mg/dL" icon={<Droplet className="h-4 w-4 text-triage-yellow" />}
                alertClass={(latestVitals?.glucose ?? 0) > 400 || ((latestVitals?.glucose ?? 0) > 0 && (latestVitals?.glucose ?? 0) < 60) ? "text-red-400" : (latestVitals?.glucose ?? 0) > 250 || ((latestVitals?.glucose ?? 0) > 0 && (latestVitals?.glucose ?? 0) < 70) ? "text-orange-400" : ""} />
            </div>

            {/* Balanço Hídrico */}
            <div className="mt-4 border border-sky-500/20 rounded-lg p-3 bg-sky-500/5">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5" /> Balanço Hídrico
                {latestVitals && (
                  <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal ml-1">
                    (último registro)
                  </span>
                )}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 px-1">Entrada</p>
                  <Card className="border-sky-500/20 bg-card/50">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Droplets className="h-4 w-4 text-sky-400 shrink-0" />
                        <span className="text-2xl font-mono font-bold">
                          {(latestVitals as { entradaMl?: number } | undefined)?.entradaMl
                            ? <>{(latestVitals as { entradaMl?: number }).entradaMl}<span className="text-muted-foreground text-sm font-normal ml-0.5">mL</span></>
                            : <span className="text-muted-foreground text-lg">—</span>
                          }
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 px-1">Saída</p>
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Droplet className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-2xl font-mono font-bold">
                          {(latestVitals as { saidaMl?: number } | undefined)?.saidaMl
                            ? <>{(latestVitals as { saidaMl?: number }).saidaMl}<span className="text-muted-foreground text-sm font-normal ml-0.5">mL</span></>
                            : <span className="text-muted-foreground text-lg">—</span>
                          }
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 px-1">Balanço</p>
                  {(() => {
                    const entrada = (latestVitals as { entradaMl?: number } | undefined)?.entradaMl ?? 0;
                    const saida   = (latestVitals as { saidaMl?: number } | undefined)?.saidaMl   ?? 0;
                    const bal     = entrada - saida;
                    const hasData = entrada > 0 || saida > 0;
                    return (
                      <Card className={cn(
                        "border-border/50 bg-card/50",
                        hasData && bal > 0 ? "border-sky-500/30" : hasData && bal < 0 ? "border-red-500/30" : ""
                      )}>
                        <CardContent className="py-3 px-4">
                          <span className={cn(
                            "text-2xl font-mono font-bold",
                            !hasData ? "text-muted-foreground" :
                            bal > 0 ? "text-sky-400" : bal < 0 ? "text-red-400" : "text-muted-foreground"
                          )}>
                            {!hasData
                              ? "—"
                              : <>{bal > 0 ? "+" : ""}{bal}<span className="text-sm font-normal ml-0.5">mL</span></>
                            }
                          </span>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── TAB: EVOLUÇÕES MÉDICAS ───────────────────────────────────── */}
          <TabsContent value="evol-medico">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-blue-400" /> Evoluções Médicas
                {history && history.filter(e => !e.soapText.includes("Admissão inicial") && (e as unknown as {professionalCategory?: string}).professionalCategory === "medico").length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {history.filter(e => !e.soapText.includes("Admissão inicial") && (e as unknown as {professionalCategory?: string}).professionalCategory === "medico").length}
                  </span>
                )}
              </h3>
            </div>
            <EvolutionMedico
              patientId={id}
              userId={activeUser?.id ?? 0}
              patientName={patient.full_name}
              patient={patient}
              staffMap={staffMap}
              latestVitals={latestVitals}
              staffCorenCrm={activeUser?.corenCrm ?? ""}
              onAfterSave={() => setShowPrintBanner(true)}
              canEdit={canEditMedico}
            />
          </TabsContent>

          {/* ── TAB: ENFERMAGEM ────────────────────────────────────────────── */}
          <TabsContent value="enfermagem">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-teal-400" /> Evolução de Enfermagem
              </h3>
            </div>
            <EvolutionEnfermagemDiaria
              patientId={id}
              userId={activeUser?.id ?? 0}
              patientName={patient.full_name}
              patient={patient}
              staffMap={staffMap}
              staffCorenCrm={activeUser?.corenCrm ?? ""}
              onAfterSave={() => setShowPrintBanner(true)}
              canEdit={canEditEnfermeiro}
            />
            {isEnfermeiro && (
              <div className="flex justify-end mt-2">
                <Link href={`/patients/${id}/ficha-enfermagem`}>
                  <Button size="sm" className="h-8 text-xs gap-1.5 bg-[#1a5c2a] hover:bg-[#154a21]">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Ficha de Atendimento de Enfermagem
                  </Button>
                </Link>
              </div>
            )}

          </TabsContent>

          {/* ── TAB: SAE ─────────────────────────────────────────────────── */}
          <TabsContent value="sae">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-400" /> SAE — Sistematização da Assistência de Enfermagem
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Registre aqui as avaliações sistematizadas: diagnóstico NANDA, avaliação por sistemas, prescrição de enfermagem e resultados esperados.
              </p>
            </div>
            <EvolutionEnfermeiro
              patientId={id}
              userId={activeUser?.id ?? 0}
              patientName={patient.full_name}
              patient={patient}
              staffMap={staffMap}
              staffCorenCrm={activeUser?.corenCrm ?? ""}
              canEdit={canEditEnfermeiro}
            />
          </TabsContent>

          {/* ── TAB: TÉCNICO ENFERMAGEM ───────────────────────────────────── */}
          <TabsContent value="tecnico">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-cyan-400" /> Anotação de Enfermagem
              </h3>
            </div>
            <EvolutionTecnico
              patientId={id}
              userId={activeUser?.id ?? 0}
              patientName={patient.full_name}
              patient={patient}
              staffMap={staffMap}
              canEdit={canEditTecnico}
            />
          </TabsContent>

          {/* ── TAB: PRESCRIÇÃO ───────────────────────────────────────── */}
          <TabsContent value="prescricao">
            <div className="space-y-6">

              {/* ── Prescrição Médica ─────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-purple-400" /> Prescrição Médica
                    </h3>
                    {prescriptions && prescriptions.filter(p => p.type === "medical" && p.status !== "concluido").length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        {prescriptions.filter(p => p.type === "medical" && p.status !== "concluido").length}
                      </span>
                    )}
                  </div>
                  {isMedico && pode("registrar_prescricao") && (
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => setIsPrescricaoMedicaOpen(true)}>
                      <Stethoscope className="h-3.5 w-3.5" /> Nova Prescrição Médica
                    </Button>
                  )}
                </div>
                {isLoadingPrescriptions ? (
                  <Skeleton className="h-24 w-full" />
                ) : !prescriptions || prescriptions.filter(p => p.type === "medical").length === 0 ? (
                  <div className="text-center py-4 bg-card rounded-lg border border-border/50">
                    <p className="text-sm text-muted-foreground">Nenhuma prescrição médica registrada.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prescriptions.filter(p => p.type === "medical").map(rx => {
                      const statusCfg = ({
                        pendente:     { label: "Pendente",     color: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30" },
                        em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                        concluido:    { label: "Concluído",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
                      } as const)[rx.status as "pendente" | "em_andamento" | "concluido"] ?? { label: rx.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                      const staffName = staffMap[rx.userId]?.name ?? (rx.userId > 0 ? `#${rx.userId}` : "—");
                      return (
                        <div key={rx.id} className="bg-card rounded-lg border border-purple-500/20 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-purple-500/5 border-b border-purple-500/15">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider bg-purple-500/10 text-purple-400 border-purple-500/30">Médica</span>
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", statusCfg.color)}>{statusCfg.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{format(new Date(rx.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                          <div className="px-4 py-3">
                            <pre className={cn("text-sm whitespace-pre-wrap font-sans mb-3", rx.status === "concluido" && "line-through text-muted-foreground")}>{rx.content}</pre>
                            <div className="flex items-center justify-between pt-2 border-t border-border/40">
                              <span className="text-xs text-muted-foreground">— {staffName}</span>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm" variant="outline"
                                  className="h-6 text-[10px] px-2 gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                  disabled={printingRxId === rx.id}
                                  onClick={async () => {
                                    setPrintingRxId(rx.id);
                                    try {
                                      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                                      const staffId = activeUser?.id ?? 0;
                                      const resp = await fetch(
                                        `${base}/api/patients/${id}/prescriptions/${rx.id}/pdf`,
                                        { headers: { "x-staff-id": String(staffId) } },
                                      );
                                      if (!resp.ok) throw new Error("Falha ao gerar PDF");
                                      const blob = await resp.blob();
                                      const href = URL.createObjectURL(blob);
                                      const safeName = patient.full_name.replace(/\s+/g, "_");
                                      const dateSlug = new Date(rx.createdAt).toISOString().slice(0, 10);
                                      const a = Object.assign(document.createElement("a"), {
                                        href,
                                        download: `Prescricao_Medica_${safeName}_${dateSlug}.pdf`,
                                      });
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(href);
                                    } catch {
                                      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
                                    } finally {
                                      setPrintingRxId(null);
                                    }
                                  }}
                                >
                                  <Printer className="h-3 w-3" />
                                  {printingRxId === rx.id ? "Gerando…" : "Imprimir"}
                                </Button>
                                {rx.status !== "concluido" && (
                                  <>
                                    {rx.status === "pendente" && (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                        onClick={() => updatePrescriptionStatus.mutate({ id, prescriptionId: rx.id, data: { status: "em_andamento" } },
                                          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(id) }),
                                            onError: () => toast({ title: "Erro ao atualizar prescrição", variant: "destructive" }) })}>Iniciar</Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                      onClick={() => updatePrescriptionStatus.mutate({ id, prescriptionId: rx.id, data: { status: "concluido" } },
                                        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(id) }),
                                          onError: () => toast({ title: "Erro ao atualizar prescrição", variant: "destructive" }) })}>Concluir</Button>
                                  </>
                                )}
                                {!(rx as unknown as { invalidado: boolean }).invalidado && (rx as unknown as { userId: number }).userId === activeUser?.id && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    onClick={() => { setInvalidarTarget({ type: "prescricao", id: rx.id }); setInvalidarMotivo(""); setIsInvalidarOpen(true); }}>
                                    <Ban className="h-3 w-3 mr-0.5" /> Invalidar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {(rx as unknown as { invalidado: boolean; motivoInvalidacao: string }).invalidado && (
                            <div className="px-4 py-2 bg-red-500/5 border-t border-red-500/20 flex items-center gap-2">
                              <Ban className="h-3 w-3 text-red-400 shrink-0" />
                              <span className="text-xs text-red-400 font-semibold">Invalidado</span>
                              {(rx as unknown as { motivoInvalidacao: string }).motivoInvalidacao && (
                                <span className="text-xs text-muted-foreground">— {(rx as unknown as { motivoInvalidacao: string }).motivoInvalidacao}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Prescrição de Cuidados de Enfermagem ──────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-blue-400" /> Prescrição de Enfermagem
                    </h3>
                    {prescriptions && prescriptions.filter(p => p.type === "nursing" && p.status !== "concluido").length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {prescriptions.filter(p => p.type === "nursing" && p.status !== "concluido").length}
                      </span>
                    )}
                  </div>
                  {isEnfermeiro && pode("registrar_prescricao") && (
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => setIsPrescricaoEnfermagemOpen(true)}>
                      <ClipboardCheck className="h-3.5 w-3.5" /> Nova Prescrição de Enfermagem
                    </Button>
                  )}
                </div>
                {isLoadingPrescriptions ? (
                  <Skeleton className="h-24 w-full" />
                ) : !prescriptions || prescriptions.filter(p => p.type === "nursing").length === 0 ? (
                  <div className="text-center py-4 bg-card rounded-lg border border-border/50">
                    <p className="text-sm text-muted-foreground">Nenhuma prescrição de enfermagem registrada.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prescriptions.filter(p => p.type === "nursing").map(rx => {
                      const statusCfg = ({
                        pendente:     { label: "Pendente",     color: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30" },
                        em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                        concluido:    { label: "Concluído",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
                      } as const)[rx.status as "pendente" | "em_andamento" | "concluido"] ?? { label: rx.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                      const staffName = staffMap[rx.userId]?.name ?? (rx.userId > 0 ? `#${rx.userId}` : "—");
                      return (
                        <div key={rx.id} className="bg-card rounded-lg border border-blue-500/20 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-blue-500/5 border-b border-blue-500/15">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider bg-blue-500/10 text-blue-400 border-blue-500/30">Enfermagem</span>
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", statusCfg.color)}>{statusCfg.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{format(new Date(rx.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                          <div className="px-4 py-3">
                            <pre className={cn("text-sm whitespace-pre-wrap font-sans mb-3", rx.status === "concluido" && "line-through text-muted-foreground")}>{rx.content}</pre>
                            <div className="flex items-center justify-between pt-2 border-t border-border/40">
                              <span className="text-xs text-muted-foreground">— {staffName}</span>
                              <div className="flex gap-1.5">
                                {rx.status !== "concluido" && (
                                  <>
                                    {rx.status === "pendente" && (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                        onClick={() => updatePrescriptionStatus.mutate({ id, prescriptionId: rx.id, data: { status: "em_andamento" } },
                                          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(id) }),
                                            onError: () => toast({ title: "Erro ao atualizar prescrição", variant: "destructive" }) })}>Iniciar</Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                      onClick={() => updatePrescriptionStatus.mutate({ id, prescriptionId: rx.id, data: { status: "concluido" } },
                                        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(id) }),
                                          onError: () => toast({ title: "Erro ao atualizar prescrição", variant: "destructive" }) })}>Concluir</Button>
                                  </>
                                )}
                                {!(rx as unknown as { invalidado: boolean }).invalidado && (rx as unknown as { userId: number }).userId === activeUser?.id && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    onClick={() => { setInvalidarTarget({ type: "prescricao", id: rx.id }); setInvalidarMotivo(""); setIsInvalidarOpen(true); }}>
                                    <Ban className="h-3 w-3 mr-0.5" /> Invalidar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {(rx as unknown as { invalidado: boolean; motivoInvalidacao: string }).invalidado && (
                            <div className="px-4 py-2 bg-red-500/5 border-t border-red-500/20 flex items-center gap-2">
                              <Ban className="h-3 w-3 text-red-400 shrink-0" />
                              <span className="text-xs text-red-400 font-semibold">Invalidado</span>
                              {(rx as unknown as { motivoInvalidacao: string }).motivoInvalidacao && (
                                <span className="text-xs text-muted-foreground">— {(rx as unknown as { motivoInvalidacao: string }).motivoInvalidacao}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tasks */}
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
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setIsTasksOpen(true)}>
                    <ListTodo className="h-3.5 w-3.5" /> Nova Pendência
                  </Button>
                </div>
                {isLoadingTasks ? (
                  <Skeleton className="h-24 w-full" />
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
                        pendente:     { label: "Pendente",     color: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30" },
                        em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                        concluido:    { label: "Concluído",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
                      } as const)[task.status as "pendente" | "em_andamento" | "concluido"] ?? { label: task.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                      return (
                        <div key={task.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", statusCfg.color)}>{statusCfg.label}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(task.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                          <div className="px-4 py-3">
                            <ul className="space-y-1.5 mb-3">
                              {items.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm">
                                  {task.status === "concluido" ? <CheckSquare className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                                  <span className={cn(task.status === "concluido" && "line-through text-muted-foreground")}>{item.text}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="flex items-center justify-between pt-2 border-t border-border/40">
                              <span className="text-xs text-muted-foreground">— {task.responsible}</span>
                              {task.status !== "concluido" && (
                                <div className="flex gap-1.5">
                                  {task.status === "pendente" && (
                                    <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                      onClick={() => updateTaskStatus.mutate({ id, taskId: task.id, data: { status: "em_andamento" } },
                                        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientTasksQueryKey(id) }),
                                          onError: () => toast({ title: "Erro ao atualizar pendência", variant: "destructive" }) })}>Iniciar</Button>
                                  )}
                                  <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                    onClick={() => updateTaskStatus.mutate({ id, taskId: task.id, data: { status: "concluido" } },
                                      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientTasksQueryKey(id) }),
                                        onError: () => toast({ title: "Erro ao atualizar pendência", variant: "destructive" }) })}>Concluir</Button>
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
          </TabsContent>

          {/* ── TAB: SINAN ───────────────────────────────────────────── */}
          {podeGerarPDF && (
            <TabsContent value="sinan">
              {isNotificationOpen ? (
                <NotificationForm
                  patient={patient}
                  notification={editingNotification ?? undefined}
                  onSuccess={() => { setIsNotificationOpen(false); setEditingNotification(null); }}
                  onCancel={() => { setIsNotificationOpen(false); setEditingNotification(null); }}
                />
              ) : (
              <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-400" /> Notificações Compulsórias
                  {notifications && notifications.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">{notifications.length}</span>
                  )}
                </h3>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  disabled={!pode("editar_paciente")}
                  onClick={() => { setEditingNotification(null); setIsNotificationOpen(true); }}>
                  <Bell className="h-3.5 w-3.5" /> Nova Notificação
                </Button>
              </div>
              {isLoadingNotifications ? (
                <Skeleton className="h-20 w-full" />
              ) : !notifications || notifications.length === 0 ? (
                <div className="text-center py-8 bg-card rounded-lg border border-border/50">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação compulsória registrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map(notif => (
                    <div key={notif.id} className="bg-card rounded-lg border border-amber-500/30 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                        <div className="flex items-center gap-2 flex-wrap">
                          {notif.disease && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider bg-amber-500/20 text-amber-400 border-amber-500/30">{notif.disease}</span>
                          )}
                          {notif.classification && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/40">{notif.classification}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{format(new Date(notif.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between pt-1.5 border-t border-border/40 mt-1.5">
                          <div className="flex items-center gap-2">
                            {notif.pdfUrl && (
                              <a href={notif.pdfUrl} download={`SINAN_${patient.full_name.replace(/\s+/g, "_")}.pdf`}
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                                <FileDown className="h-3 w-3" /> PDF salvo
                              </a>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              title="Imprimir / Gerar PDF SINAN" disabled={!podeGerarPDF}
                              onClick={() => window.open(`${import.meta.env.BASE_URL}patients/${id}/notifications/${notif.id}/print`, "_blank")}>
                              <Printer className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              title="Gerar e salvar PDF SINAN" disabled={!podeGerarPDF || generatingPdfId === notif.id}
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
                                  updateNotification.mutate({ id, notificationId: notif.id, data: { pdfUrl: dataUrl } }, {
                                    onSuccess: () => {
                                      queryClient.invalidateQueries({ queryKey: getGetPatientNotificationsQueryKey(id) });
                                      const href = URL.createObjectURL(blob);
                                      const a = Object.assign(document.createElement("a"), {
                                        href, download: `SINAN_${patient.full_name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
                                      });
                                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                      URL.revokeObjectURL(href);
                                      toast({ title: "PDF SINAN gerado e salvo com sucesso" });
                                    },
                                    onError: () => toast({ title: "Erro ao salvar PDF", variant: "destructive" }),
                                  });
                                } catch (e) {
                                  toast({ title: "Erro ao gerar PDF", description: String(e), variant: "destructive" });
                                } finally { setGeneratingPdfId(null); }
                              }}>
                              {generatingPdfId === notif.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-muted-foreground/20 text-muted-foreground hover:bg-muted/30"
                              disabled={!pode("editar_paciente")}
                              onClick={() => { setEditingNotification(notif); setIsNotificationOpen(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                              disabled={!pode("editar_paciente")}
                              onClick={() => deleteNotification.mutate({ id, notificationId: notif.id }, {
                                onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientNotificationsQueryKey(id) }),
                                onError: () => toast({ title: "Erro ao remover notificação", variant: "destructive" }),
                              })}>
                              <Trash className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </>
              )}
            </TabsContent>
          )}

          {/* ── TAB: TRANSFERÊNCIA ────────────────────────────────────── */}
          <TabsContent value="transferencia">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-400" /> Encaminhamento / Transferência
                {transfers && transfers.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">{transfers.length}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                  onClick={() => setIsTransferOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Novo Encaminhamento
                </Button>
              </div>
            </div>
            {isLoadingTransfers ? (
              <Skeleton className="h-24 w-full" />
            ) : !transfers || transfers.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-lg border border-border/50">
                <Truck className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum encaminhamento registrado.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Encaminhamento" para registrar.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transfers.map(tr => (
                  <div key={tr.id} className="bg-card rounded-lg border border-orange-500/30 overflow-hidden">
                    <div className="px-4 py-3 bg-orange-500/10 border-b border-orange-500/20 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-orange-400 shrink-0" />
                        <span className="font-semibold text-sm text-orange-300">ENCAMINHADO PARA: {tr.destinationHospital}</span>
                      </div>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider", TRANSFER_STATUS_COLORS[tr.transferStatus] ?? "bg-muted/20 text-muted-foreground border-border/30")}>
                        {tr.transferStatus}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {tr.specialty && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground/80">Especialidade:</span> {tr.specialty}
                        </p>
                      )}
                      {tr.reasonForTransfer && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground/80">Motivo:</span> {tr.reasonForTransfer}
                        </p>
                      )}
                      {tr.transportType && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground/80">Transporte:</span> {tr.transportType}
                        </p>
                      )}
                      {tr.regulationContact && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground/80">NIR/Regulação:</span> {tr.regulationContact}
                        </p>
                      )}
                      {tr.departureDatetime && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground/80">Saída:</span>{" "}
                          {format(new Date(tr.departureDatetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      {tr.arrivalConfirmation && (
                        <p className="text-xs text-green-400 font-medium">✓ Chegada confirmada no hospital de destino
                          {tr.arrivalDatetime && ` — ${format(new Date(tr.arrivalDatetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/50 mt-2 pt-2 border-t border-border/30">
                        Registrado {format(new Date(tr.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: SOCIAL ───────────────────────────────────────────── */}
          {pode("registrar_nota_social") && (
            <TabsContent value="social">
              <EvolutionSocial
                patientId={id}
                userId={activeUser?.id ?? 0}
                patientName={patient.full_name}
                patient={patient}
                staffMap={staffMap}
                staffCorenCrm={activeUser?.corenCrm ?? ""}
                canEdit={canEditSocial}
              />
            </TabsContent>
          )}

          {/* ── TAB: NUTRIÇÃO ─────────────────────────────────────────── */}
          {pode("registrar_avaliacao_nutricional") && (
            <TabsContent value="nutricao">
              <EvolutionNutricionista
                patientId={id}
                userId={activeUser?.id ?? 0}
                patientName={patient.full_name}
                patient={patient}
                staffMap={staffMap}
                staffCorenCrm={activeUser?.corenCrm ?? ""}
                canEdit={canEditNutricionista}
              />
            </TabsContent>
          )}

          {/* ── TAB: FARMÁCIA ─────────────────────────────────────────── */}
          {pode("registrar_farmacia") && (
            <TabsContent value="farmacia">
              <div className="mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
                  <Pill className="h-4 w-4 text-sky-400" /> Dispensação Farmacêutica
                  {pharmacyEntries && pharmacyEntries.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">{pharmacyEntries.length}</span>
                  )}
                </h3>
                <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3 mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Medicamento *</label>
                      <Input placeholder="Nome do medicamento…" value={pharmacyMed} onChange={e => setPharmacyMed(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                      <Select value={pharmacyStatus} onValueChange={v => setPharmacyStatus(v as typeof pharmacyStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="dispensado">Dispensado</SelectItem>
                          <SelectItem value="devolvido">Devolvido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Textarea placeholder="Observações (opcional)…" value={pharmacyNotes} onChange={e => setPharmacyNotes(e.target.value)} rows={2} className="resize-none" />
                  <div className="flex justify-end">
                    <Button size="sm" disabled={!pharmacyMed.trim() || addPharmacyEntry.isPending} onClick={handleAddPharmacy} className="gap-1.5">
                      <Send className="h-3.5 w-3.5" /> {addPharmacyEntry.isPending ? "Salvando…" : !pharmacyEntries || pharmacyEntries.length === 0 ? "Registrar Admissão" : "Registrar Evolução Diária"}
                    </Button>
                  </div>
                </div>
              </div>
              {isLoadingPharmacy ? (
                <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : !pharmacyEntries || pharmacyEntries.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Nenhuma dispensação registrada ainda.</div>
              ) : (
                <div className="space-y-3">
                  {pharmacyEntries.map((entry, _idx, arr) => {
                    const firstPharmacyId = arr.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]?.id;
                    const isAdmissaoFarm = entry.id === firstPharmacyId;
                    const statusCfg = ({
                      pendente:    { label: "Pendente",    color: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30" },
                      dispensado:  { label: "Dispensado",  color: "bg-green-500/20 text-green-400 border-green-500/30" },
                      devolvido:   { label: "Devolvido",   color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
                    } as const)[entry.status as "pendente" | "dispensado" | "devolvido"] ?? { label: entry.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                    return (
                      <div key={entry.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                          <div className="flex items-center gap-2">
                            <Pill className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                            <span className="text-sm font-semibold">{entry.medication}</span>
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", statusCfg.color)}>{statusCfg.label}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${isAdmissaoFarm ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-border/40 bg-muted/10 text-muted-foreground/60"}`}>
                              {isAdmissaoFarm ? "Admissão Inicial" : "Evolução Diária"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{format(new Date(entry.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                        <div className="px-4 py-2.5 flex items-center justify-between">
                          <div>
                            {entry.notes && <p className="text-xs text-muted-foreground">{entry.notes}</p>}
                            <p className="text-xs text-muted-foreground/50">{staffMap[entry.userId]?.name ?? `Farmacêutico ID ${entry.userId}`}</p>
                          </div>
                          {entry.status !== "dispensado" && (
                            <div className="flex gap-1.5">
                              {entry.status === "pendente" && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                  onClick={() => updatePharmacyStatus.mutate({ id, entryId: entry.id, data: { status: "dispensado" } },
                                    { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientPharmacyEntriesQueryKey(id) }),
                                      onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }) })}>Dispensar</Button>
                              )}
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-gray-500/30 text-gray-400 hover:bg-gray-500/10"
                                onClick={() => updatePharmacyStatus.mutate({ id, entryId: entry.id, data: { status: "devolvido" } },
                                  { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientPharmacyEntriesQueryKey(id) }),
                                    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }) })}>Devolver</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}
          {/* ── TAB: EXAMES ───────────────────────────────────────────── */}
          {(pode("registrar_prescricao") || pode("registrar_exames") || pode("visualizar_setores")) && (
            <TabsContent value="exames">
              <PatientLabTab patientId={id} active={activeTab === "exames"} readOnly={true} />
            </TabsContent>
          )}

          {/* ── TAB: SOL. EXAMES ──────────────────────────────────────── */}
          {pode("registrar_prescricao") && (
            <TabsContent value="sol-exames">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-teal-400" /> Solicitação de Exames
                  </h3>
                  {/* APAC — acesso rápido para médicos */}
                  {isMedico && pode("gerar_pdf") && (
                    <Button
                      size="sm" variant="outline"
                      className="h-8 text-xs gap-1.5 border-teal-500/40 text-teal-300 hover:bg-teal-500/10"
                      disabled={downloadingApac}
                      onClick={async () => {
                        setDownloadingApac(true);
                        try {
                          const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                          const resp = await fetch(`${base}/api/patients/${id}/pdf/apac`, { headers: { "x-staff-id": String(activeUser?.id ?? 0) } });
                          if (!resp.ok) throw new Error();
                          const blob = await resp.blob();
                          const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `APAC_${patient?.full_name?.replace(/\s+/g,"_")}.pdf` });
                          document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        } catch { toast({ title: "Erro ao gerar APAC", variant: "destructive" }); }
                        finally { setDownloadingApac(false); }
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      {downloadingApac ? "Gerando…" : "Gerar APAC (PDF)"}
                    </Button>
                  )}
                </div>

                <div className="bg-card border border-border/50 rounded-lg p-4 space-y-4">
                  {/* Lab exams */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Exames Laboratoriais</label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Ex: Hemograma completo, PCR, Glicemia..."
                        value={solExameLabInput}
                        onChange={e => setSolExameLabInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && solExameLabInput.trim()) {
                            e.preventDefault();
                            setSolExameLabs(prev => [...prev, solExameLabInput.trim()]);
                            setSolExameLabInput("");
                          }
                        }}
                        className="text-sm"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={() => {
                        if (solExameLabInput.trim()) { setSolExameLabs(prev => [...prev, solExameLabInput.trim()]); setSolExameLabInput(""); }
                      }}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {solExameLabs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {solExameLabs.map((lab, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300">
                            {lab}
                            <button type="button" onClick={() => setSolExameLabs(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-400 transition-colors">
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Imaging exams */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Exames de Imagem</label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Ex: RX Tórax, TC Crânio, ECG..."
                        value={solExameImgInput}
                        onChange={e => setSolExameImgInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && solExameImgInput.trim()) {
                            e.preventDefault();
                            setSolExameImagem(prev => [...prev, solExameImgInput.trim()]);
                            setSolExameImgInput("");
                          }
                        }}
                        className="text-sm"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={() => {
                        if (solExameImgInput.trim()) { setSolExameImagem(prev => [...prev, solExameImgInput.trim()]); setSolExameImgInput(""); }
                      }}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {solExameImagem.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {solExameImagem.map((img, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                            {img}
                            <button type="button" onClick={() => setSolExameImagem(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-400 transition-colors">
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Priority + justification */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
                      <select
                        value={solExamePrioridade}
                        onChange={e => setSolExamePrioridade(e.target.value as "urgente" | "rotina" | "eletivo")}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="urgente">Urgente</option>
                        <option value="rotina">Rotina</option>
                        <option value="eletivo">Eletivo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Justificativa (opcional)</label>
                      <Input
                        placeholder="Indicação clínica..."
                        value={solExameJustificativa}
                        onChange={e => setSolExameJustificativa(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={solExameLoading || (solExameLabs.length === 0 && solExameImagem.length === 0)}
                      onClick={handleSolicitarExame}
                      className="gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {solExameLoading ? "Solicitando…" : `Solicitar ${solExameLabs.length + solExameImagem.length} exame(s)`}
                    </Button>
                  </div>
                </div>

                {/* Full exam requests list with action buttons */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FlaskConical className="h-3.5 w-3.5 text-orange-400" /> Histórico de Solicitações
                    {examRequests && examRequests.filter(e => e.status !== "laudado").length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        {examRequests.filter(e => e.status !== "laudado").length}
                      </span>
                    )}
                  </h4>
                  {isLoadingExamRequests ? (
                    <Skeleton className="h-24 w-full" />
                  ) : !examRequests || examRequests.length === 0 ? (
                    <div className="text-center py-6 bg-card rounded-lg border border-border/50">
                      <FlaskConical className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma solicitação de exame registrada.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {examRequests.map(exam => {
                        const prioConfig = ({
                          urgente: { label: "Urgente", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                          rotina:  { label: "Rotina",  color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                          eletivo: { label: "Eletivo", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
                        } as const)[exam.prioridade as "urgente" | "rotina" | "eletivo"] ?? { label: exam.prioridade, color: "bg-muted/20 text-muted-foreground border-border/30" };
                        const statusConfig = ({
                          solicitado: { label: "Solicitado", color: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30" },
                          coletado:   { label: "Coletado",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                          laudado:    { label: "Laudado",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
                        } as const)[exam.status as "solicitado" | "coletado" | "laudado"] ?? { label: exam.status, color: "bg-muted/20 text-muted-foreground border-border/30" };
                        const allExams = [
                          ...(exam.laboratoriais as string[]).map(e => ({ nome: e, tipo: "Lab" })),
                          ...(exam.imagem as string[]).map(e => ({ nome: e, tipo: "Img" })),
                        ];
                        return (
                          <div key={exam.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", prioConfig.color)}>{prioConfig.label}</span>
                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", statusConfig.color)}>{statusConfig.label}</span>
                                <span className="text-[10px] text-muted-foreground">{allExams.length} exame{allExams.length !== 1 ? "s" : ""}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{format(new Date(exam.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                            </div>
                            <div className="px-4 py-3 space-y-3">
                              <div className="flex flex-wrap gap-1.5">
                                {allExams.map((e, idx) => (
                                  <span key={idx} className={cn(
                                    "text-[10px] px-2 py-0.5 rounded border",
                                    e.tipo === "Lab"
                                      ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                                      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
                                    exam.status === "laudado" && "opacity-50 line-through"
                                  )}>
                                    <span className="font-bold mr-1">[{e.tipo}]</span>{e.nome}
                                  </span>
                                ))}
                              </div>
                              {exam.justificativa && (
                                <p className="text-xs text-muted-foreground italic">Justificativa: {exam.justificativa}</p>
                              )}
                              {exam.status === "laudado" && (exam.resultText || exam.resultFileName) && (
                                <div className="mt-2 p-3 rounded-md bg-green-500/5 border border-green-500/20 space-y-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400">Laudo / Resultado</p>
                                  {exam.resultText && (
                                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{exam.resultText}</p>
                                  )}
                                  {exam.resultFileName && exam.resultFileData && (
                                    <a
                                      href={`data:${exam.resultFileMime || "application/octet-stream"};base64,${exam.resultFileData}`}
                                      download={exam.resultFileName}
                                      className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-colors"
                                    >
                                      <Download className="h-3 w-3" />
                                      {exam.resultFileName}
                                    </a>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40 flex-wrap">
                                {exam.status !== "laudado" && !(exam as unknown as { invalidado: boolean }).invalidado && (
                                  <>
                                    {exam.status === "solicitado" && (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                        onClick={() => updateExamStatus.mutate(
                                          { id, examRequestId: exam.id, data: { status: "coletado" } },
                                          { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientExamRequestsQueryKey(id) }),
                                            onError: () => toast({ title: "Erro ao atualizar exame", variant: "destructive" }) }
                                        )}>Marcar Coletado</Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                      onClick={() => {
                                        setLaudarExamId(exam.id);
                                        setLaudarResultText("");
                                        setLaudarFileName("");
                                        setLaudarFileData("");
                                        setLaudarFileMime("");
                                        setIsLaudarOpen(true);
                                      }}>Marcar Laudado</Button>
                                  </>
                                )}
                                {!(exam as unknown as { invalidado: boolean }).invalidado && (exam as unknown as { userId?: number }).userId === activeUser?.id && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    onClick={() => { setInvalidarTarget({ type: "exame", id: exam.id }); setInvalidarMotivo(""); setIsInvalidarOpen(true); }}>
                                    <Ban className="h-3 w-3 mr-0.5" /> Invalidar
                                  </Button>
                                )}
                                {(exam as unknown as { invalidado: boolean }).invalidado && (
                                  <span className="text-xs text-red-400 font-semibold flex items-center gap-1">
                                    <Ban className="h-3 w-3" /> Invalidado
                                    {(exam as unknown as { motivoInvalidacao: string }).motivoInvalidacao && (
                                      <span className="text-muted-foreground font-normal">— {(exam as unknown as { motivoInvalidacao: string }).motivoInvalidacao}</span>
                                    )}
                                  </span>
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
            </TabsContent>
          )}

          {/* ── TAB: LABORATÓRIO ──────────────────────────────────────── */}
          <TabsContent value="laboratorio">
            <PatientLabTab patientId={id} active={activeTab === "laboratorio"} />
          </TabsContent>

          {/* ── TAB: DISPOSITIVOS ─────────────────────────────────────── */}
          <TabsContent value="dispositivos">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Plug className="h-4 w-4 text-cyan-400" /> Dispositivos Invasivos
                {devices && devices.filter(d => !d.removedAt).length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    {devices.filter(d => !d.removedAt).length} ativo(s)
                  </span>
                )}
              </h3>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
                onClick={() => { setDeviceType(""); setDeviceDate(new Date().toISOString().split("T")[0]); setDeviceSite(""); setDeviceNotes(""); setIsAddDeviceOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Adicionar Dispositivo
              </Button>
            </div>

            {isLoadingDevices ? (
              <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : !devices || devices.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-lg border border-border/50">
                <Plug className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum dispositivo registrado.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Adicionar Dispositivo" para registrar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active devices */}
                {devices.filter(d => !d.removedAt).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400/80 mb-2">Ativos</p>
                    <div className="space-y-2">
                      {devices.filter(d => !d.removedAt).map(dev => {
                        const days = daysSince(dev.insertionDate);
                        return (
                          <div key={dev.id} className="bg-card rounded-lg border border-cyan-500/20 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2 bg-cyan-500/5 border-b border-cyan-500/10">
                              <span className="text-sm font-semibold text-cyan-300 flex items-center gap-1.5">
                                <Plug className="h-3.5 w-3.5" />
                                {DEVICE_LABELS[dev.deviceType] ?? dev.deviceType}
                              </span>
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-[10px] gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
                                disabled={removingDeviceId === dev.id}
                                onClick={() => {
                                  setRemovingDeviceId(dev.id);
                                  updateDevice.mutate(
                                    { id, deviceId: dev.id, data: { removedAt: new Date().toISOString() } },
                                    {
                                      onSuccess: () => {
                                        queryClient.invalidateQueries({ queryKey: getGetPatientDevicesQueryKey(id) });
                                        toast({ title: "Dispositivo retirado com sucesso" });
                                      },
                                      onError: () => toast({ title: "Erro ao retirar dispositivo", variant: "destructive" }),
                                      onSettled: () => setRemovingDeviceId(null),
                                    }
                                  );
                                }}
                              >
                                <Unplug className="h-3 w-3" />
                                {removingDeviceId === dev.id ? "Retirando…" : "Retirar"}
                              </Button>
                            </div>
                            <div className="px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                              <span><strong className="text-foreground/70">Inserido em:</strong> {fmtDeviceDate(dev.insertionDate)}</span>
                              <span className={days > 7 ? "text-amber-400 font-semibold" : ""}>
                                <strong className="text-foreground/70">Dias:</strong> {days} {days > 7 && <AlertCircle className="h-3 w-3 inline ml-0.5" />}
                              </span>
                              {dev.insertionSite && <span><strong className="text-foreground/70">Local:</strong> {dev.insertionSite}</span>}
                              {dev.notes && <span className="w-full"><strong className="text-foreground/70">Obs:</strong> {dev.notes}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Removed devices */}
                {devices.filter(d => !!d.removedAt).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">Histórico — Retirados</p>
                    <div className="space-y-1.5">
                      {devices.filter(d => !!d.removedAt).map(dev => (
                        <div key={dev.id} className="bg-card/50 rounded-lg border border-border/30 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-0.5 opacity-60">
                          <span className="text-xs font-medium line-through">{DEVICE_LABELS[dev.deviceType] ?? dev.deviceType}</span>
                          <span className="text-[10px] text-muted-foreground">Inserido: {fmtDeviceDate(dev.insertionDate)}</span>
                          {dev.insertionSite && <span className="text-[10px] text-muted-foreground">Local: {dev.insertionSite}</span>}
                          {dev.removedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              Retirado: {format(new Date(dev.removedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: REGULAÇÃO / NIR ────────────────────────────────────── */}
          <TabsContent value="regulacao">
            <div className="flex justify-end mb-3">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handlePrintAtualizacaoQuadro}>
                <Printer className="h-3.5 w-3.5" /> Atualização de Quadro Clínico
              </Button>
            </div>
            <PatientNirTab patientId={id} />
          </TabsContent>

          {/* ── TAB: LINHA DO TEMPO ─────────────────────────────────────── */}
          <TabsContent value="timeline">
            <PatientTimelineTab patientId={id} />
          </TabsContent>

          {/* ── TAB: FICHA DE TRIAGEM ─────────────────────────────────── */}
          <TabsContent value="ficha-triagem">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-teal-400" />
                  Ficha de Triagem
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Documento gerado pelo Enfermeiro no momento da triagem — classificação de risco Manchester, dados clínicos e registro de entrada.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 py-6">
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Gera a ficha oficial de triagem em PDF com todos os dados do paciente, classificação de risco e hora de atendimento.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-sm gap-2 border-teal-500/40 text-teal-400 hover:bg-teal-500/10"
                  disabled={downloadingFichaTriagem}
                  onClick={async () => {
                    setDownloadingFichaTriagem(true);
                    try {
                      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                      const resp = await fetch(`${base}/api/patients/${id}/pdf/ficha-triagem`, { headers: { "x-staff-id": String(activeUser?.id ?? 0) } });
                      if (!resp.ok) throw new Error();
                      const blob = await resp.blob();
                      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `FichaTriagem_${patient?.full_name?.replace(/\s+/g,"_")}.pdf` });
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    } catch { toast({ title: "Erro ao gerar Ficha de Triagem", variant: "destructive" }); }
                    finally { setDownloadingFichaTriagem(false); }
                  }}
                >
                  <FileDown className="h-4 w-4" />
                  {downloadingFichaTriagem ? "Gerando…" : "Baixar Ficha de Triagem (PDF)"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: ALERGIAS ─────────────────────────────────────────── */}
          <TabsContent value="alergias">
            <PatientAllergiesTab patientId={id} canEdit={pode("registrar_alergia")} />
          </TabsContent>

          {/* ── TAB: TCLE ─────────────────────────────────────────────── */}
          <TabsContent value="tcle">
            <PatientTcleTab patientId={id} canEdit={pode("registrar_consentimento")} patientName={patient?.full_name ?? ""} />
          </TabsContent>

          {/* ── TAB: PROCEDIMENTOS ────────────────────────────────────── */}
          <TabsContent value="procedimentos">
            <PatientProceduresTab patientId={id} canEdit={pode("registrar_procedimento")} patientName={patient?.full_name ?? ""} />
          </TabsContent>

          {/* ── TAB: INTERCONSULTA ────────────────────────────────────── */}
          <TabsContent value="interconsulta">
            <PatientInterconsultsTab patientId={id} canEdit={pode("registrar_interconsulta")} />
          </TabsContent>

          {/* ── TAB: PLANO DE CUIDADOS ────────────────────────────────── */}
          <TabsContent value="plano-cuidados">
            <PatientCarePlanTab patientId={id} canEdit={pode("registrar_plano_cuidados")} />
          </TabsContent>

          {/* ── TAB: MED. CONTROLADOS ─────────────────────────────────── */}
          <TabsContent value="med-controlados">
            <PatientControlledMedsTab
              patientId={id}
              patientName={patient?.full_name ?? ""}
              canEdit={pode("registrar_medicamento_controlado")}
              canDispense={pode("registrar_dispensacao")}
            />
          </TabsContent>

          {/* ── TAB: DISPENSAÇÃO ──────────────────────────────────────── */}
          <TabsContent value="dispensacao">
            <PatientDispensationsTab patientId={id} canEdit={pode("registrar_dispensacao")} />
          </TabsContent>

          {/* ── TAB: ÓBITO ────────────────────────────────────────────── */}
          <TabsContent value="obito">
            <PatientObitoTab patientId={id} patientName={patient?.full_name ?? ""} canEdit={pode("registrar_obito")} />
          </TabsContent>

          {/* ── TAB: INVENTÁRIO DE PERTENCES ─────────────────────────── */}
          <TabsContent value="inventario-pertences">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-400" />
                  Inventário de Pertences do Paciente
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Registro dos pertences entregues pelo paciente ou acompanhante na admissão. Este documento protege a unidade e o paciente.
                </p>
              </CardHeader>
              <CardContent>
                <PatientInventarioTab patientId={id} patientName={patient?.full_name ?? ""} canEdit={pode("registrar_consentimento")} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: ESCALAS DE RISCO ────────────────────────────────── */}
          <TabsContent value="escalas-risco">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-orange-400" />
                  Escalas de Risco
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Avaliação de riscos clínicos — Escala de Braden (lesão por pressão) e Escala de Morse (quedas).
                </p>
              </CardHeader>
              <CardContent>
                <PatientEscalasRiscoTab patientId={id} canEdit={canEditEnfermeiro} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: EVENTO ADVERSO ──────────────────────────────────── */}
          <TabsContent value="evento-adverso">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Notificação de Evento Adverso / Incidente
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Registro de eventos adversos, incidentes sem dano ou near miss ocorridos durante o atendimento. Guarda mínima: 5 anos.
                </p>
              </CardHeader>
              <CardContent>
                <PatientEventoAdversoTab patientId={id} patientName={patient?.full_name ?? ""} canEdit={pode("registrar_evolucao")} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: SUMÁRIO DE ALTA ─────────────────────────────────── */}
          <TabsContent value="sumario-alta">
            <PatientSumarioAltaTab
              patient={patient as unknown as Parameters<typeof PatientSumarioAltaTab>[0]["patient"]}
              history={history as unknown as Parameters<typeof PatientSumarioAltaTab>[0]["history"]}
              prescriptions={prescriptions as unknown as Parameters<typeof PatientSumarioAltaTab>[0]["prescriptions"]}
              staffMap={staffMap as unknown as Parameters<typeof PatientSumarioAltaTab>[0]["staffMap"]}
              canEdit={canEditMedico}
            />
          </TabsContent>

          {/* ── TAB: CHECKLIST DE ALTA ───────────────────────────────── */}
          <TabsContent value="checklist-alta">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-emerald-400" />
                  Checklist de Alta
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Verificação dos itens obrigatórios antes da saída do paciente da unidade.
                </p>
              </CardHeader>
              <CardContent>
                <PatientChecklistAltaTab patientId={id} patientName={patient?.full_name ?? ""} canEdit={canEditEnfermeiro} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: ATESTADO MÉDICO ─────────────────────────────────── */}
          <TabsContent value="atestado-medico">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  Atestado Médico / Comparecimento
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Geração de atestado médico de afastamento ou declaração de comparecimento para o paciente.
                </p>
              </CardHeader>
              <CardContent>
                <PatientAtestadoTab patientId={id} patient={patient} canEdit={canEditMedico} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: ORIENTAÇÕES DE ALTA ─────────────────────────────── */}
          <TabsContent value="orientacoes-alta">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-teal-400" />
                  Orientações de Alta
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Instruções multiprofissionais para o paciente e família após a alta — medicações, cuidados, retorno.
                </p>
              </CardHeader>
              <CardContent>
                <PatientOrientacoesAltaTab patientId={id} patientName={patient?.full_name ?? ""} canEdit={canEditEnfermeiro || canEditMedico} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: FICHA DE REFERÊNCIA / CONTRA-REFERÊNCIA ─────────── */}
          <TabsContent value="ficha-referencia">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileDown className="h-4 w-4 text-amber-400" />
                  Ficha de Referência / Contra-Referência
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Documento oficial da Prefeitura de Breves para referência e contra-referência do paciente entre unidades de saúde. Gerado no momento da alta com os dados clínicos preenchidos.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 py-6">
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  O PDF é preenchido automaticamente com os dados do paciente, diagnóstico, conduta e informações de contato da UPA Breves.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-sm gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  disabled={downloadingFichaRef}
                  onClick={async () => {
                    setDownloadingFichaRef(true);
                    try {
                      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                      const resp = await fetch(`${base}/api/patients/${id}/pdf/ficha-referencia`, { headers: { "x-staff-id": String(activeUser?.id ?? 0) } });
                      if (!resp.ok) throw new Error();
                      const blob = await resp.blob();
                      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `FichaReferencia_${patient?.full_name?.replace(/\s+/g,"_")}.pdf` });
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    } catch { toast({ title: "Erro ao gerar Ficha de Referência", variant: "destructive" }); }
                    finally { setDownloadingFichaRef(false); }
                  }}
                >
                  <FileDown className="h-4 w-4" />
                  {downloadingFichaRef ? "Gerando…" : "Baixar Ficha de Referência (PDF)"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>

      {/* ── DIALOGS ──────────────────────────────────────────────────── */}
      {/* ── LAUDAR DIALOG ─────────────────────────────────────────── */}
      <Dialog open={isLaudarOpen} onOpenChange={open => { if (!laudarSubmitting) setIsLaudarOpen(open); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-green-400" /> Registrar Laudo
            </DialogTitle>
            <DialogDescription>Adicione o resultado em texto e/ou anexe um arquivo (PDF, imagem). Ambos são opcionais.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Resultado / Laudo em Texto <span className="text-muted-foreground text-xs">(opcional)</span></label>
              <Textarea
                placeholder="Ex: Hemoglobina 12,5 g/dL, Leucócitos 8.200/μL..."
                value={laudarResultText}
                onChange={e => setLaudarResultText(e.target.value)}
                rows={4}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Arquivo Anexo <span className="text-muted-foreground text-xs">(opcional)</span></label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) { setLaudarFileName(""); setLaudarFileData(""); setLaudarFileMime(""); return; }
                  setLaudarFileName(file.name);
                  setLaudarFileMime(file.type);
                  setLaudarFileReading(true);
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const result = ev.target?.result as string;
                    const base64 = result.split(",")[1] ?? "";
                    setLaudarFileData(base64);
                    setLaudarFileReading(false);
                  };
                  reader.onerror = () => setLaudarFileReading(false);
                  reader.readAsDataURL(file);
                }}
              />
              {laudarFileName && (
                <p className="text-xs text-green-400 flex items-center gap-1.5">
                  <Download className="h-3 w-3" /> {laudarFileName}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsLaudarOpen(false)} disabled={laudarSubmitting}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={laudarSubmitting || laudarFileReading}
              onClick={() => {
                if (laudarExamId == null) return;
                setLaudarSubmitting(true);
                updateExamStatus.mutate(
                  {
                    id,
                    examRequestId: laudarExamId,
                    data: {
                      status: "laudado",
                      resultText: laudarResultText,
                      resultFileName: laudarFileName,
                      resultFileData: laudarFileData,
                      resultFileMime: laudarFileMime,
                    },
                  },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getGetPatientExamRequestsQueryKey(id) });
                      toast({ title: "Laudo registrado com sucesso" });
                      setIsLaudarOpen(false);
                    },
                    onError: (err: unknown) => {
                      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                      toast({ title: msg ?? "Erro ao registrar laudo", variant: "destructive" });
                    },
                    onSettled: () => setLaudarSubmitting(false),
                  }
                );
              }}
            >
              {laudarSubmitting ? "Salvando..." : "Confirmar Laudo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── INVALIDAR DIALOG ─────────────────────────────────────── */}
      <Dialog open={isInvalidarOpen} onOpenChange={open => { if (!invalidarLoading) setIsInvalidarOpen(open); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Ban className="h-4 w-4" /> Invalidar Registro
            </DialogTitle>
            <DialogDescription>
              Esta ação marca o registro como inválido e não pode ser desfeita. Informe o motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-sm font-medium block mb-1.5">Motivo da Invalidação <span className="text-muted-foreground text-xs">(opcional)</span></label>
              <Textarea
                placeholder="Ex: Prescrição duplicada, erro de preenchimento, dado incorreto..."
                value={invalidarMotivo}
                onChange={e => setInvalidarMotivo(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsInvalidarOpen(false)} disabled={invalidarLoading}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={invalidarLoading}
              onClick={handleInvalidar}
            >
              <Ban className="h-3.5 w-3.5 mr-1.5" />
              {invalidarLoading ? "Invalidando…" : "Confirmar Invalidação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ADD DEVICE DIALOG ─────────────────────────────────────── */}
      <Dialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-cyan-400" /> Adicionar Dispositivo
            </DialogTitle>
            <DialogDescription>Registre o dispositivo invasivo com data obrigatória de inserção.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de Dispositivo <span className="text-destructive text-xs">*</span></label>
              <select
                value={deviceType}
                onChange={e => setDeviceType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione o dispositivo...</option>
                {DEVICE_TYPES.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Data de Inserção <span className="text-destructive text-xs">*</span></label>
              <Input
                type="date"
                value={deviceDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={e => setDeviceDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Local de Inserção <span className="text-muted-foreground text-xs">(opcional)</span></label>
              <Input
                placeholder="Ex: MSD, MID, subclávia D, inguinal E…"
                value={deviceSite}
                onChange={e => setDeviceSite(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observações <span className="text-muted-foreground text-xs">(opcional)</span></label>
              <Textarea
                placeholder="Calibre, curativo, intercorrências…"
                rows={2}
                value={deviceNotes}
                onChange={e => setDeviceNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" onClick={() => setIsAddDeviceOpen(false)} disabled={addDevice.isPending}>
                Cancelar
              </Button>
              <Button
                disabled={!deviceType || !deviceDate || addDevice.isPending}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
                onClick={() => {
                  addDevice.mutate(
                    { id, data: { deviceType: deviceType as AddPatientDeviceBodyDeviceType, insertionDate: deviceDate, insertionSite: deviceSite, notes: deviceNotes } },
                    {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getGetPatientDevicesQueryKey(id) });
                        toast({ title: "Dispositivo registrado com sucesso" });
                        setIsAddDeviceOpen(false);
                      },
                      onError: () => toast({ title: "Erro ao registrar dispositivo", variant: "destructive" }),
                    }
                  );
                }}
              >
                {addDevice.isPending ? "Salvando…" : "Registrar Dispositivo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prontuário</DialogTitle>
            <DialogDescription>Atualize os dados clínicos do paciente.</DialogDescription>
          </DialogHeader>
          <PatientForm
            patient={patient}
            onSuccess={() => setIsEditOpen(false)}
            onCancel={() => setIsEditOpen(false)}
            restrictToPersonal={["recepcionista", "auxiliar_administrativo"].includes(activeUser?.role ?? "")}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isVitalsRecordOpen} onOpenChange={setIsVitalsRecordOpen}>
        <DialogContent className="sm:max-w-[420px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registro de Sinais Vitais</DialogTitle>
            <DialogDescription>Registre os sinais vitais aferidos agora.</DialogDescription>
          </DialogHeader>
          <VitalsRecordForm patient={patient} onSuccess={() => setIsVitalsRecordOpen(false)} onCancel={() => setIsVitalsRecordOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isVitalsOpen} onOpenChange={setIsVitalsOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evolução de Enfermagem</DialogTitle>
            <DialogDescription>Preencha o SOAP e registre a evolução do paciente.</DialogDescription>
          </DialogHeader>
          <VitalsUpdateForm patient={patient} onSuccess={() => setIsVitalsOpen(false)} onCancel={() => setIsVitalsOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isPrescricaoMedicaOpen} onOpenChange={setIsPrescricaoMedicaOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-purple-400" /> Nova Prescrição Médica
            </DialogTitle>
            <DialogDescription>Prescrição médica estruturada — medicamentos, exames, dieta e condutas.</DialogDescription>
          </DialogHeader>
          <PrescriptionForm
            patient={patient}
            userId={activeUser?.id ?? 0}
            forceType="medical"
            onSuccess={() => setIsPrescricaoMedicaOpen(false)}
            onCancel={() => setIsPrescricaoMedicaOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isPrescricaoEnfermagemOpen} onOpenChange={setIsPrescricaoEnfermagemOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-blue-400" /> Nova Prescrição de Enfermagem
            </DialogTitle>
            <DialogDescription>Prescrição de cuidados de enfermagem para este paciente.</DialogDescription>
          </DialogHeader>
          <PrescriptionForm
            patient={patient}
            userId={activeUser?.id ?? 0}
            forceType="nursing"
            onSuccess={() => setIsPrescricaoEnfermagemOpen(false)}
            onCancel={() => setIsPrescricaoEnfermagemOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isTasksOpen} onOpenChange={setIsTasksOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Pendência</DialogTitle>
            <DialogDescription>Registre tarefas pendentes para este paciente.</DialogDescription>
          </DialogHeader>
          <TasksForm patientId={id} patientName={patient.full_name} defaultResponsible={patient.responsibleProfessional ?? ""}
            onSuccess={() => setIsTasksOpen(false)} onCancel={() => setIsTasksOpen(false)} />
        </DialogContent>
      </Dialog>


      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-400" /> Novo Encaminhamento / Transferência
            </DialogTitle>
            <DialogDescription>Registre os dados do encaminhamento para outro hospital.</DialogDescription>
          </DialogHeader>
          <TransferForm patientId={id} onSuccess={() => { setIsTransferOpen(false); queryClient.invalidateQueries({ queryKey: getGetPatientTransfersQueryKey(id) }); }}
            onCancel={() => setIsTransferOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Print banner — shown after saving evolution draft */}
      {showPrintBanner && (
        <div className="no-print fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-xl rounded-lg px-5 py-3 flex items-center gap-3 min-w-[300px] max-w-sm">
          <Printer className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm flex-1">Evolução salva! Deseja imprimir?</span>
          <Button size="sm" className="h-7 text-xs" onClick={() => { window.print(); setShowPrintBanner(false); }}>Imprimir</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setShowPrintBanner(false)}>Não</Button>
        </div>
      )}

      {/* Mobile sticky bottom action bar */}
      <div className="no-print fixed bottom-0 left-0 right-0 md:hidden bg-card/95 backdrop-blur-sm border-t border-border z-30">
        <div className="flex pb-safe">
          {([
            pode("registrar_sinais_vitais") && { icon: <Activity className="h-5 w-5" />, label: "SVs",        action: () => setIsVitalsRecordOpen(true) },
            pode("registrar_evolucao")      && { icon: <ClipboardList className="h-5 w-5" />, label: "SOAP",  action: () => setIsVitalsOpen(true) },
            pode("registrar_prescricao") && isMedico     && { icon: <Stethoscope className="h-5 w-5" />, label: "Rx Médica", action: () => setIsPrescricaoMedicaOpen(true) },
            pode("registrar_prescricao") && isEnfermeiro && { icon: <ClipboardCheck className="h-5 w-5" />, label: "Rx Enf.", action: () => setIsPrescricaoEnfermagemOpen(true) },
            { icon: <ListTodo className="h-5 w-5" />, label: "Pendência",  action: () => setIsTasksOpen(true) },
            { icon: <Truck className="h-5 w-5" />, label: "Transfer.",  action: () => setIsTransferOpen(true) },
          ].filter(Boolean) as { icon: React.ReactNode; label: string; action: () => void }[]).map((item, i) => (
            <button key={i} type="button" onClick={item.action}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors text-primary">
              {item.icon}
              <span className="text-[10px] font-medium text-muted-foreground leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="no-print">
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar Alta do Paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Registrando a saída de <strong>{patient.full_name}</strong> da unidade. Selecione o motivo da alta:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-1">
            {[
              "Alta com melhora clínica",
              "Transferência hospitalar",
              "Alta a pedido",
              "Óbito",
              "Evasão",
            ].map(opt => (
              <label key={opt} className="flex items-center gap-2.5 cursor-pointer rounded-md border border-border/40 px-3 py-2 hover:bg-muted/20 transition-colors has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="tipo_alta"
                  value={opt}
                  checked={tipoAlta === opt}
                  onChange={() => setTipoAlta(opt)}
                  className="accent-primary"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatus.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Processando..." : "Confirmar Alta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── PRINT-ONLY EVOLUTION REPORT ──────────────────────────────── */}
      <div className="print-only" style={{ fontFamily: "Arial, sans-serif", color: "#000", background: "#fff" }}>
        <PrintHeader
          baseUrl={import.meta.env.BASE_URL}
          title="Evolução de Enfermagem"
          emittedAt={new Date()}
          patient={{
            full_name:         patient.full_name,
            prontuarioNumber:  patient.prontuarioNumber,
            atendimentoNumber: patient.atendimentoNumber,
            motherName:        patient.motherName,
            birthDate:         patient.birthDate,
            age:               patient.age,
            sex:               patient.sex,
            cpf:               patient.cpf,
            cns:               patient.cns,
            rg:                patient.rg,
            phone:             patient.phone,
            address:           patient.address,
            bed:               patient.bed,
            sector:            patient.sector,
            attendanceDate:    patient.attendanceDate,
            attendanceTime:    patient.attendanceTime,
            careStatus:        patient.careStatus,
          }}
        />
        <div className="print-section">
          <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: "5pt", textTransform: "uppercase", letterSpacing: "0.04em" }}>Sinais Vitais</div>
          <table className="print-table">
            <thead>
              <tr><th>PA (mmHg)</th><th>FC (bpm)</th><th>FR (irpm)</th><th>SpO₂ (%)</th><th>Temp. (°C)</th><th>HGT (mg/dL)</th></tr>
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
        <div className="print-section">
          <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: "6pt", textTransform: "uppercase", letterSpacing: "0.04em" }}>Evoluções Clínicas</div>
          {(() => {
            const PROF_LABELS: Record<string, string> = {
              medico: "Médico(a)",
              enfermeiro: "Enfermeiro(a) — SAE",
              anotacao_enfermagem: "Enfermeiro(a)",
              tecnico_enfermagem: "Técnico de Enfermagem",
              nutricionista: "Nutricionista",
              servico_social: "Assistente Social",
            };
            type PrintEntry = { id: number; userId: number; soapText: string; createdAt: string; professionalCategory?: string | null };
            const printEntries = ((history ?? []) as PrintEntry[]).filter(
              e => e.soapText !== "Admissão inicial"
                && !e.soapText.startsWith("[Reclassificação]")
                && e.userId !== 0
            );
            if (printEntries.length === 0) return <p style={{ color: "#6b7280", fontStyle: "italic" }}>Nenhuma evolução clínica registrada.</p>;
            return printEntries.map(entry => (
              <div key={entry.id} className="soap-entry">
                <div className="soap-entry-header" style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>
                    {staffMap[entry.userId]?.name ?? PROF_LABELS[entry.professionalCategory ?? ""] ?? "Profissional"}
                    {" "}
                    <span style={{ fontWeight: 400, color: "#6b7280" }}>
                      ({PROF_LABELS[entry.professionalCategory ?? ""] ?? "Profissional"})
                    </span>
                  </strong>
                  <span style={{ color: "#6b7280" }}>{format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
                <div style={{ padding: "4pt 0 0" }}>
                  <pre style={{ fontFamily: "monospace", fontSize: "9pt", whiteSpace: "pre-wrap", color: "#374151", margin: 0 }}>{entry.soapText}</pre>
                </div>
              </div>
            ));
          })()}
        </div>
        <div className="print-sig-area">
          <div className="print-sig-box">
            {(nurseName || activeUser?.name) && (
              <div style={{ fontWeight: 600, fontSize: "9pt", color: "#111827" }}>{nurseName || activeUser?.name}</div>
            )}
            <div style={{ marginTop: "2pt", fontSize: "9pt", color: "#374151" }}>Profissional responsável</div>
          </div>
        </div>
      </div>
    </div>
  );
}
