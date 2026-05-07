import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { useAuth } from "@/lib/use-auth";
import { useFeatures } from "@/lib/features-context";
import { Link, useLocation, useSearch } from "wouter";
import {
  useListPatients,
  useGetPatientsSummary,
  useDeletePatient,
  useUpdatePatientStatus,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Patient, ListPatientsParams, PatientPendingExamsItem } from "@workspace/api-client-react";
import { UserPlus, Users, Search, Pencil, LogOut, ClipboardList, BedDouble, Settings2, Power, AlertTriangle, Siren, RefreshCw, Clock, Stethoscope, FlaskConical, X, Filter, Microscope, Bookmark, BookmarkCheck, List, ChevronUp, ChevronDown, Check } from "lucide-react";
import { BedPickerInline } from "@/components/bed-picker-inline";
import { useExamFilterBookmarks } from "@/lib/use-exam-filter-bookmarks";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientForm } from "@/components/patient-form";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCriticalAlerts } from "@/hooks/use-critical-alerts";
import type { CriticalAlert } from "@/hooks/use-critical-alerts";
import { useOffline } from "@/hooks/use-offline";
import { PatientLookupDialog } from "@/components/patient-lookup";
import { Wifi, WifiOff } from "lucide-react";

// Roles that receive active alert notifications (sound + popup + panel)
const ALERT_ROLES = new Set(["enfermeiro", "tecnico_enfermagem"]);

// ── care status config ─────────────────────────────────────────────────────────

const CARE_STATUS_CONFIG = {
  "Em Triagem":                { label: "Em Triagem",          color: "text-blue-700",    bg: "bg-blue-100",    border: "border-blue-300",    dot: "bg-blue-500"    },
  "Aguardando Atendimento":    { label: "Aguardando",          color: "text-amber-700",   bg: "bg-amber-100",   border: "border-amber-300",   dot: "bg-amber-500"   },
  "Em Atendimento (Cons. 1)":  { label: "Cons. 1",             color: "text-sky-700",     bg: "bg-sky-100",     border: "border-sky-300",     dot: "bg-sky-500"     },
  "Em Atendimento (Cons. 2)":  { label: "Cons. 2",             color: "text-violet-700",  bg: "bg-violet-100",  border: "border-violet-300",  dot: "bg-violet-500"  },
  "Em Medicação":              { label: "Em Medicação",        color: "text-pink-700",    bg: "bg-pink-100",    border: "border-pink-300",    dot: "bg-pink-500"    },
  "Aguardando Exames":         { label: "Ag. Exames",          color: "text-cyan-700",    bg: "bg-cyan-100",    border: "border-cyan-300",    dot: "bg-cyan-500"    },
  "Aguardando Reavaliação":    { label: "Ag. Reavaliação",     color: "text-orange-700",  bg: "bg-orange-100",  border: "border-orange-300",  dot: "bg-orange-500"  },
  "Em Observação":             { label: "Em Observação",       color: "text-teal-700",    bg: "bg-teal-100",    border: "border-teal-300",    dot: "bg-teal-500"    },
  "Internado":                 { label: "Internado",           color: "text-red-700",     bg: "bg-red-100",     border: "border-red-300",     dot: "bg-red-500"     },
  "Em Transferência":          { label: "Em Transferência",    color: "text-purple-700",  bg: "bg-purple-100",  border: "border-purple-300",  dot: "bg-purple-500"  },
  "Alta":                      { label: "Alta",                color: "text-green-700",   bg: "bg-green-100",   border: "border-green-300",   dot: "bg-green-500"   },
} as const;

type CareStatusKey = keyof typeof CARE_STATUS_CONFIG;

const CARE_STATUS_KEYS: CareStatusKey[] = [
  "Em Triagem", "Aguardando Atendimento", "Em Atendimento (Cons. 1)", "Em Atendimento (Cons. 2)",
  "Em Medicação", "Aguardando Exames", "Aguardando Reavaliação",
  "Em Observação", "Internado", "Em Transferência", "Alta",
];

const CARE_STATUS_SECTION_KEYS: CareStatusKey[] = [
  "Em Triagem", "Aguardando Atendimento", "Em Atendimento (Cons. 1)", "Em Atendimento (Cons. 2)",
  "Em Medicação", "Aguardando Exames", "Aguardando Reavaliação",
  "Em Observação", "Internado", "Em Transferência",
];

// ── time alert helpers ─────────────────────────────────────────────────────────

function minutesSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

function hoursSince(iso: string): number {
  return minutesSince(iso) / 60;
}

function formatElapsed(iso: string): string {
  const mins = Math.floor(minutesSince(iso));
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── triage config ─────────────────────────────────────────────────────────────

const TRIAGE_CONFIG = {
  red:    { label: "Vermelho",  sub: "EMERGÊNCIA",    border: "border-l-red-500",    dot: "bg-red-500",    text: "text-red-700",    bg: "bg-red-100"    },
  orange: { label: "Laranja",   sub: "MUITO URGENTE", border: "border-l-orange-500", dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-100" },
  yellow: { label: "Amarelo",   sub: "URGENTE",       border: "border-l-yellow-500", dot: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-100" },
  green:  { label: "Verde",     sub: "POUCO URGENTE", border: "border-l-green-500",  dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-100"  },
  blue:   { label: "Azul",      sub: "NÃO URGENTE",   border: "border-l-blue-500",   dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-100"   },
} as const;

type TriageKey = keyof typeof TRIAGE_CONFIG;

const TRIAGE_SEVERITY: Record<string, number> = { red: 1, orange: 2, yellow: 3, green: 4, blue: 5 };

const ALL_SECTOR_CONFIG = [
  { key: "triagem",               name: "Triagem",               emoji: "🩺", headerCls: "bg-blue-50 border-blue-200 text-blue-700",    emptyBorder: "border-blue-100",   group: "recepcao"  },
  { key: "sala_vermelha",         name: "Sala Vermelha",         emoji: "🔴", headerCls: "bg-red-50 border-red-200 text-red-700",       emptyBorder: "border-red-100",    group: "leitos"    },
  { key: "observacao_adulto",     name: "Observação Adulto",     emoji: "🟡", headerCls: "bg-amber-50 border-amber-200 text-amber-700", emptyBorder: "border-amber-100",  group: "leitos"    },
  { key: "observacao_pediatrica", name: "Observação Pediátrica", emoji: "🟢", headerCls: "bg-green-50 border-green-200 text-green-700", emptyBorder: "border-green-100",  group: "leitos"    },
  { key: "observacao_pre_adulto", name: "Observação Pré-Adulto", emoji: "🔵", headerCls: "bg-sky-50 border-sky-200 text-sky-700",       emptyBorder: "border-sky-100",    group: "leitos"    },
];

// ── debounce ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ── patient row ───────────────────────────────────────────────────────────────

interface PatientRowProps {
  patient: Patient;
  onEdit: (p: Patient) => void;
  onAlta: (p: Patient) => void;
  onReclassify: (p: Patient) => void;
  isCritical?: boolean;
  criticalDetail?: string;
  pendingExams?: PatientPendingExamsItem[];
}

const RECLASSIFY_ROLES = new Set(["enfermeiro", "administrador", "diretoria_geral"]);
const RECLASSIFY_STATUSES = new Set(["Em Triagem", "Aguardando Atendimento"]);

const PatientRow = memo(function PatientRow({
  patient, onEdit, onAlta, onReclassify, isCritical = false, criticalDetail, pendingExams,
}: PatientRowProps) {
  const { pode, activeUser } = useAuth();
  const cfg = TRIAGE_CONFIG[patient.triage_level as TriageKey] ?? TRIAGE_CONFIG.blue;
  const csCfg = CARE_STATUS_CONFIG[patient.careStatus as CareStatusKey] ?? CARE_STATUS_CONFIG["Em Triagem"];

  // Time-based alerts
  const careStatus = patient.careStatus as CareStatusKey;
  const triageAlert  = careStatus === "Em Triagem"   && minutesSince(patient.createdAt) > 30;
  const obsAlert     = careStatus === "Em Observação" && hoursSince(patient.careStatusChangedAt as string) > 6;
  const hasTimeAlert = triageAlert || obsAlert;

  return (
    <div className={cn(
      "group relative flex items-stretch border-l-4 border-b border-border/30 last:border-b-0 transition-colors",
      isCritical
        ? "border-l-red-500 bg-red-50"
        : cn(cfg.border, "hover:bg-muted/20"),
    )}>
      {/* Blinking overlay for critical patients */}
      {isCritical && (
        <div className="absolute inset-0 bg-red-100/60 animate-pulse pointer-events-none" />
      )}

      <Link href={`/patients/${patient.id}`} className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0 cursor-pointer">

        {/* ⚠️ critical icon or leito */}
        <div className="w-11 shrink-0 text-center">
          {isCritical ? (
            <AlertTriangle className="h-4 w-4 text-red-400 mx-auto animate-pulse" />
          ) : (
            <div className="text-sm font-mono font-bold text-foreground leading-tight">
              {patient.bed || <BedDouble className="h-3.5 w-3.5 text-muted-foreground mx-auto" />}
            </div>
          )}
        </div>

        {/* Triage badge */}
        <div className={cn(
          "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded leading-tight hidden md:block",
          isCritical ? "bg-red-100 text-red-700" : cn(cfg.bg, cfg.text),
        )}>
          {isCritical ? "⚠ CRÍTICO" : cfg.label}
        </div>
        <span className={cn(
          "w-2 h-2 rounded-full shrink-0 md:hidden",
          isCritical ? "bg-red-500 animate-pulse" : cfg.dot,
        )} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "font-semibold text-sm leading-tight truncate",
              isCritical ? "text-red-700" : "text-foreground",
            )}>
              {patient.full_name}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{patient.age}a</span>

            {/* Care status badge */}
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0 rounded border leading-5 shrink-0",
              csCfg.bg, csCfg.color, csCfg.border,
            )}>
              {csCfg.label}
            </span>

            {/* Time alert badge */}
            {hasTimeAlert && (
              <span className={cn(
                "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0 rounded border leading-5 shrink-0",
                triageAlert ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-purple-100 text-purple-700 border-purple-300",
              )}>
                <Clock className="h-2.5 w-2.5" />
                {triageAlert
                  ? `Triagem ${formatElapsed(patient.createdAt)}`
                  : `Obs. ${formatElapsed(patient.careStatusChangedAt as string)}`}
              </span>
            )}
          </div>
          {/* Critical detail shows the offending vital (SpO₂, FC, PAS) */}
          {isCritical && criticalDetail ? (
            <p className="text-xs font-semibold text-red-600 leading-tight mt-0.5">{criticalDetail}</p>
          ) : patient.diagnosis ? (
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{patient.diagnosis}</p>
          ) : null}
          {/* Pending exam badges — show actual exam names from API */}
          {pendingExams && pendingExams.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {pendingExams.slice(0, 3).map(ex => {
                const names = [...ex.laboratoriais, ...ex.imagem];
                const label = names.length > 0 ? names.slice(0, 2).join(", ") : (ex.laboratoriais.length > 0 ? "Lab" : "Imagem");
                const urgentCls = ex.prioridade === "urgente"
                  ? "bg-amber-100 text-amber-700 border-amber-300"
                  : "bg-cyan-100 text-cyan-700 border-cyan-300";
                return (
                  <span key={ex.id} className={cn(
                    "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0 rounded border leading-5",
                    urgentCls,
                  )}>
                    <FlaskConical className="h-2.5 w-2.5" />
                    {label}
                    {ex.prioridade === "urgente" && <span className="ml-0.5 opacity-80">⚡</span>}
                  </span>
                );
              })}
              {pendingExams.length > 3 && (
                <span className="text-[10px] text-cyan-600 leading-5">+{pendingExams.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* PACIENTE CRÍTICO badge (desktop) */}
        {isCritical && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-300 uppercase tracking-wider shrink-0 hidden sm:inline-flex items-center gap-1">
            PACIENTE CRÍTICO
          </span>
        )}
      </Link>

      <div className="flex items-center gap-0.5 px-1.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        {pode("mudar_setor") &&
         RECLASSIFY_ROLES.has(activeUser?.role ?? "") &&
         (RECLASSIFY_STATUSES.has(patient.careStatus ?? "") || patient.sector === "sala_vermelha") && (
          <button
            type="button"
            title="Reclassificar paciente"
            onClick={e => { e.preventDefault(); onReclassify(patient); }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
        {pode("editar_paciente") && (
          <button
            type="button"
            title="Editar"
            onClick={e => { e.preventDefault(); onEdit(patient); }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {pode("excluir_paciente") && (
          <button
            type="button"
            title="Alta"
            onClick={e => { e.preventDefault(); onAlta(patient); }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});

// ── reclassify modal ───────────────────────────────────────────────────────────

interface ReclassifyModalProps {
  patient: Patient | null;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
}

const BED_SECTORS = new Set(["sala_vermelha", "observacao_adulto", "observacao_pediatrica", "observacao_pre_adulto"]);

function ReclassifyModal({ patient, onClose, onSuccess, userId }: ReclassifyModalProps) {
  const { toast } = useToast();
  const { activeUser } = useAuth();
  const reclassify = useUpdatePatientStatus();
  const [triageLevel,      setTriageLevel]      = useState<string>("");
  const [careStatus,       setCareStatus]       = useState<string>("");
  const [selectedBedId,    setSelectedBedId]    = useState<number | null>(null);
  const [alertaEnfermeiro, setAlertaEnfermeiro] = useState<string>("");

  const needsBedPick = (careStatus === "Em Observação" || careStatus === "Internado")
    && BED_SECTORS.has(patient?.sector ?? "");

  useEffect(() => {
    if (patient) {
      setTriageLevel(patient.triage_level);
      setCareStatus(patient.careStatus as string);
      setSelectedBedId(null);
      setAlertaEnfermeiro((patient as unknown as Record<string, unknown>).alertaEnfermeiro as string ?? "");
    }
  }, [patient]);

  useEffect(() => { setSelectedBedId(null); }, [careStatus]);

  const triageLevels = [
    { value: "red",    label: "Vermelho — Emergência" },
    { value: "orange", label: "Laranja — Muito Urgente" },
    { value: "yellow", label: "Amarelo — Urgente" },
    { value: "green",  label: "Verde — Pouco Urgente" },
    { value: "blue",   label: "Azul — Não Urgente" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    if (needsBedPick && !selectedBedId) {
      toast({ title: "Selecione um leito para continuar", variant: "destructive" });
      return;
    }
    reclassify.mutate(
      {
        id: patient.id,
        data: {
          triage_level: triageLevel as "red" | "orange" | "yellow" | "green" | "blue",
          care_status: careStatus as "Em Triagem" | "Aguardando Atendimento" | "Em Atendimento (Cons. 1)" | "Em Atendimento (Cons. 2)" | "Em Observação" | "Internado" | "Em Transferência" | "Alta",
          user_id: userId,
          alertaEnfermeiro,
          ...(selectedBedId ? { bed_id: selectedBedId } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Paciente reclassificado com sucesso" });
          onSuccess();
        },
        onError: () => toast({ title: "Erro ao reclassificar paciente", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={!!patient} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reclassificar Paciente</DialogTitle>
          <DialogDescription>
            {patient?.full_name} — altere triagem e/ou status de cuidado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Triage level */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Nível de Triagem (Manchester)
            </label>
            <select
              value={triageLevel}
              onChange={e => setTriageLevel(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {triageLevels.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Care status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status de Cuidado
            </label>
            <select
              value={careStatus}
              onChange={e => setCareStatus(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CARE_STATUS_KEYS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(careStatus === "Em Triagem" || careStatus === "Aguardando Atendimento") && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                ⚠ Pacientes neste status são exibidos na área de Recepção/Triagem.
              </p>
            )}
            {(careStatus === "Em Medicação" || careStatus === "Aguardando Exames" || careStatus === "Aguardando Reavaliação") && (
              <p className="text-[11px] text-cyan-700 bg-cyan-50 border border-cyan-200 rounded px-2 py-1">
                ℹ Status de acompanhamento pós-consulta — paciente permanece no setor atual.
              </p>
            )}
          </div>

          {/* Alerta de gravidade do enfermeiro */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-1">
              ⚠ Alerta de Gravidade (visível ao médico)
            </label>
            <textarea
              value={alertaEnfermeiro}
              onChange={e => setAlertaEnfermeiro(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Ex: Febre 40°C, Picada de cobra há 5h, Angina com irradiação, Choque séptico..."
              className="w-full rounded-md border border-orange-500/40 bg-orange-950/20 px-3 py-2 text-sm text-orange-100 placeholder:text-orange-400/40 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              Esta nota aparece em destaque na fila médica. Deixe em branco para limpar o alerta.
            </p>
          </div>

          {/* Bed picker — obrigatório ao mover para setor de observação/internação */}
          {needsBedPick && (
            <BedPickerInline
              sector={patient?.sector ?? ""}
              authId={activeUser?.id}
              selectedBedId={selectedBedId}
              onSelect={id => setSelectedBedId(id)}
            />
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-1"
              disabled={reclassify.isPending || (needsBedPick && !selectedBedId)}
            >
              {reclassify.isPending ? "Salvando..." : "Reclassificar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

function parseExamFiltersFromSearch(qs: string) {
  const params = new URLSearchParams(qs);
  return {
    examSearch:   params.get("exam")         ?? "",
    examType:     (params.get("examType")     ?? "") as "" | "laboratorial" | "imagem",
    examStatus:   (params.get("examStatus")   ?? "") as "" | "solicitado" | "coletado" | "laudado",
    examPriority: (params.get("examPriority") ?? "") as "" | "urgente" | "rotina" | "eletivo",
  };
}

export default function Dashboard() {
  const { pode, activeUser, logout } = useAuth();
  const { featureAtiva } = useFeatures();
  const [, setLocation] = useLocation();
  const currentSearch = useSearch();
  const [isNewPatientOpen, setIsNewPatientOpen]     = useState(false);
  const [editingPatient, setEditingPatient]         = useState<Patient | null>(null);
  const [altaPatient, setAltaPatient]               = useState<Patient | null>(null);
  const [reclassifyPatient, setReclassifyPatient]   = useState<Patient | null>(null);
  const [search, setSearch]                         = useState("");
  const [filtro, setFiltro]                         = useState("Todos");
  const [triageFilter, setTriageFilter]             = useState("all");
  const [viewMode, setViewMode]                     = useState<"setor" | "status" | "exames">("setor");
  const [flowTab, setFlowTab]                       = useState<"todos" | "triagem" | "recepcao" | "consultorios" | "medicacao" | "observacao">("todos");
  const [lookupOpen, setLookupOpen]                 = useState(false);
  const [prefillPatient, setPrefillPatient]         = useState<Partial<Patient> | undefined>(undefined);
  const { isOffline }                               = useOffline();

  const initialFilters = useMemo(() => parseExamFiltersFromSearch(currentSearch), []);
  const [examSearch, setExamSearch]     = useState(initialFilters.examSearch);
  const [examType, setExamType]         = useState(initialFilters.examType);
  const [examStatus, setExamStatus]     = useState(initialFilters.examStatus);
  const [examPriority, setExamPriority] = useState(initialFilters.examPriority);
  const [showExamFilters, setShowExamFilters] = useState(
    !!(initialFilters.examSearch || initialFilters.examType || initialFilters.examStatus || initialFilters.examPriority)
  );
  const [showSaveBookmark, setShowSaveBookmark]     = useState(false);
  const [bookmarkLabel, setBookmarkLabel]           = useState("");

  const { bookmarks, saveBookmark, deleteBookmark, renameBookmark, reorderBookmarks } = useExamFilterBookmarks();
  const [renamingId, setRenamingId]   = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // ── setor e feature flag ───────────────────────────────────────────────────
  const preAdultoAtivo = featureAtiva("setor_pre_adulto");

  // Setores permitidos para este funcionário (baseado em setoresAtuacao)
  const setoresPermitidos = useMemo(() => {
    const raw = activeUser?.setoresAtuacao ?? "todos";
    const lista = raw.split(",").map(s => s.trim()).filter(Boolean);
    // "todos" ou vazio = sem restrição
    if (!lista.length || lista.includes("todos")) return null;
    return new Set(lista);
  }, [activeUser?.setoresAtuacao]);

  // Config de setores visíveis: filtra pré-adulto (feature flag) e setores do funcionário
  const SECTOR_CONFIG = useMemo(() => {
    return ALL_SECTOR_CONFIG.filter(s => {
      if (s.key === "observacao_pre_adulto" && !preAdultoAtivo) return false;
      if (setoresPermitidos && !setoresPermitidos.has(s.key)) return false;
      return true;
    });
  }, [preAdultoAtivo, setoresPermitidos]);

  const SECTOR_NAMES = SECTOR_CONFIG.map(s => s.key);
  const SECTOR_LABEL = Object.fromEntries(SECTOR_CONFIG.map(s => [s.key, s.name]));

  const debouncedSearch     = useDebounce(search, 200);
  const debouncedExamSearch = useDebounce(examSearch, 400);

  const examParams = useMemo((): ListPatientsParams | undefined => {
    const p: ListPatientsParams = {};
    if (debouncedExamSearch) p.exam = debouncedExamSearch;
    if (examType)    p.examType     = examType     as ListPatientsParams["examType"];
    if (examStatus)  p.examStatus   = examStatus   as ListPatientsParams["examStatus"];
    if (examPriority) p.examPriority = examPriority as ListPatientsParams["examPriority"];
    return Object.keys(p).length > 0 ? p : undefined;
  }, [debouncedExamSearch, examType, examStatus, examPriority]);

  const hasExamFilter = !!examParams;

  // Auto-fallback: if exam filter becomes inactive while in exam list mode, reset to sector view
  // When exam filter activates, clear any lingering sector selection to avoid hidden constraints
  useEffect(() => {
    if (!hasExamFilter) {
      setViewMode(v => v === "exames" ? "setor" : v);
    } else {
      setFiltro("Todos");
    }
  }, [hasExamFilter]);

  // Sync exam filter state → URL query params (replace history so reload restores the filter).
  // Start from the current params so unrelated query params are preserved.
  useEffect(() => {
    const params = new URLSearchParams(currentSearch);
    if (debouncedExamSearch) params.set("exam", debouncedExamSearch);
    else                     params.delete("exam");
    if (examType)            params.set("examType", examType);
    else                     params.delete("examType");
    if (examStatus)          params.set("examStatus", examStatus);
    else                     params.delete("examStatus");
    if (examPriority)        params.set("examPriority", examPriority);
    else                     params.delete("examPriority");
    const qs = params.toString();
    const newPath = qs ? `/?${qs}` : "/";
    const currentQs = currentSearch.replace(/^\?/, "");
    if (qs !== currentQs) {
      setLocation(newPath, { replace: true });
    }
  }, [debouncedExamSearch, examType, examStatus, examPriority]);

  const examFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (debouncedExamSearch) parts.push(debouncedExamSearch);
    else if (examType === "laboratorial") parts.push("Laboratorial");
    else if (examType === "imagem") parts.push("Imagem");
    if (examStatus === "solicitado") parts.push("Solicitado");
    else if (examStatus === "coletado") parts.push("Coletado");
    else if (examStatus === "laudado") parts.push("Laudado");
    if (examPriority === "urgente") parts.push("Urgente");
    return parts.join(" · ") || "Exame";
  }, [debouncedExamSearch, examType, examStatus, examPriority]);

  const { data: patients, isLoading: isLoadingPatients } = useListPatients(examParams);
  const { data: summary, isLoading: isLoadingSummary }   = useGetPatientsSummary();
  const deletePatient         = useDeletePatient();
  const updatePatientStatus   = useUpdatePatientStatus();
  const queryClient   = useQueryClient();
  const { toast }     = useToast();

  // ── critical alert system ──────────────────────────────────────────────────
  const isNurseOrTech = ALERT_ROLES.has(activeUser?.role ?? "");

  // Whether the nurse/tech has dismissed the current popup round.
  const [popupDismissed, setPopupDismissed] = useState(false);

  // Track critical IDs seen in the last poll so we can detect genuinely NEW patients.
  const prevCriticalIds = useRef<Set<number>>(new Set());

  const { criticals, criticalPatientIds, criticalDetailMap } = useCriticalAlerts({
    alertsEnabled: isNurseOrTech,
  });

  // Re-open popup whenever new critical patients appear (not previously in list).
  useEffect(() => {
    if (!isNurseOrTech || criticals.length === 0) return;
    const currentIds = new Set(criticals.map(a => a.patientId));
    const hasNew = criticals.some(a => !prevCriticalIds.current.has(a.patientId));
    prevCriticalIds.current = currentIds;
    if (hasNew) setPopupDismissed(false);
  }, [criticals, isNurseOrTech]);

  // Popup is open when nurse/tech has unseen critical patients and hasn't dismissed yet.
  const criticalPopupOpen = isNurseOrTech && criticals.length > 0 && !popupDismissed;

  // ── patient grouping ───────────────────────────────────────────────────────
  const { grouped, groupedByStatus } = useMemo(() => {
    if (!patients) return { grouped: null, groupedByStatus: null };
    const q = debouncedSearch.toLowerCase();
    const TRIAGEM_STATUS      = new Set(["Em Triagem"]);
    const RECEPCAO_STATUS     = new Set(["Aguardando Atendimento"]);
    const CONSULTORIOS_STATUS = new Set(["Em Atendimento (Cons. 1)", "Em Atendimento (Cons. 2)"]);
    const MEDICACAO_STATUS    = new Set(["Em Medicação", "Aguardando Exames", "Aguardando Reavaliação"]);
    const OBS_STATUS          = new Set(["Em Observação", "Internado", "Em Transferência"]);
    const OBS_SECTORS         = new Set(["sala_vermelha", "observacao_adulto", "observacao_pediatrica", "observacao_pre_adulto"]);

    const base = patients.filter(p => {
      if (p.careStatus === "Alta") return false;
      const matchesSearch = !q || p.full_name.toLowerCase().includes(q) || (p.bed?.toLowerCase().includes(q) ?? false);
      const matchesSector = filtro === "Todos" || p.sector === filtro;
      const matchesTriage = triageFilter === "all" || p.triage_level === triageFilter;
      const matchesFlow = (() => {
        switch (flowTab) {
          case "triagem":      return TRIAGEM_STATUS.has(p.careStatus as string);
          case "recepcao":     return RECEPCAO_STATUS.has(p.careStatus as string);
          case "consultorios": return CONSULTORIOS_STATUS.has(p.careStatus as string);
          case "medicacao":    return MEDICACAO_STATUS.has(p.careStatus as string);
          case "observacao":   return OBS_STATUS.has(p.careStatus as string) || OBS_SECTORS.has(p.sector);
          default:             return true;
        }
      })();
      return matchesSearch && matchesSector && matchesTriage && matchesFlow;
    });

    const sortFn = (a: Patient, b: Patient) => {
      const aCrit = criticalPatientIds.has(a.id) ? 0 : 1;
      const bCrit = criticalPatientIds.has(b.id) ? 0 : 1;
      if (aCrit !== bCrit) return aCrit - bCrit;
      return (TRIAGE_SEVERITY[a.triage_level] ?? 99) - (TRIAGE_SEVERITY[b.triage_level] ?? 99);
    };

    const grouped = SECTOR_CONFIG.map(cfg => ({
      ...cfg,
      patients: base.filter(p => p.sector === cfg.key).sort(sortFn),
    }));

    // "Por Status": respect sector restriction too
    const statusBase = setoresPermitidos
      ? base.filter(p => !p.sector || setoresPermitidos.has(p.sector))
      : base;

    const groupedByStatus = CARE_STATUS_SECTION_KEYS.map(status => ({
      key: status,
      ...CARE_STATUS_CONFIG[status],
      patients: statusBase.filter(p => p.careStatus === status).sort(sortFn),
    }));

    return { grouped, groupedByStatus };
  }, [patients, debouncedSearch, filtro, triageFilter, criticalPatientIds]);

  // ── flat exam list (for "exames" view mode) ────────────────────────────────
  interface ExamFlatEntry {
    patient: Patient;
    exam: PatientPendingExamsItem;
    examNames: string[];
  }

  const examFlatList = useMemo((): ExamFlatEntry[] => {
    if (!patients) return [];
    const q = debouncedSearch.toLowerCase();
    const base = patients.filter(p => {
      const matchesSearch = !q || p.full_name.toLowerCase().includes(q) || (p.bed?.toLowerCase().includes(q) ?? false);
      const matchesTriage = triageFilter === "all" || p.triage_level === triageFilter;
      const matchesSector = !setoresPermitidos || !p.sector || setoresPermitidos.has(p.sector);
      return matchesSearch && matchesTriage && matchesSector;
    });

    const entries: ExamFlatEntry[] = [];
    for (const patient of base) {
      for (const exam of patient.pendingExams ?? []) {
        const examNames = [...exam.laboratoriais, ...exam.imagem];
        entries.push({ patient, exam, examNames });
      }
    }

    entries.sort((a, b) => {
      const aCrit = criticalPatientIds.has(a.patient.id) ? 0 : 1;
      const bCrit = criticalPatientIds.has(b.patient.id) ? 0 : 1;
      if (aCrit !== bCrit) return aCrit - bCrit;
      const PRIO: Record<string, number> = { urgente: 0, rotina: 1, eletivo: 2 };
      const pA = PRIO[a.exam.prioridade] ?? 9;
      const pB = PRIO[b.exam.prioridade] ?? 9;
      if (pA !== pB) return pA - pB;
      return (TRIAGE_SEVERITY[a.patient.triage_level] ?? 99) - (TRIAGE_SEVERITY[b.patient.triage_level] ?? 99);
    });

    return entries;
  }, [patients, debouncedSearch, triageFilter, criticalPatientIds, setoresPermitidos]);

  const totalFiltered = viewMode === "setor"
    ? (grouped  ? grouped.reduce((n, g) => n + g.patients.length, 0)        : 0)
    : viewMode === "status"
    ? (groupedByStatus ? groupedByStatus.reduce((n, g) => n + g.patients.length, 0) : 0)
    : examFlatList.length;

  const handleEdit        = useCallback((p: Patient) => setEditingPatient(p), []);
  const handleAlta        = useCallback((p: Patient) => setAltaPatient(p), []);
  const handleReclassify  = useCallback((p: Patient) => setReclassifyPatient(p), []);

  const confirmAlta = () => {
    if (!altaPatient) return;
    updatePatientStatus.mutate(
      { id: altaPatient.id, data: { care_status: "Alta", triage_level: altaPatient.triage_level as "red" | "orange" | "yellow" | "green" | "blue", user_id: activeUser?.id ?? 0 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
          toast({ title: "Alta registrada com sucesso", description: "Dados preservados no histórico." });
          setAltaPatient(null);
        },
        onError: () => toast({ title: "Não foi possível registrar a alta", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="px-4 h-16 flex items-center justify-between gap-3">
          {/* Logo + Branding */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 leading-none shrink-0">
              <div className="font-black text-sm tracking-tight">UPA</div>
              <div className="font-bold text-[9px] tracking-[0.2em] text-center opacity-90">24h</div>
            </div>
            <div className="hidden sm:block">
              <div className="font-black text-sm text-foreground tracking-wide leading-tight">UPA BREVES</div>
              <div className="text-[10px] text-muted-foreground leading-tight">SEMSA — Prefeitura Municipal de Breves</div>
              <div className="text-[9px] text-muted-foreground/60 leading-tight">Gestão de Pacientes</div>
            </div>
            {isNurseOrTech && criticals.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse ml-1">
                <Siren className="h-3 w-3" />
                {criticals.length}
              </span>
            )}
          </div>

          {/* Nav links (desktop) */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {activeUser?.role === "administrador" && (
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                  <Settings2 className="h-3.5 w-3.5" />Admin
                </Button>
              </Link>
            )}
            {pode("gerenciar_usuarios") && (
              <Link href="/funcionarios">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                  <Users className="h-3.5 w-3.5" />Funcionários
                </Button>
              </Link>
            )}
            <Link href="/fila-medico">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                <Stethoscope className="h-3.5 w-3.5" />Fila Médica
              </Button>
            </Link>
            <Link href="/laboratorio">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                <FlaskConical className="h-3.5 w-3.5" />Laboratório
              </Button>
            </Link>
            <Link href="/historico">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                <Bookmark className="h-3.5 w-3.5" />Histórico
              </Button>
            </Link>
            {pode("registrar_exames") && (
              <Link href="/exames">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                  <Microscope className="h-3.5 w-3.5" />Pendências
                </Button>
              </Link>
            )}
            <Link href="/leitos">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                <BedDouble className="h-3.5 w-3.5" />Leitos
              </Button>
            </Link>
            {pode("registrar_evolucao") && (
              <Link href="/passagem-plantao">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                  <ClipboardList className="h-3.5 w-3.5" />Plantão
                </Button>
              </Link>
            )}
          </nav>

          {/* Right: actions + user */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile nav (icon-only) */}
            <div className="flex lg:hidden items-center gap-0.5">
              <Link href="/fila-medico">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                  <Stethoscope className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/leitos">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                  <BedDouble className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <Button
              onClick={() => pode("criar_paciente") && setLookupOpen(true)}
              data-testid="button-new-patient"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-semibold"
              disabled={!pode("criar_paciente")}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova Admissão</span>
              <span className="sm:hidden">+</span>
            </Button>
            {/* User info + logout */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {activeUser?.name?.charAt(0).toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold text-foreground max-w-28 truncate">{activeUser?.name}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{activeUser?.role?.replace(/_/g, " ")}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              title={`Sair (${activeUser?.name ?? ""})`}
              aria-label="Sair"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => { logout(); setLocation("/login"); }}
            >
              <Power className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── offline banner ───────────────────────────────────────────── */}
      {isOffline && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-semibold">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Sem conexão com a internet — dados podem estar desatualizados. Reconectará automaticamente.</span>
        </div>
      )}

      <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl">

        {/* ── CRITICAL PATIENTS ALERT PANEL — enfermeiro/tecnico_enfermagem only ── */}
        {isNurseOrTech && criticals.length > 0 && (
          <div className="mb-4 rounded-lg overflow-hidden border border-red-200 shadow-sm">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border-b border-red-200">
              <Siren className="h-4 w-4 text-red-600 shrink-0 animate-pulse" />
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider flex-1">
                ⚠ ATENÇÃO — {criticals.length} PACIENTE{criticals.length !== 1 ? "S" : ""} CRÍTICO{criticals.length !== 1 ? "S" : ""}
              </span>
              <span className="text-[10px] text-red-500 shrink-0 hidden sm:block">
                Atualiza a cada 30s
              </span>
            </div>

            {/* Critical patient rows */}
            <div className="bg-white divide-y divide-red-100">
              {criticals.map(alert => (
                <Link key={alert.patientId} href={`/patients/${alert.patientId}`}>
                  <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 transition-colors cursor-pointer group">
                    {/* Pulsing indicator */}
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-bold text-red-700 truncate">{alert.full_name}</span>
                        {alert.bed && (
                          <span className="text-[10px] text-red-500 shrink-0">Leito {alert.bed}</span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-red-600 leading-tight">
                        {alert.alertDetail}
                      </p>
                    </div>

                    {/* Reason badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-red-100 text-red-700 border-red-300 uppercase tracking-wider shrink-0 hidden sm:block">
                      {alert.alertReason === "triage_red"   ? "TRIAGEM VERM."
                        : alert.alertReason === "spo2_baixo"  ? "SpO₂ BAIXO"
                        : alert.alertReason === "fc_alta"     ? "FC ELEVADA"
                        : alert.alertReason === "pas_baixa"   ? "PAS BAIXA"
                        : "MÚLTIPLOS"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── summary strip ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {[
            { key: "all",    label: "Total",    value: summary?.total,  cls: "text-foreground",   dot: "" },
            { key: "red",    label: "Verm.",    value: summary?.red,    cls: "text-red-700",      dot: "bg-red-500" },
            { key: "orange", label: "Lar.",     value: summary?.orange, cls: "text-orange-700",   dot: "bg-orange-500" },
            { key: "yellow", label: "Amar.",    value: summary?.yellow, cls: "text-amber-700",    dot: "bg-yellow-500" },
            { key: "green",  label: "Verde",    value: summary?.green,  cls: "text-green-700",    dot: "bg-green-500" },
            { key: "blue",   label: "Azul",     value: summary?.blue,   cls: "text-blue-700",     dot: "bg-blue-500" },
          ].map(card => (
            <button
              key={card.key}
              type="button"
              onClick={() => setTriageFilter(triageFilter === card.key ? "all" : card.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-colors",
                triageFilter === card.key
                  ? "bg-muted/60 border-primary/50"
                  : "border-border/40 bg-card hover:bg-muted/30",
                card.cls
              )}
            >
              {card.dot && <span className={cn("w-2 h-2 rounded-full shrink-0", card.dot)} />}
              {isLoadingSummary
                ? <span className="w-4 h-3 bg-muted/50 rounded animate-pulse inline-block" />
                : <span>{card.value ?? 0}</span>
              }
              <span className="text-muted-foreground font-normal">{card.label}</span>
            </button>
          ))}

          {/* Critical count pill — nurses and technicians only */}
          {isNurseOrTech && criticals.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold border-red-300 bg-red-100 text-red-700">
              <AlertTriangle className="h-3 w-3" />
              <span>{criticals.length}</span>
              <span className="text-red-600/80 font-normal">Críticos</span>
            </span>
          )}
        </div>

        {/* ── exam filter bookmarks ──────────────────────────────────── */}
        {bookmarks.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1">
              <Bookmark className="h-3 w-3" />
              Favoritos:
            </span>
            {bookmarks.map((bk, idx) => (
              <span
                key={bk.id}
                className="group inline-flex items-center gap-0.5 pl-2.5 pr-1 py-0.5 rounded-full border border-cyan-300 bg-cyan-50 text-cyan-700 text-[11px] font-medium"
              >
                {renamingId === bk.id ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={e => {
                      e.preventDefault();
                      if (renameInput.trim()) renameBookmark(bk.id, renameInput);
                      setRenamingId(null);
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={renameInput}
                      onChange={e => setRenameInput(e.target.value)}
                      maxLength={40}
                      className="bg-transparent text-[11px] text-foreground focus:outline-none w-28 border-b border-cyan-300"
                      onBlur={() => {
                        if (renameInput.trim()) renameBookmark(bk.id, renameInput);
                        setRenamingId(null);
                      }}
                      onKeyDown={e => e.key === "Escape" && setRenamingId(null)}
                    />
                    <button type="submit" className="text-cyan-600 hover:text-cyan-700 flex items-center">
                      <Check className="h-3 w-3" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    title={`Aplicar filtro: ${bk.label}`}
                    onClick={() => {
                      setExamSearch(bk.examSearch);
                      setExamType(bk.examType);
                      setExamStatus(bk.examStatus);
                      setExamPriority(bk.examPriority);
                      setShowExamFilters(true);
                      setShowSaveBookmark(false);
                    }}
                    className="hover:text-cyan-700 transition-colors"
                  >
                    {bk.label}
                  </button>
                )}
                {renamingId !== bk.id && (
                  <>
                    <button
                      type="button"
                      title="Mover para cima"
                      onClick={() => reorderBookmarks(bk.id, "up")}
                      disabled={idx === 0}
                      className="h-4 w-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-50 hover:!opacity-100 disabled:!opacity-0 hover:bg-cyan-100 text-cyan-600 hover:text-cyan-700 transition-all focus:outline-none"
                    >
                      <ChevronUp className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      title="Mover para baixo"
                      onClick={() => reorderBookmarks(bk.id, "down")}
                      disabled={idx === bookmarks.length - 1}
                      className="h-4 w-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-50 hover:!opacity-100 disabled:!opacity-0 hover:bg-cyan-100 text-cyan-600 hover:text-cyan-700 transition-all focus:outline-none"
                    >
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      title="Renomear favorito"
                      onClick={() => { setRenamingId(bk.id); setRenameInput(bk.label); }}
                      className="h-4 w-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:bg-cyan-100 text-cyan-600 hover:text-cyan-700 transition-all focus:outline-none"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      title="Remover favorito"
                      onClick={() => deleteBookmark(bk.id)}
                      className="ml-0.5 h-4 w-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-70 hover:!opacity-100 focus:opacity-100 hover:bg-cyan-100 focus:bg-cyan-100 text-cyan-600 hover:text-cyan-700 focus:text-cyan-700 transition-all focus:outline-none"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </>
                )}
              </span>
            ))}
          </div>
        )}

        {/* ── search + filters ───────────────────────────────────────── */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Buscar nome ou leito..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          {/* Exam filter toggle */}
          <button
            type="button"
            data-testid="btn-exam-filter"
            onClick={() => setShowExamFilters(v => !v)}
            className={cn(
              "h-8 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors",
              showExamFilters || hasExamFilter
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30",
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exames</span>
            {hasExamFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            )}
          </button>
          {/* View mode toggle */}
          <div className="flex gap-0.5 border border-border/40 rounded-md p-0.5 bg-card h-8">
            <button
              type="button"
              onClick={() => setViewMode("setor")}
              className={cn(
                "px-2.5 rounded text-xs font-medium transition-colors",
                viewMode === "setor" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >Por Setor</button>
            <button
              type="button"
              onClick={() => setViewMode("status")}
              className={cn(
                "px-2.5 rounded text-xs font-medium transition-colors",
                viewMode === "status" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >Por Status</button>
            {hasExamFilter && (
              <button
                type="button"
                data-testid="btn-exam-list-view"
                onClick={() => setViewMode("exames")}
                title="Lista de Exames"
                className={cn(
                  "px-2.5 rounded text-xs font-medium transition-colors flex items-center gap-1",
                  viewMode === "exames"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-muted-foreground hover:text-cyan-400",
                )}
              >
                <List className="h-3 w-3" />
                <span className="hidden sm:inline">Lista de Exames</span>
              </button>
            )}
          </div>
        </div>

        {/* ── exam filter panel ──────────────────────────────────────── */}
        {showExamFilters && (
          <div className="mb-3 rounded-md border border-cyan-200 bg-cyan-50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Filtrar por Exame Pendente
              </span>
              <div className="flex items-center gap-2">
                {hasExamFilter && !showSaveBookmark && (
                  <button
                    type="button"
                    onClick={() => {
                      setBookmarkLabel(examFilterLabel !== "Exame" ? examFilterLabel : "");
                      setShowSaveBookmark(true);
                    }}
                    className="text-[11px] text-cyan-600 hover:text-cyan-700 flex items-center gap-0.5 transition-colors"
                  >
                    <Bookmark className="h-3 w-3" />
                    Salvar filtro
                  </button>
                )}
                {hasExamFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setExamSearch("");
                      setExamType("");
                      setExamStatus("");
                      setExamPriority("");
                      setShowSaveBookmark(false);
                      setViewMode(v => v === "exames" ? "setor" : v);
                    }}
                    className="text-[11px] text-cyan-600 hover:text-cyan-700 flex items-center gap-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Save bookmark inline form */}
            {showSaveBookmark && (
              <form
                className="flex items-center gap-2 rounded-md border border-cyan-200 bg-background px-2.5 py-1.5"
                onSubmit={e => {
                  e.preventDefault();
                  if (!bookmarkLabel.trim() || !hasExamFilter) return;
                  saveBookmark(bookmarkLabel, { examSearch, examType, examStatus, examPriority });
                  setShowSaveBookmark(false);
                  setBookmarkLabel("");
                }}
              >
                <BookmarkCheck className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={bookmarkLabel}
                  onChange={e => setBookmarkLabel(e.target.value)}
                  placeholder="Nome do favorito (ex: Urgentes Lab)"
                  maxLength={40}
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!bookmarkLabel.trim()}
                  className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveBookmark(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Exam name search */}
              <div className="relative sm:col-span-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-sm bg-background"
                  placeholder="Nome do exame (ex: Hemograma, RX Tórax...)"
                  value={examSearch}
                  onChange={e => setExamSearch(e.target.value)}
                  data-testid="input-exam-search"
                />
              </div>
              {/* Exam type */}
              <select
                value={examType}
                onChange={e => setExamType(e.target.value as typeof examType)}
                data-testid="select-exam-type"
                className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Tipo: Todos</option>
                <option value="laboratorial">Laboratorial</option>
                <option value="imagem">Imagem</option>
              </select>
              {/* Exam status */}
              <select
                value={examStatus}
                onChange={e => setExamStatus(e.target.value as typeof examStatus)}
                data-testid="select-exam-status"
                className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Status: Todos</option>
                <option value="solicitado">Solicitado</option>
                <option value="coletado">Coletado</option>
                <option value="laudado">Laudado</option>
              </select>
              {/* Exam priority */}
              <select
                value={examPriority}
                onChange={e => setExamPriority(e.target.value as typeof examPriority)}
                data-testid="select-exam-priority"
                className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Prioridade: Todas</option>
                <option value="urgente">Urgente</option>
                <option value="rotina">Rotina</option>
                <option value="eletivo">Eletivo</option>
              </select>
            </div>
            {hasExamFilter && (
              <p className="text-[11px] text-cyan-400/70">
                Mostrando pacientes com exame pendente: <strong className="text-cyan-400">{examFilterLabel}</strong>
              </p>
            )}
          </div>
        )}

        {/* ── fluxo 4 abas — Recepção / Consultórios / Medicação / Obs ── */}
        {!hasExamFilter && (
          <div className="flex gap-1 mb-3 flex-wrap">
            {(
              [
                { key: "todos",        label: "🏥 Todos",        title: "Todos os pacientes ativos",                              count: grouped?.reduce((n, g) => n + g.patients.length, 0) ?? 0 },
                { key: "triagem",      label: "🩺 Triagem",      title: "Em Triagem (aguardando classificação)",                  count: grouped?.reduce((n, g) => n + g.patients.filter(p => p.careStatus === "Em Triagem").length, 0) ?? 0 },
                { key: "recepcao",     label: "📋 Recepção",     title: "Aguardando Atendimento médico",                          count: grouped?.reduce((n, g) => n + g.patients.filter(p => p.careStatus === "Aguardando Atendimento").length, 0) ?? 0 },
                { key: "consultorios", label: "🩺 Consultórios", title: "Em Atendimento (Cons. 1 e 2)",                           count: grouped?.reduce((n, g) => n + g.patients.filter(p => ["Em Atendimento (Cons. 1)","Em Atendimento (Cons. 2)"].includes(p.careStatus as string)).length, 0) ?? 0 },
                { key: "medicacao",    label: "💊 Medicação",    title: "Em Medicação, Aguardando Exames ou Reavaliação",         count: grouped?.reduce((n, g) => n + g.patients.filter(p => ["Em Medicação","Aguardando Exames","Aguardando Reavaliação"].includes(p.careStatus as string)).length, 0) ?? 0 },
                { key: "observacao",   label: "🛏 Leitos",       title: "Em Observação, Internados, Transferência e Sala Vermelha", count: grouped?.reduce((n, g) => n + g.patients.filter(p => ["Em Observação","Internado","Em Transferência"].includes(p.careStatus as string) || ["sala_vermelha","observacao_adulto","observacao_pediatrica","observacao_pre_adulto"].includes(p.sector as string)).length, 0) ?? 0 },
              ] as const
            ).map(({ key, label, title, count }) => (
              <button
                key={key}
                type="button"
                title={title}
                onClick={() => setFlowTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap",
                  flowTab === key
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "border-border/40 text-muted-foreground hover:bg-muted/30",
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0 rounded-full border",
                    flowTab === key
                      ? "bg-primary/20 border-primary/30 text-primary"
                      : "bg-muted/30 border-border/30 text-muted-foreground",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Sector filters — only in "setor" mode, todos flowTab */}
        {viewMode === "setor" && !hasExamFilter && flowTab === "todos" && (
          <div className="flex gap-1 mb-4 flex-wrap">
            {["Todos", ...SECTOR_NAMES].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setFiltro(s)}
                className={cn(
                  "px-2.5 py-1 rounded border text-xs font-medium transition-colors whitespace-nowrap h-8",
                  filtro === s
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "border-border/40 text-muted-foreground hover:bg-muted/30"
                )}
              >
                {s === "Todos" ? "Todos" : (SECTOR_LABEL[s] ?? s).replace("Observação ", "Obs. ")}
              </button>
            ))}
          </div>
        )}

        {/* ── patient label ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {viewMode === "exames" ? "Exames Pendentes" : "Pacientes Ativos"}
            {totalFiltered > 0 && <span className="ml-2 text-foreground font-bold text-sm">{totalFiltered}</span>}
          </span>
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide hidden sm:block">
            {viewMode === "exames"
              ? "Leito · Paciente · Exame · Status · Prioridade"
              : "Leito · Nome · Status · Diagnóstico"}
          </span>
        </div>

        {/* ── patient list ───────────────────────────────────────────── */}
        {isLoadingPatients ? (
          <div className="space-y-4">
            {[0, 1, 2].map(si => (
              <div key={si}>
                <Skeleton className="h-8 w-full rounded-lg mb-2" />
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  {[0, 1, 2].map(ri => <Skeleton key={ri} className="h-10 w-full rounded-none border-b border-border/20" />)}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "setor" ? (
          <div className="space-y-4">
            {((grouped ?? []).filter(g => g.patients.length > 0 || flowTab === "todos")).map(sector => (
              <div key={sector.name}>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-t-md border mb-0",
                  sector.headerCls
                )}>
                  <span className="text-base leading-none">{sector.emoji}</span>
                  <span className="text-xs font-bold uppercase tracking-wider">{sector.name}</span>
                  <span className="ml-auto text-xs font-mono opacity-70">{sector.patients.length}</span>
                  {isNurseOrTech && sector.patients.filter(p => criticalPatientIds.has(p.id)).length > 0 && (
                    <span className="text-[10px] font-bold text-red-400 flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {sector.patients.filter(p => criticalPatientIds.has(p.id)).length}
                    </span>
                  )}
                </div>
                <div className="rounded-b-lg border border-t-0 border-border/30 overflow-hidden">
                  {sector.patients.length === 0 ? (
                    <div className={cn("py-3 text-center text-xs text-muted-foreground/50 border-l-4", sector.emptyBorder)}>
                      Nenhum paciente
                    </div>
                  ) : (
                    sector.patients.map(patient => (
                      <PatientRow
                        key={patient.id}
                        patient={patient}
                        onEdit={handleEdit}
                        onAlta={handleAlta}
                        onReclassify={handleReclassify}
                        isCritical={isNurseOrTech && criticalPatientIds.has(patient.id)}
                        criticalDetail={isNurseOrTech ? criticalDetailMap.get(patient.id) : undefined}
                        pendingExams={patient.pendingExams}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
            {grouped && grouped.every(g => g.patients.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum paciente encontrado</p>
                {search && <p className="text-xs mt-1 opacity-60">Tente outro termo de busca</p>}
              </div>
            )}
          </div>
        ) : viewMode === "exames" ? (
          /* ── "Lista de Exames" flat view ── */
          <div className="rounded-lg border border-border/30 overflow-hidden">
            {examFlatList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum exame pendente encontrado</p>
                {search && <p className="text-xs mt-1 opacity-60">Tente outro termo de busca</p>}
              </div>
            ) : (
              examFlatList.map(({ patient, exam, examNames }) => {
                const cfg = TRIAGE_CONFIG[patient.triage_level as TriageKey] ?? TRIAGE_CONFIG.blue;
                const isCritical = isNurseOrTech && criticalPatientIds.has(patient.id);
                const EXAM_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
                  solicitado: { label: "Solicitado", cls: "bg-amber-50 text-amber-700 border-amber-300" },
                  coletado:   { label: "Coletado",   cls: "bg-blue-50 text-blue-700 border-blue-300"   },
                  laudado:    { label: "Laudado",     cls: "bg-green-50 text-green-700 border-green-300" },
                };
                const EXAM_PRIO_LABEL: Record<string, { label: string; cls: string }> = {
                  urgente: { label: "Urgente ⚡", cls: "bg-red-50 text-red-700 border-red-300" },
                  rotina:  { label: "Rotina",     cls: "bg-cyan-50 text-cyan-700 border-cyan-300"   },
                  eletivo: { label: "Eletivo",    cls: "bg-slate-50 text-slate-600 border-slate-300" },
                };
                const statusCfg = EXAM_STATUS_LABEL[exam.status] ?? { label: exam.status, cls: "bg-muted/20 text-muted-foreground border-border/40" };
                const prioCfg   = EXAM_PRIO_LABEL[exam.prioridade] ?? { label: exam.prioridade, cls: "bg-muted/20 text-muted-foreground border-border/40" };
                const examType  = exam.imagem.length > 0 && exam.laboratoriais.length === 0 ? "imagem" : "laboratorial";
                return (
                  <Link
                    key={`${patient.id}-${exam.id}`}
                    href={`/patients/${patient.id}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 border-b border-border/25 last:border-b-0 transition-colors cursor-pointer border-l-4",
                      isCritical
                        ? "border-l-red-500 bg-red-50 hover:bg-red-100"
                        : cn(cfg.border, "hover:bg-muted/20"),
                    )}
                  >
                    {/* Bed */}
                    <div className="w-10 shrink-0 text-center">
                      {isCritical ? (
                        <AlertTriangle className="h-4 w-4 text-red-400 mx-auto animate-pulse" />
                      ) : (
                        <span className="text-sm font-mono font-bold text-foreground">
                          {patient.bed || <BedDouble className="h-3.5 w-3.5 text-muted-foreground mx-auto" />}
                        </span>
                      )}
                    </div>

                    {/* Triage badge */}
                    <div className={cn(
                      "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded leading-tight hidden sm:block",
                      isCritical ? "bg-red-100 text-red-700" : cn(cfg.bg, cfg.text),
                    )}>
                      {isCritical ? "⚠ CRÍTICO" : cfg.label}
                    </div>
                    <span className={cn(
                      "w-2 h-2 rounded-full shrink-0 sm:hidden",
                      isCritical ? "bg-red-500 animate-pulse" : cfg.dot,
                    )} />

                    {/* Patient name */}
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        "font-semibold text-sm leading-tight truncate block",
                        isCritical ? "text-red-700" : "text-foreground",
                      )}>
                        {patient.full_name}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{patient.age}a</span>
                      </span>
                      {/* Exam names */}
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        <FlaskConical className={cn("h-3 w-3 shrink-0 mt-0.5", examType === "imagem" ? "text-violet-600" : "text-cyan-600")} />
                        <span className="text-xs text-muted-foreground truncate">
                          {examNames.length > 0 ? examNames.join(", ") : (examType === "imagem" ? "Imagem" : "Laboratorial")}
                        </span>
                      </div>
                    </div>

                    {/* Status + priority badges */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0 rounded border leading-5",
                        statusCfg.cls,
                      )}>
                        {statusCfg.label}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0 rounded border leading-5",
                        prioCfg.cls,
                      )}>
                        {prioCfg.label}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        ) : (
          /* ── "Por Status" view ── */
          <div className="space-y-4">
            {(groupedByStatus ?? []).map(section => (
              <div key={section.key}>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-t-md border mb-0",
                  section.bg, section.border,
                )}>
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", section.dot)} />
                  <span className={cn("text-xs font-bold uppercase tracking-wider", section.color)}>{section.key}</span>
                  <span className="ml-auto text-xs font-mono opacity-70">{section.patients.length}</span>
                  {isNurseOrTech && section.patients.filter(p => criticalPatientIds.has(p.id)).length > 0 && (
                    <span className="text-[10px] font-bold text-red-400 flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {section.patients.filter(p => criticalPatientIds.has(p.id)).length}
                    </span>
                  )}
                  {/* Time alert count */}
                  {section.key === "Em Triagem" && section.patients.filter(p => minutesSince(p.createdAt) > 30).length > 0 && (
                    <span className="text-[10px] font-bold text-orange-400 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {section.patients.filter(p => minutesSince(p.createdAt) > 30).length} &gt;30min
                    </span>
                  )}
                  {section.key === "Em Observação" && section.patients.filter(p => hoursSince(p.careStatusChangedAt as string) > 6).length > 0 && (
                    <span className="text-[10px] font-bold text-purple-400 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {section.patients.filter(p => hoursSince(p.careStatusChangedAt as string) > 6).length} &gt;6h
                    </span>
                  )}
                </div>
                <div className="rounded-b-lg border border-t-0 border-border/30 overflow-hidden">
                  {section.patients.length === 0 ? (
                    <div className="py-3 text-center text-xs text-muted-foreground/50">
                      Nenhum paciente
                    </div>
                  ) : (
                    section.patients.map(patient => (
                      <PatientRow
                        key={patient.id}
                        patient={patient}
                        onEdit={handleEdit}
                        onAlta={handleAlta}
                        onReclassify={handleReclassify}
                        isCritical={isNurseOrTech && criticalPatientIds.has(patient.id)}
                        criticalDetail={isNurseOrTech ? criticalDetailMap.get(patient.id) : undefined}
                        pendingExams={patient.pendingExams}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
            {groupedByStatus && groupedByStatus.every(g => g.patients.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum paciente encontrado</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── lookup dialog ──────────────────────────────────────────────── */}
      <PatientLookupDialog
        open={lookupOpen}
        onOpenChange={setLookupOpen}
        onNewPatient={(prefill) => {
          setPrefillPatient(prefill);
          setIsNewPatientOpen(true);
        }}
      />

      {/* ── new patient dialog ─────────────────────────────────────────── */}
      <Dialog open={isNewPatientOpen} onOpenChange={open => { setIsNewPatientOpen(open); if (!open) setPrefillPatient(undefined); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Admissão</DialogTitle>
            <DialogDescription>
              {prefillPatient
                ? "Dados pré-preenchidos do cadastro existente — revise e ajuste conforme necessário."
                : "Preencha os dados do paciente para registrar a admissão."}
            </DialogDescription>
          </DialogHeader>
          <PatientForm
            patient={prefillPatient as Patient | undefined}
            onSuccess={() => { setIsNewPatientOpen(false); setPrefillPatient(undefined); }}
            onCancel={() => { setIsNewPatientOpen(false); setPrefillPatient(undefined); }}
            restrictToPersonal={["recepcionista", "auxiliar_administrativo"].includes(activeUser?.role ?? "")}
          />
        </DialogContent>
      </Dialog>

      {/* ── edit patient dialog ────────────────────────────────────────── */}
      <Dialog open={!!editingPatient} onOpenChange={open => !open && setEditingPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prontuário</DialogTitle>
            <DialogDescription>Atualize os dados do paciente.</DialogDescription>
          </DialogHeader>
          {editingPatient && (
            <PatientForm
              patient={editingPatient}
              onSuccess={() => setEditingPatient(null)}
              onCancel={() => setEditingPatient(null)}
              restrictToPersonal={["recepcionista", "auxiliar_administrativo"].includes(activeUser?.role ?? "")}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── reclassify modal ───────────────────────────────────────────── */}
      <ReclassifyModal
        patient={reclassifyPatient}
        onClose={() => setReclassifyPatient(null)}
        onSuccess={() => {
          setReclassifyPatient(null);
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
        }}
        userId={activeUser?.id ?? 0}
      />

      {/* ── alta confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={!!altaPatient} onOpenChange={open => !open && setAltaPatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alta</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma a alta de <strong>{altaPatient?.full_name}</strong>? Esta ação removerá o paciente da lista ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAlta} className="bg-destructive hover:bg-destructive/90">
              Confirmar Alta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Critical patient popup — enfermeiro/tecnico_enfermagem only ── */}
      {criticalPopupOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="critical-popup-title"
          aria-describedby="critical-popup-desc"
          data-testid="critical-alert-popup"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setPopupDismissed(true)}
          />
          {/* panel */}
          <div className="relative w-full max-w-md rounded-xl border border-red-200 bg-white shadow-xl p-6 space-y-4">
            {/* title */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
              </span>
              <h2 id="critical-popup-title" className="text-red-700 text-base font-semibold">
                ⚠ Alerta de Paciente Crítico
              </h2>
            </div>
            {/* body */}
            <div id="critical-popup-desc" className="space-y-3">
              <p className="text-sm font-semibold text-foreground">
                Paciente crítico necessita avaliação imediata
              </p>
              <div className="rounded-md border border-red-200 bg-red-50 divide-y divide-red-100">
                {criticals.map(a => (
                  <div key={a.patientId} className="px-3 py-2.5">
                    <p className="text-sm font-bold text-red-700">{a.full_name}</p>
                    <p className="text-xs text-red-600 mt-0.5">{a.alertDetail}</p>
                    {a.bed && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">Leito: {a.bed}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* footer */}
            <button
              type="button"
              onClick={() => setPopupDismissed(true)}
              className="w-full rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 transition-colors"
            >
              Entendido — Vou Avaliar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
