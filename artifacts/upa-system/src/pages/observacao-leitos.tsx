import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useListPatients,
  useUpdatePatientStatus,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, AlertTriangle, Siren, Search,
  BedDouble, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PatientForm } from "@/components/patient-form";
import { PatientLookupDialog } from "@/components/patient-lookup";
import { PatientRow, ReclassifyModal } from "@/components/patient-row";
import { DashboardSidebar, MobileSectorTabs } from "@/components/dashboard-sidebar";
import { useAuth } from "@/lib/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useCriticalAlerts } from "@/hooks/use-critical-alerts";
import { useOffline } from "@/hooks/use-offline";
import { cn } from "@/lib/utils";
import {
  ALL_SECTOR_CONFIG, OBS_SECTORS, TRIAGE_SEVERITY,
  TRIAGE_CONFIG, type TriageKey,
  minutesSince,
} from "@/lib/care-status-config";
import { WifiOff } from "lucide-react";

const ALERT_ROLES = new Set(["enfermeiro", "tecnico_enfermagem"]);

const OBS_SECTOR_CONFIG = ALL_SECTOR_CONFIG.filter(s => OBS_SECTORS.has(s.key));

const TRIAGE_FILTER_OPTIONS = [
  { key: "all",    label: "Todos",   dot: "" },
  { key: "red",    label: "Verm.",   dot: "bg-red-500" },
  { key: "orange", label: "Lar.",    dot: "bg-orange-500" },
  { key: "yellow", label: "Amar.",   dot: "bg-yellow-500" },
  { key: "green",  label: "Verde",   dot: "bg-green-500" },
  { key: "blue",   label: "Azul",    dot: "bg-blue-500" },
];

export default function ObservacaoLeitos() {
  const { pode, activeUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { isOffline }   = useOffline();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();

  const [search, setSearch]                       = useState("");
  const [triageFilter, setTriageFilter]           = useState("all");
  const [reclassifyPatient, setReclassifyPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient]       = useState<Patient | null>(null);
  const [altaPatient, setAltaPatient]             = useState<Patient | null>(null);
  const [lookupOpen, setLookupOpen]               = useState(false);
  const [prefillPatient, setPrefillPatient]       = useState<Partial<Patient> | undefined>(undefined);

  const isNurseOrTech = ALERT_ROLES.has(activeUser?.role ?? "");
  const { criticals, criticalPatientIds, criticalDetailMap } = useCriticalAlerts({
    alertsEnabled: isNurseOrTech,
  });

  const { data: patients, isLoading } = useListPatients();
  const updatePatientStatus = useUpdatePatientStatus();

  const preAdultoAtivo = true;

  const activeSectorConfig = useMemo(() =>
    OBS_SECTOR_CONFIG.filter(s =>
      s.key !== "observacao_pre_adulto" || preAdultoAtivo
    ),
    [preAdultoAtivo]
  );

  const { grouped, totals } = useMemo(() => {
    if (!patients) return { grouped: null, totals: { total: 0, red: 0, orange: 0, yellow: 0, green: 0, blue: 0 } };

    const q = search.toLowerCase();

    const base = patients.filter(p => {
      if (p.careStatus === "Alta") return false;
      if (!OBS_SECTORS.has(p.sector as string)) return false;
      const matchesSearch  = !q || p.full_name.toLowerCase().includes(q) || (p.bed?.toLowerCase().includes(q) ?? false);
      const matchesTriage  = triageFilter === "all" || p.triage_level === triageFilter;
      return matchesSearch && matchesTriage;
    });

    const sortFn = (a: Patient, b: Patient) => {
      const aCrit = criticalPatientIds.has(a.id) ? 0 : 1;
      const bCrit = criticalPatientIds.has(b.id) ? 0 : 1;
      if (aCrit !== bCrit) return aCrit - bCrit;
      return (TRIAGE_SEVERITY[a.triage_level] ?? 99) - (TRIAGE_SEVERITY[b.triage_level] ?? 99);
    };

    const grouped = activeSectorConfig.map(cfg => ({
      ...cfg,
      patients: base.filter(p => p.sector === cfg.key).sort(sortFn),
    }));

    const all = patients.filter(p => p.careStatus !== "Alta" && OBS_SECTORS.has(p.sector as string));
    const totals = {
      total:  all.length,
      red:    all.filter(p => p.triage_level === "red").length,
      orange: all.filter(p => p.triage_level === "orange").length,
      yellow: all.filter(p => p.triage_level === "yellow").length,
      green:  all.filter(p => p.triage_level === "green").length,
      blue:   all.filter(p => p.triage_level === "blue").length,
    };

    return { grouped, totals };
  }, [patients, search, triageFilter, criticalPatientIds, activeSectorConfig]);

  const handleEdit       = useCallback((p: Patient) => setEditingPatient(p), []);
  const handleAlta       = useCallback((p: Patient) => setAltaPatient(p), []);
  const handleReclassify = useCallback((p: Patient) => setReclassifyPatient(p), []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
  }, [queryClient]);

  const confirmAlta = () => {
    if (!altaPatient) return;
    updatePatientStatus.mutate(
      {
        id: altaPatient.id,
        data: {
          care_status: "Alta",
          triage_level: altaPatient.triage_level as "red" | "orange" | "yellow" | "green" | "blue",
          user_id: activeUser?.id ?? 0,
        },
      },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Alta registrada com sucesso", description: "Dados preservados no histórico." });
          setAltaPatient(null);
        },
        onError: () => toast({ title: "Não foi possível registrar a alta", variant: "destructive" }),
      }
    );
  };

  const obsCount = totals.total;
  const localCriticals = criticals.filter(c => {
    const p = patients?.find(x => x.id === c.patientId);
    return p && OBS_SECTORS.has(p.sector as string);
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-row">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
          <div className="px-4 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 leading-none shrink-0">
                <div className="font-black text-sm tracking-tight">UPA</div>
                <div className="font-bold text-[9px] tracking-[0.2em] text-center opacity-90">24h</div>
              </div>
              <div className="hidden sm:block">
                <div className="font-black text-sm text-foreground tracking-wide leading-tight">Leitos & Observação</div>
                <div className="text-[10px] text-muted-foreground leading-tight">Sala Vermelha · Obs. Adulto · Obs. Pediátrica · Pré-Obs.</div>
              </div>
              {isNurseOrTech && localCriticals.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse ml-1">
                  <Siren className="h-3 w-3" />
                  {localCriticals.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => pode("criar_paciente") && setLookupOpen(true)}
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs font-semibold"
                disabled={!pode("criar_paciente")}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nova Admissão</span>
                <span className="sm:hidden">+</span>
              </Button>

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
                variant="ghost" size="sm"
                title={`Sair (${activeUser?.name ?? ""})`}
                aria-label="Sair"
                className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
                onClick={() => { logout(); setLocation("/login"); }}
              >
                Sair
              </Button>
            </div>
          </div>
        </header>

        {/* ── Offline banner ───────────────────────────────────────── */}
        {isOffline && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-semibold">
            <WifiOff className="h-4 w-4 shrink-0" />
            Sem conexão com a internet — dados podem estar desatualizados.
          </div>
        )}

        {/* ── Mobile sector tabs ───────────────────────────────────── */}
        <MobileSectorTabs current="leitos" />

        {/* ── Critical patients panel ──────────────────────────────── */}
        {isNurseOrTech && localCriticals.length > 0 && (
          <div className="mx-4 mt-4 rounded-lg overflow-hidden border border-red-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border-b border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse shrink-0" />
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                {localCriticals.length} Paciente{localCriticals.length > 1 ? "s" : ""} Crítico{localCriticals.length > 1 ? "s" : ""} nos Leitos
              </span>
            </div>
            <div className="divide-y divide-red-100">
              {localCriticals.map(alert => {
                const p = patients?.find(x => x.id === alert.patientId);
                if (!p) return null;
                return (
                  <div key={alert.patientId} className="flex items-center gap-3 px-3 py-2 bg-red-50/50">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 animate-pulse" />
                    <span className="text-sm font-semibold text-red-700 flex-1 truncate">{p.full_name}</span>
                    <span className="text-xs text-red-600 shrink-0">{alert.alertDetail}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{p.bed ?? "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl">

          {/* ── Summary strip ────────────────────────────────────────── */}
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {TRIAGE_FILTER_OPTIONS.map(card => {
              const value = card.key === "all"
                ? totals.total
                : totals[card.key as keyof typeof totals] as number;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setTriageFilter(triageFilter === card.key ? "all" : card.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-colors",
                    triageFilter === card.key
                      ? "bg-muted/60 border-primary/50 text-foreground"
                      : "border-border/40 bg-card hover:bg-muted/30 text-muted-foreground",
                  )}
                >
                  {card.dot && <span className={cn("w-2 h-2 rounded-full shrink-0", card.dot)} />}
                  <span>{value}</span>
                  <span className="font-normal">{card.label}</span>
                </button>
              );
            })}

            {isNurseOrTech && localCriticals.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold border-red-300 bg-red-100 text-red-700">
                <AlertTriangle className="h-3 w-3" />
                <span>{localCriticals.length}</span>
                <span className="text-red-600/80 font-normal">Críticos</span>
              </span>
            )}
          </div>

          {/* ── Search ────────────────────────────────────────────────── */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Buscar nome ou leito..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ── Avg time in obs info ────────────────────────────────── */}
          {obsCount > 0 && !isLoading && (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
              <BedDouble className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold text-foreground">{obsCount}</span>
              <span>paciente{obsCount !== 1 ? "s" : ""} internado{obsCount !== 1 ? "s" : ""}</span>
              {patients && (() => {
                const obs = patients.filter(p =>
                  p.careStatus !== "Alta" &&
                  OBS_SECTORS.has(p.sector as string) &&
                  p.careStatusChangedAt
                );
                if (obs.length === 0) return null;
                const avgHours = obs.reduce((s, p) =>
                  s + (Date.now() - new Date(p.careStatusChangedAt as string).getTime()) / 3_600_000, 0
                ) / obs.length;
                const h = Math.floor(avgHours);
                const m = Math.round((avgHours - h) * 60);
                return (
                  <span className="ml-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Média: {h > 0 ? `${h}h ` : ""}{m}min em observação
                  </span>
                );
              })()}
            </div>
          )}

          {/* ── Sector label ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pacientes por Setor
              {(grouped?.reduce((n, g) => n + g.patients.length, 0) ?? 0) > 0 && (
                <span className="ml-2 text-foreground font-bold text-sm">
                  {grouped?.reduce((n, g) => n + g.patients.length, 0)}
                </span>
              )}
            </span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide hidden sm:block">
              Leito · Nome · Status · Diagnóstico
            </span>
          </div>

          {/* ── Sector list ──────────────────────────────────────────── */}
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i}>
                  <Skeleton className="h-8 w-full rounded-t-lg mb-0" />
                  <div className="rounded-b-lg border border-t-0 border-border/30 overflow-hidden">
                    {[0, 1].map(j => <Skeleton key={j} className="h-10 w-full border-b border-border/20" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(grouped ?? []).map(sector => (
                <div key={sector.key}>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-t-md border mb-0",
                    sector.headerCls,
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
                      <div className={cn(
                        "py-4 text-center text-xs text-muted-foreground border-t-2",
                        sector.emptyBorder,
                      )}>
                        Nenhum paciente neste setor
                      </div>
                    ) : (
                      sector.patients.map(p => (
                        <PatientRow
                          key={p.id}
                          patient={p}
                          onEdit={handleEdit}
                          onAlta={handleAlta}
                          onReclassify={handleReclassify}
                          isCritical={criticalPatientIds.has(p.id)}
                          criticalDetail={criticalDetailMap.get(p.id)}
                          pendingExams={p.pendingExams}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}

              {(grouped ?? []).every(g => g.patients.length === 0) && !isLoading && (
                <div className="py-12 text-center text-muted-foreground">
                  <BedDouble className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhum paciente internado nos leitos de observação</p>
                  <p className="text-xs mt-1">Sala Vermelha, Obs. Adulto, Obs. Pediátrica e Pré-Obs. estão vazios</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Reclassify modal ──────────────────────────────────────── */}
      <ReclassifyModal
        patient={reclassifyPatient}
        onClose={() => setReclassifyPatient(null)}
        onSuccess={() => { invalidateAll(); setReclassifyPatient(null); }}
        userId={activeUser?.id ?? 0}
      />

      {/* ── Edit patient dialog ───────────────────────────────────── */}
      {editingPatient && (
        <Dialog open={!!editingPatient} onOpenChange={open => !open && setEditingPatient(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Paciente</DialogTitle>
            </DialogHeader>
            <PatientForm
              patient={editingPatient}
              onSuccess={() => { invalidateAll(); setEditingPatient(null); }}
              onCancel={() => setEditingPatient(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Alta confirm dialog ───────────────────────────────────── */}
      <AlertDialog open={!!altaPatient} onOpenChange={open => !open && setAltaPatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alta</AlertDialogTitle>
            <AlertDialogDescription>
              Registrar alta para <strong>{altaPatient?.full_name}</strong>?
              Os dados serão preservados no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAlta}>
              {updatePatientStatus.isPending ? "Registrando..." : "Confirmar Alta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Patient lookup ────────────────────────────────────────── */}
      <PatientLookupDialog
        open={lookupOpen}
        onOpenChange={open => { setLookupOpen(open); if (!open) setPrefillPatient(undefined); }}
        onNewPatient={data => {
          setPrefillPatient(data);
          setLookupOpen(false);
          setEditingPatient(null);
        }}
      />

      {prefillPatient !== undefined && !lookupOpen && (
        <Dialog open onOpenChange={open => { if (!open) setPrefillPatient(undefined); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Admissão</DialogTitle>
            </DialogHeader>
            <PatientForm
              patient={prefillPatient as Patient | undefined}
              onSuccess={() => { invalidateAll(); setPrefillPatient(undefined); }}
              onCancel={() => setPrefillPatient(undefined)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
