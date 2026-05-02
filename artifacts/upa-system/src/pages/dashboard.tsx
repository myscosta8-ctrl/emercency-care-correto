import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { Link } from "wouter";
import {
  useListPatients,
  useGetPatientsSummary,
  useDeletePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { Activity, HeartPulse, UserPlus, Users, Search, Filter, Pencil, LogOut, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PatientForm } from "@/components/patient-form";
import { useToast } from "@/hooks/use-toast";

const TRIAGE_CONFIG = {
  red:    { label: "Vermelho",  sublabel: "Emergência",     bg: "bg-triage-red",    },
  orange: { label: "Laranja",   sublabel: "Muito Urgente",  bg: "bg-triage-orange", },
  yellow: { label: "Amarelo",   sublabel: "Urgente",        bg: "bg-triage-yellow", },
  green:  { label: "Verde",     sublabel: "Pouco Urgente",  bg: "bg-triage-green",  },
  blue:   { label: "Azul",      sublabel: "Não Urgente",    bg: "bg-triage-blue",   },
} as const;

type TriageKey = keyof typeof TRIAGE_CONFIG;

const TRIAGE_SEVERITY: Record<string, number> = {
  red: 1, orange: 2, yellow: 3, green: 4, blue: 5,
};

const SECTOR_CONFIG = [
  {
    name: "Sala Vermelha",
    emoji: "🔴",
    headerCls: "bg-red-950/60 border-red-700/50 text-red-300",
    countCls: "bg-red-700/40 text-red-200",
    emptyBorder: "border-red-900/30",
  },
  {
    name: "Observação Adulto",
    emoji: "🟡",
    headerCls: "bg-yellow-950/40 border-yellow-700/40 text-yellow-300",
    countCls: "bg-yellow-700/30 text-yellow-200",
    emptyBorder: "border-yellow-900/30",
  },
  {
    name: "Observação Pediátrica",
    emoji: "🟢",
    headerCls: "bg-green-950/40 border-green-700/40 text-green-300",
    countCls: "bg-green-700/30 text-green-200",
    emptyBorder: "border-green-900/30",
  },
  {
    name: "Observação Pré-Adulto",
    emoji: "🔵",
    headerCls: "bg-blue-950/40 border-blue-700/40 text-blue-300",
    countCls: "bg-blue-700/30 text-blue-200",
    emptyBorder: "border-blue-900/30",
  },
] as const;

const SECTOR_FILTERS = [
  "Todos",
  "Sala Vermelha",
  "Observação Adulto",
  "Observação Pediátrica",
  "Observação Pré-Adulto",
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

interface PatientCardProps {
  patient: Patient;
  onEdit: (p: Patient) => void;
  onAlta: (p: Patient) => void;
}

const PatientCard = memo(function PatientCard({ patient, onEdit, onAlta }: PatientCardProps) {
  const cfg = TRIAGE_CONFIG[patient.status as TriageKey] ?? TRIAGE_CONFIG.blue;
  const hasVitals = patient.heartRate > 0 || patient.respiratoryRate > 0 || patient.glucose > 0;

  return (
    <Card className="h-full flex flex-col overflow-hidden border-border/50">
      <Link href={`/patients/${patient.id}`} className="block">
        <div className={`${cfg.bg} px-3 py-2 flex items-center justify-between`}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white/70" />
            <span className="text-xs font-bold text-white/95 tracking-wider uppercase">
              {cfg.label} — {cfg.sublabel}
            </span>
          </div>
          <span className="text-[11px] text-white/70">
            {format(new Date(patient.createdAt), "dd/MM HH:mm", { locale: ptBR })}
          </span>
        </div>
      </Link>

      <Link href={`/patients/${patient.id}`} className="flex-1 block">
        <CardHeader className="pb-2 pt-3">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{patient.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {patient.age} anos{patient.bed ? ` • Leito ${patient.bed}` : ""}
              </CardDescription>
            </div>
            <span className="shrink-0 text-[11px] font-medium bg-muted/70 border border-border/60 px-2 py-0.5 rounded-full text-muted-foreground whitespace-nowrap">
              {patient.sector}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          {patient.diagnosis && (
            <p className="text-sm text-muted-foreground truncate mb-3" title={patient.diagnosis}>
              {patient.diagnosis}
            </p>
          )}
          {hasVitals && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-background/50 rounded p-2 border border-border/50">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <HeartPulse className="h-3 w-3" /> FC
                </div>
                <div className="font-mono font-semibold">
                  {patient.heartRate > 0
                    ? <>{patient.heartRate} <span className="text-[10px] text-muted-foreground font-normal">bpm</span></>
                    : "—"}
                </div>
              </div>
              <div className="bg-background/50 rounded p-2 border border-border/50">
                <div className="text-muted-foreground mb-1">FR</div>
                <div className="font-mono font-semibold">
                  {patient.respiratoryRate > 0
                    ? <>{patient.respiratoryRate} <span className="text-[10px] text-muted-foreground font-normal">irpm</span></>
                    : "—"}
                </div>
              </div>
              <div className="bg-background/50 rounded p-2 border border-border/50">
                <div className="text-muted-foreground mb-1">Gli.</div>
                <div className="font-mono font-semibold">
                  {patient.glucose > 0
                    ? <>{patient.glucose} <span className="text-[10px] text-muted-foreground font-normal">mg/dL</span></>
                    : "—"}
                </div>
              </div>
            </div>
          )}
          {patient.nurse && (
            <p className="text-xs text-muted-foreground mt-2 truncate">Resp.: {patient.nurse}</p>
          )}
        </CardContent>
      </Link>

      <div className="border-t border-border/50 px-3 py-2 flex items-center justify-end gap-1">
        <Button
          size="sm" variant="ghost" className="h-7 text-xs"
          onClick={() => onEdit(patient)}
        >
          <Pencil className="h-3 w-3 mr-1" /> Editar
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onAlta(patient)}
        >
          <LogOut className="h-3 w-3 mr-1" /> Alta
        </Button>
      </div>
    </Card>
  );
});

export default function Dashboard() {
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [altaPatient, setAltaPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Todos");
  const [triageFilter, setTriageFilter] = useState("all");

  const debouncedSearch = useDebounce(search, 200);

  const { data: patients, isLoading: isLoadingPatients } = useListPatients();
  const { data: summary, isLoading: isLoadingSummary } = useGetPatientsSummary();
  const deletePatient = useDeletePatient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const grouped = useMemo(() => {
    if (!patients) return null;
    const q = debouncedSearch.toLowerCase();
    const base = patients.filter(p => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.bed?.toLowerCase().includes(q) ?? false);
      const matchesSector = sectorFilter === "Todos" || p.sector === sectorFilter;
      const matchesTriage = triageFilter === "all" || p.status === triageFilter;
      return matchesSearch && matchesSector && matchesTriage;
    });
    return SECTOR_CONFIG.map(cfg => ({
      ...cfg,
      patients: base
        .filter(p => p.sector === cfg.name)
        .sort((a, b) => (TRIAGE_SEVERITY[a.status] ?? 99) - (TRIAGE_SEVERITY[b.status] ?? 99)),
    }));
  }, [patients, debouncedSearch, sectorFilter, triageFilter]);

  const totalFiltered = grouped ? grouped.reduce((n, g) => n + g.patients.length, 0) : 0;

  const handleEdit = useCallback((p: Patient) => setEditingPatient(p), []);
  const handleAlta = useCallback((p: Patient) => setAltaPatient(p), []);

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

  const summaryCards = useMemo(() => [
    { key: "total",  label: "Total",    value: summary?.total,  colorCls: "text-foreground",      dotCls: "" },
    { key: "red",    label: "Vermelho", value: summary?.red,    colorCls: "text-triage-red",    dotCls: "bg-triage-red" },
    { key: "orange", label: "Laranja",  value: summary?.orange, colorCls: "text-triage-orange", dotCls: "bg-triage-orange" },
    { key: "yellow", label: "Amarelo",  value: summary?.yellow, colorCls: "text-triage-yellow", dotCls: "bg-triage-yellow" },
    { key: "green",  label: "Verde",    value: summary?.green,  colorCls: "text-triage-green",  dotCls: "bg-triage-green" },
    { key: "blue",   label: "Azul",     value: summary?.blue,   colorCls: "text-triage-blue",   dotCls: "bg-triage-blue" },
  ], [summary]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">UPA Breves — Gestão de Pacientes</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/funcionarios">
              <Button variant="outline" className="shrink-0 gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Funcionários</span>
              </Button>
            </Link>
            <Link href="/passagem-plantao">
              <Button variant="outline" className="shrink-0 gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Passagem de Plantão</span>
              </Button>
            </Link>
            <Button onClick={() => setIsNewPatientOpen(true)} data-testid="button-new-patient" className="shrink-0">
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nova Admissão</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {summaryCards.map(card => (
            <Card
              key={card.key}
              className={`cursor-pointer border-border/50 ${triageFilter === card.key ? "ring-1 ring-primary/50 bg-muted/20" : ""}`}
              onClick={() => setTriageFilter(card.key !== "total" ? (triageFilter === card.key ? "all" : card.key) : "all")}
              data-testid={`card-summary-${card.key}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
                {card.dotCls
                  ? <span className={`w-3 h-3 rounded-full ${card.dotCls}`} />
                  : <Users className="h-4 w-4 text-muted-foreground" />
                }
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {isLoadingSummary
                  ? <Skeleton className="h-7 w-10" />
                  : <div className={`text-2xl font-bold ${card.colorCls}`}>{card.value ?? 0}</div>
                }
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou leito..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[185px]" data-testid="select-sector-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTOR_FILTERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={triageFilter} onValueChange={setTriageFilter}>
              <SelectTrigger className="w-[185px]" data-testid="select-triage-filter">
                <SelectValue placeholder="Classificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as classificações</SelectItem>
                <SelectItem value="red">Vermelho — Emergência</SelectItem>
                <SelectItem value="orange">Laranja — Muito Urgente</SelectItem>
                <SelectItem value="yellow">Amarelo — Urgente</SelectItem>
                <SelectItem value="green">Verde — Pouco Urgente</SelectItem>
                <SelectItem value="blue">Azul — Não Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pacientes Ativos
            {totalFiltered > 0 && <span className="ml-2 text-foreground font-bold">{totalFiltered}</span>}
          </h2>
          <span className="text-xs text-muted-foreground">Ordenado por gravidade</span>
        </div>

        {isLoadingPatients ? (
          <div className="space-y-6">
            {[0, 1, 2].map(si => (
              <div key={si}>
                <Skeleton className="h-10 w-full rounded-lg mb-3" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className="border-border/50 overflow-hidden">
                      <Skeleton className="h-10 w-full rounded-none" />
                      <CardHeader className="pb-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader>
                      <CardContent><Skeleton className="h-14 w-full" /></CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped!.map(sector => (
              <div key={sector.name}>
                {/* Sector header */}
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border mb-3 ${sector.headerCls}`}>
                  <span className="text-base leading-none">{sector.emoji}</span>
                  <span className="font-semibold text-sm tracking-wide">{sector.name}</span>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${sector.countCls}`}>
                    {sector.patients.length} {sector.patients.length === 1 ? "paciente" : "pacientes"}
                  </span>
                </div>

                {sector.patients.length === 0 ? (
                  <div className={`rounded-lg border border-dashed ${sector.emptyBorder} py-6 text-center text-sm text-muted-foreground`}>
                    Nenhum paciente neste setor
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sector.patients.map(patient => (
                      <PatientCard
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
              <div className="text-center py-16 bg-card rounded-lg border border-border/50">
                <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-base font-medium">Nenhum paciente encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || sectorFilter !== "Todos" || triageFilter !== "all"
                    ? "Tente ajustar os filtros de busca."
                    : "Clique em 'Nova Admissão' para registrar um paciente."}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Admissão</DialogTitle>
            <DialogDescription>Preencha os dados obrigatórios. Informações adicionais e sinais vitais são opcionais.</DialogDescription>
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
              Confirma a alta de <strong>{altaPatient?.name}</strong>? O registro será removido do sistema permanentemente.
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
