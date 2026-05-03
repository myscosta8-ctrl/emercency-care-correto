import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { useAuth } from "@/lib/use-auth";
import { Link, useLocation } from "wouter";
import {
  useListPatients,
  useGetPatientsSummary,
  useDeletePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { Activity, UserPlus, Users, Search, Pencil, LogOut, ClipboardList, BedDouble, Settings2, Power, AlertTriangle, Siren } from "lucide-react";
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

// Roles that receive active alert notifications (sound + popup + panel)
const ALERT_ROLES = new Set(["enfermeiro", "tecnico_enfermagem"]);

// ── triage config ─────────────────────────────────────────────────────────────

const TRIAGE_CONFIG = {
  red:    { label: "Vermelho",  sub: "EMERGÊNCIA",    border: "border-l-red-500",    dot: "bg-red-500",    text: "text-red-400",    bg: "bg-red-500/10"    },
  orange: { label: "Laranja",   sub: "MUITO URGENTE", border: "border-l-orange-500", dot: "bg-orange-500", text: "text-orange-400", bg: "bg-orange-500/10" },
  yellow: { label: "Amarelo",   sub: "URGENTE",       border: "border-l-yellow-400", dot: "bg-yellow-400", text: "text-yellow-400", bg: "bg-yellow-400/10" },
  green:  { label: "Verde",     sub: "POUCO URGENTE", border: "border-l-green-500",  dot: "bg-green-500",  text: "text-green-400",  bg: "bg-green-500/10"  },
  blue:   { label: "Azul",      sub: "NÃO URGENTE",   border: "border-l-blue-500",   dot: "bg-blue-500",   text: "text-blue-400",   bg: "bg-blue-500/10"   },
} as const;

type TriageKey = keyof typeof TRIAGE_CONFIG;

const TRIAGE_SEVERITY: Record<string, number> = { red: 1, orange: 2, yellow: 3, green: 4, blue: 5 };

const SECTOR_CONFIG = [
  { key: "sala_vermelha",         name: "Sala Vermelha",         emoji: "🔴", headerCls: "bg-red-950/60 border-red-700/50 text-red-300",        emptyBorder: "border-red-900/30"    },
  { key: "observacao_adulto",     name: "Observação Adulto",     emoji: "🟡", headerCls: "bg-yellow-950/40 border-yellow-700/40 text-yellow-300", emptyBorder: "border-yellow-900/30" },
  { key: "observacao_pediatrica", name: "Observação Pediátrica", emoji: "🟢", headerCls: "bg-green-950/40 border-green-700/40 text-green-300",   emptyBorder: "border-green-900/30"  },
  { key: "observacao_pre_adulto", name: "Observação Pré-Adulto", emoji: "🔵", headerCls: "bg-blue-950/40 border-blue-700/40 text-blue-300",      emptyBorder: "border-blue-900/30"   },
];

const SECTOR_NAMES = SECTOR_CONFIG.map(s => s.key);
const SECTOR_LABEL = Object.fromEntries(SECTOR_CONFIG.map(s => [s.key, s.name]));

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
  isCritical?: boolean;
  criticalDetail?: string;
}

const PatientRow = memo(function PatientRow({
  patient, onEdit, onAlta, isCritical = false, criticalDetail,
}: PatientRowProps) {
  const { pode } = useAuth();
  const cfg = TRIAGE_CONFIG[patient.triage_level as TriageKey] ?? TRIAGE_CONFIG.blue;

  return (
    <div className={cn(
      "group relative flex items-stretch border-l-4 border-b border-border/30 last:border-b-0 transition-colors",
      isCritical
        ? "border-l-red-500 bg-red-500/10"
        : cn(cfg.border, "hover:bg-muted/20"),
    )}>
      {/* Blinking overlay for critical patients */}
      {isCritical && (
        <div className="absolute inset-0 bg-red-500/8 animate-pulse pointer-events-none" />
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
          isCritical ? "bg-red-500/20 text-red-400" : cn(cfg.bg, cfg.text),
        )}>
          {isCritical ? "⚠ CRÍTICO" : cfg.label}
        </div>
        <span className={cn(
          "w-2 h-2 rounded-full shrink-0 md:hidden",
          isCritical ? "bg-red-500 animate-pulse" : cfg.dot,
        )} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={cn(
              "font-semibold text-sm leading-tight truncate",
              isCritical ? "text-red-300" : "text-foreground",
            )}>
              {patient.full_name}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{patient.age}a</span>
            {patient.internmentStatus === "internado" && (
              <span className="text-[10px] font-bold px-1.5 py-0 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 leading-5">INT</span>
            )}
          </div>
          {/* Critical detail shows the offending vital (SpO₂, FC, PAS) */}
          {isCritical && criticalDetail ? (
            <p className="text-xs font-semibold text-red-400 leading-tight mt-0.5">{criticalDetail}</p>
          ) : patient.diagnosis ? (
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{patient.diagnosis}</p>
          ) : null}
        </div>

        {/* PACIENTE CRÍTICO badge (desktop) */}
        {isCritical && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-red-500/20 text-red-400 border-red-500/40 uppercase tracking-wider shrink-0 hidden sm:inline-flex items-center gap-1">
            PACIENTE CRÍTICO
          </span>
        )}
      </Link>

      <div className="flex items-center gap-0.5 px-1.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
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

// ── main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { pode, activeUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [altaPatient, setAltaPatient]     = useState<Patient | null>(null);
  const [search, setSearch]               = useState("");
  const [filtro, setFiltro]               = useState("Todos");
  const [triageFilter, setTriageFilter]   = useState("all");

  const debouncedSearch = useDebounce(search, 200);

  const { data: patients, isLoading: isLoadingPatients } = useListPatients();
  const { data: summary, isLoading: isLoadingSummary }   = useGetPatientsSummary();
  const deletePatient = useDeletePatient();
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
  const grouped = useMemo(() => {
    if (!patients) return null;
    const q = debouncedSearch.toLowerCase();
    const base = patients.filter(p => {
      const matchesSearch = !q || p.full_name.toLowerCase().includes(q) || (p.bed?.toLowerCase().includes(q) ?? false);
      const matchesSector = filtro === "Todos" || p.sector === filtro;
      const matchesTriage = triageFilter === "all" || p.triage_level === triageFilter;
      return matchesSearch && matchesSector && matchesTriage;
    });
    return SECTOR_CONFIG.map(cfg => ({
      ...cfg,
      patients: base
        .filter(p => p.sector === cfg.key)
        .sort((a, b) => {
          // Critical patients (by vitals or triage) always come first
          const aCrit = criticalPatientIds.has(a.id) ? 0 : 1;
          const bCrit = criticalPatientIds.has(b.id) ? 0 : 1;
          if (aCrit !== bCrit) return aCrit - bCrit;
          return (TRIAGE_SEVERITY[a.triage_level] ?? 99) - (TRIAGE_SEVERITY[b.triage_level] ?? 99);
        }),
    }));
  }, [patients, debouncedSearch, filtro, triageFilter, criticalPatientIds]);

  const totalFiltered = grouped ? grouped.reduce((n, g) => n + g.patients.length, 0) : 0;
  const handleEdit    = useCallback((p: Patient) => setEditingPatient(p), []);
  const handleAlta    = useCallback((p: Patient) => setAltaPatient(p), []);

  const confirmAlta = () => {
    if (!altaPatient) return;
    deletePatient.mutate({ id: altaPatient.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
        toast({ title: "Alta registrada com sucesso" });
        setAltaPatient(null);
      },
      onError: () => toast({ title: "Não foi possível registrar a alta", variant: "destructive" }),
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-base font-bold tracking-tight truncate hidden sm:block">UPA Breves — Gestão de Pacientes</h1>
            <h1 className="text-base font-bold tracking-tight sm:hidden">UPA Breves</h1>
            {/* Live critical count badge — nurses and technicians only */}
            {isNurseOrTech && criticals.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                <Siren className="h-3 w-3" />
                {criticals.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {activeUser?.role === "administrador" && (
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Admin</span>
                </Button>
              </Link>
            )}
            {pode("gerenciar_usuarios") && (
              <Link href="/funcionarios">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Funcionários</span>
                </Button>
              </Link>
            )}
            {pode("registrar_evolucao") && (
              <Link href="/passagem-plantao">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Passagem de Plantão</span>
                </Button>
              </Link>
            )}
            <Button
              onClick={() => setIsNewPatientOpen(true)}
              data-testid="button-new-patient"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-semibold"
              disabled={!pode("criar_paciente")}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova Admissão</span>
              <span className="sm:hidden">+ Admissão</span>
            </Button>
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

      <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl">

        {/* ── CRITICAL PATIENTS ALERT PANEL — enfermeiro/tecnico_enfermagem only ── */}
        {isNurseOrTech && criticals.length > 0 && (
          <div className="mb-4 rounded-lg overflow-hidden border border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.12)]">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/20 border-b border-red-500/30">
              <Siren className="h-4 w-4 text-red-400 shrink-0 animate-pulse" />
              <span className="text-xs font-bold text-red-300 uppercase tracking-wider flex-1">
                ⚠ ATENÇÃO — {criticals.length} PACIENTE{criticals.length !== 1 ? "S" : ""} CRÍTICO{criticals.length !== 1 ? "S" : ""}
              </span>
              <span className="text-[10px] text-red-400/70 shrink-0 hidden sm:block">
                Atualiza a cada 30s
              </span>
            </div>

            {/* Critical patient rows */}
            <div className="bg-red-950/20 divide-y divide-red-500/20">
              {criticals.map(alert => (
                <Link key={alert.patientId} href={`/patients/${alert.patientId}`}>
                  <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 transition-colors cursor-pointer group">
                    {/* Pulsing indicator */}
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-bold text-red-200 truncate">{alert.full_name}</span>
                        {alert.bed && (
                          <span className="text-[10px] text-red-400/70 shrink-0">Leito {alert.bed}</span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-red-400 leading-tight">
                        {alert.alertDetail}
                      </p>
                    </div>

                    {/* Reason badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-red-500/25 text-red-300 border-red-500/40 uppercase tracking-wider shrink-0 hidden sm:block">
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
            { key: "red",    label: "Verm.",    value: summary?.red,    cls: "text-red-400",      dot: "bg-red-500" },
            { key: "orange", label: "Lar.",     value: summary?.orange, cls: "text-orange-400",   dot: "bg-orange-500" },
            { key: "yellow", label: "Amar.",    value: summary?.yellow, cls: "text-yellow-400",   dot: "bg-yellow-400" },
            { key: "green",  label: "Verde",    value: summary?.green,  cls: "text-green-400",    dot: "bg-green-500" },
            { key: "blue",   label: "Azul",     value: summary?.blue,   cls: "text-blue-400",     dot: "bg-blue-500" },
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
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold border-red-500/40 bg-red-500/10 text-red-400">
              <AlertTriangle className="h-3 w-3" />
              <span>{criticals.length}</span>
              <span className="text-red-400/70 font-normal">Críticos</span>
            </span>
          )}
        </div>

        {/* ── search + filters ───────────────────────────────────────── */}
        <div className="flex gap-2 mb-4 flex-wrap">
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
          <div className="flex gap-1 flex-wrap">
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
        </div>

        {/* ── patient label ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pacientes Ativos
            {totalFiltered > 0 && <span className="ml-2 text-foreground font-bold text-sm">{totalFiltered}</span>}
          </span>
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide hidden sm:block">
            Leito · Nome · Diagnóstico
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
        ) : (
          <div className="space-y-4">
            {(grouped ?? []).map(sector => (
              <div key={sector.name}>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-t-md border mb-0",
                  sector.headerCls
                )}>
                  <span className="text-base leading-none">{sector.emoji}</span>
                  <span className="text-xs font-bold uppercase tracking-wider">{sector.name}</span>
                  <span className="ml-auto text-xs font-mono opacity-70">{sector.patients.length}</span>
                  {/* Show mini critical count per sector — nurses and technicians only */}
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
                        isCritical={isNurseOrTech && criticalPatientIds.has(patient.id)}
                        criticalDetail={isNurseOrTech ? criticalDetailMap.get(patient.id) : undefined}
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
        )}
      </main>

      {/* ── new patient dialog ─────────────────────────────────────────── */}
      <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Admissão</DialogTitle>
            <DialogDescription>Preencha os dados do paciente para registrar a admissão.</DialogDescription>
          </DialogHeader>
          <PatientForm
            onSuccess={() => setIsNewPatientOpen(false)}
            onCancel={() => setIsNewPatientOpen(false)}
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
            />
          )}
        </DialogContent>
      </Dialog>

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
          <div className="relative w-full max-w-md rounded-lg border border-red-500/60 bg-[#120808] shadow-2xl p-6 space-y-4">
            {/* title */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
              </span>
              <h2 id="critical-popup-title" className="text-red-300 text-base font-semibold">
                ⚠ Alerta de Paciente Crítico
              </h2>
            </div>
            {/* body */}
            <div id="critical-popup-desc" className="space-y-3">
              <p className="text-sm font-semibold text-foreground">
                Paciente crítico necessita avaliação imediata
              </p>
              <div className="rounded-md border border-red-500/30 bg-red-500/10 divide-y divide-red-500/20">
                {criticals.map(a => (
                  <div key={a.patientId} className="px-3 py-2.5">
                    <p className="text-sm font-bold text-red-200">{a.full_name}</p>
                    <p className="text-xs text-red-400 mt-0.5">{a.alertDetail}</p>
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
