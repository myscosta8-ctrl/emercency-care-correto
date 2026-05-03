import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { FEATURES } from "@/lib/features";
import { Link } from "wouter";
import {
  useListPatients,
  useGetPatientsSummary,
  useDeletePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { Activity, UserPlus, Users, Search, Pencil, LogOut, ClipboardList, BedDouble } from "lucide-react";
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

const TRIAGE_OPTIONS = [
  { value: "all",    label: "Todos" },
  { value: "red",    label: "🔴 Vermelho" },
  { value: "orange", label: "🟠 Laranja" },
  { value: "yellow", label: "🟡 Amarelo" },
  { value: "green",  label: "🟢 Verde" },
  { value: "blue",   label: "🔵 Azul" },
];

const SECTOR_CONFIG = [
  { key: "sala_vermelha",         name: "Sala Vermelha",         emoji: "🔴", headerCls: "bg-red-950/60 border-red-700/50 text-red-300",        emptyBorder: "border-red-900/30"    },
  { key: "observacao_adulto",     name: "Observação Adulto",     emoji: "🟡", headerCls: "bg-yellow-950/40 border-yellow-700/40 text-yellow-300", emptyBorder: "border-yellow-900/30" },
  { key: "observacao_pediatrica", name: "Observação Pediátrica", emoji: "🟢", headerCls: "bg-green-950/40 border-green-700/40 text-green-300",   emptyBorder: "border-green-900/30"  },
  { key: "observacao_pre_adulto", name: "Observação Pré-Adulto", emoji: "🔵", headerCls: "bg-blue-950/40 border-blue-700/40 text-blue-300",      emptyBorder: "border-blue-900/30"   },
];

const SECTOR_NAMES  = SECTOR_CONFIG.map(s => s.key);
const SECTOR_LABEL  = Object.fromEntries(SECTOR_CONFIG.map(s => [s.key, s.name]));

// ── vitals helpers ────────────────────────────────────────────────────────────

function fcClass(v: number) {
  if (v <= 0) return "";
  if (v > 120 || v < 50) return "text-red-400 font-bold";
  if (v > 100 || v < 60) return "text-orange-400 font-semibold";
  return "text-muted-foreground";
}
function spo2Class(v: number) {
  if (v <= 0) return "";
  if (v < 90) return "text-red-400 font-bold";
  if (v < 94) return "text-orange-400 font-semibold";
  if (v < 97) return "text-yellow-400";
  return "text-muted-foreground";
}
function tempClass(v: number) {
  if (v <= 0) return "";
  if (v >= 39) return "text-red-400 font-bold";
  if (v >= 38) return "text-orange-400 font-semibold";
  if (v < 36) return "text-blue-400";
  return "text-muted-foreground";
}
function bpClass(sys: number) {
  if (sys <= 0) return "";
  if (sys > 180 || sys < 80) return "text-red-400 font-bold";
  if (sys > 160 || sys < 90) return "text-orange-400 font-semibold";
  return "text-muted-foreground";
}

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
}

const PatientRow = memo(function PatientRow({ patient, onEdit, onAlta }: PatientRowProps) {
  const cfg = TRIAGE_CONFIG[patient.status as TriageKey] ?? TRIAGE_CONFIG.blue;
  const hasBp = patient.systolicBp > 0 && patient.diastolicBp > 0;

  return (
    <div className={cn(
      "group flex items-stretch border-l-4 hover:bg-muted/20 transition-colors border-b border-border/30 last:border-b-0",
      cfg.border,
    )}>
      {/* Clickable area */}
      <Link href={`/patients/${patient.id}`} className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0 cursor-pointer">

        {/* Bed number — most prominent */}
        <div className="w-11 shrink-0 text-center">
          <div className="text-sm font-mono font-bold text-foreground leading-tight">
            {patient.bed || <BedDouble className="h-3.5 w-3.5 text-muted-foreground mx-auto" />}
          </div>
        </div>

        {/* Triage badge */}
        <div className={cn(
          "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded leading-tight hidden md:block",
          cfg.bg, cfg.text
        )}>
          {cfg.label}
        </div>
        <span className={cn("w-2 h-2 rounded-full shrink-0 md:hidden", cfg.dot)} />

        {/* Name + age + diagnosis */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-foreground leading-tight truncate">{patient.nome}</span>
            <span className="text-xs text-muted-foreground shrink-0">{patient.age}a</span>
            {patient.internmentStatus === "internado" && (
              <span className="text-[10px] font-bold px-1.5 py-0 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 leading-5">INT</span>
            )}
          </div>
          {patient.diagnosis && (
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{patient.diagnosis}</p>
          )}
        </div>

        {/* Vitals — inline, color-coded */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {patient.heartRate > 0 && (
            <span className={cn("text-xs font-mono tabular-nums", fcClass(patient.heartRate))}>
              FC <strong>{patient.heartRate}</strong>
            </span>
          )}
          {patient.spO2 > 0 && (
            <span className={cn("text-xs font-mono tabular-nums", spo2Class(patient.spO2))}>
              SpO₂ <strong>{patient.spO2}%</strong>
            </span>
          )}
          {patient.temperature > 0 && (
            <span className={cn("text-xs font-mono tabular-nums", tempClass(patient.temperature))}>
              <strong>{patient.temperature}°C</strong>
            </span>
          )}
          {hasBp && (
            <span className={cn("text-xs font-mono tabular-nums", bpClass(patient.systolicBp))}>
              <strong>{patient.systolicBp}/{patient.diastolicBp}</strong>
            </span>
          )}
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-0.5 px-1.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          title="Editar"
          onClick={e => { e.preventDefault(); onEdit(patient); }}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Alta"
          onClick={e => { e.preventDefault(); onAlta(patient); }}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

// ── main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
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

  const grouped = useMemo(() => {
    if (!patients) return null;
    const q = debouncedSearch.toLowerCase();
    const base = patients.filter(p => {
      const matchesSearch = !q || p.nome.toLowerCase().includes(q) || (p.bed?.toLowerCase().includes(q) ?? false);
      const matchesSector = filtro === "Todos" || p.setor === filtro;
      const matchesTriage = triageFilter === "all" || p.status === triageFilter;
      return matchesSearch && matchesSector && matchesTriage;
    });
    return SECTOR_CONFIG.map(cfg => ({
      ...cfg,
      patients: base
        .filter(p => p.setor === cfg.key)
        .sort((a, b) => (TRIAGE_SEVERITY[a.status] ?? 99) - (TRIAGE_SEVERITY[b.status] ?? 99)),
    }));
  }, [patients, debouncedSearch, filtro, triageFilter]);

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
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/funcionarios">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                <Users className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Funcionários</span>
              </Button>
            </Link>
            <Link href="/passagem-plantao">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                <ClipboardList className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Passagem de Plantão</span>
              </Button>
            </Link>
            <Button
              onClick={() => setIsNewPatientOpen(true)}
              data-testid="button-new-patient"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova Admissão</span>
              <span className="sm:hidden">+ Admissão</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl">

        {/* ── summary strip ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {[
            { key: "all",    label: "Total",    value: summary?.total,  cls: "text-foreground",      dot: "" },
            { key: "red",    label: "Verm.",    value: summary?.red,    cls: "text-red-400",         dot: "bg-red-500" },
            { key: "orange", label: "Lar.",     value: summary?.orange, cls: "text-orange-400",      dot: "bg-orange-500" },
            { key: "yellow", label: "Amar.",    value: summary?.yellow, cls: "text-yellow-400",      dot: "bg-yellow-400" },
            { key: "green",  label: "Verde",    value: summary?.green,  cls: "text-green-400",       dot: "bg-green-500" },
            { key: "blue",   label: "Azul",     value: summary?.blue,   cls: "text-blue-400",        dot: "bg-blue-500" },
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
            Leito · Nome · Diagnóstico · Sinais vitais
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
                {/* Sector header */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-t-md border mb-0",
                  sector.headerCls
                )}>
                  <span className="text-sm leading-none">{sector.emoji}</span>
                  <span className="font-semibold text-xs tracking-wide uppercase">{sector.name}</span>
                  <span className="ml-auto text-[11px] font-bold opacity-80 tabular-nums">
                    {sector.patients.length} {sector.patients.length === 1 ? "pac." : "pac."}
                  </span>
                </div>

                {sector.patients.length === 0 ? (
                  <div className={cn(
                    "rounded-b-md border border-t-0 border-dashed py-2.5 text-center text-xs text-muted-foreground",
                    sector.emptyBorder
                  )}>
                    Setor vazio
                  </div>
                ) : (
                  <div className="rounded-b-md border border-t-0 border-border/30 overflow-hidden">
                    {sector.patients.map(patient => (
                      <PatientRow
                        key={patient.id}
                        patient={patient}
                        onEdit={handleEdit}
                        onAlta={handleAlta}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {totalFiltered === 0 && !isLoadingPatients && (
              <div className="text-center py-12 bg-card rounded-lg border border-border/50">
                <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <h3 className="text-sm font-medium">Nenhum paciente encontrado</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || filtro !== "Todos" || triageFilter !== "all"
                    ? "Ajuste os filtros de busca."
                    : "Clique em 'Nova Admissão' para registrar um paciente."}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── dialogs ──────────────────────────────────────────────────── */}
      <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Admissão</DialogTitle>
            <DialogDescription>Preencha os dados obrigatórios. Sinais vitais são opcionais.</DialogDescription>
          </DialogHeader>
          <PatientForm onSuccess={() => setIsNewPatientOpen(false)} onCancel={() => setIsNewPatientOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPatient} onOpenChange={open => { if (!open) setEditingPatient(null); }}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prontuário</DialogTitle>
            <DialogDescription>Atualize os dados clínicos do paciente.</DialogDescription>
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

      <AlertDialog open={!!altaPatient} onOpenChange={open => { if (!open) setAltaPatient(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alta</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma a alta de <strong>{altaPatient?.nome}</strong>? O registro será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePatient.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); confirmAlta(); }}
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
