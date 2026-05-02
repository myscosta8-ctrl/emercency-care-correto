import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useListPatients,
  useGetPatientsSummary,
  useDeletePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react/src/generated/api.schemas";
import { Activity, HeartPulse, UserPlus, Users, Search, Filter, Pencil, LogOut } from "lucide-react";
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
  red:    { label: "Vermelho",  sublabel: "Emergência",     bg: "bg-triage-red",    text: "text-triage-red",    border: "border-triage-red/40" },
  orange: { label: "Laranja",   sublabel: "Muito Urgente",  bg: "bg-triage-orange", text: "text-triage-orange", border: "border-triage-orange/40" },
  yellow: { label: "Amarelo",   sublabel: "Urgente",        bg: "bg-triage-yellow", text: "text-triage-yellow", border: "border-triage-yellow/40" },
  green:  { label: "Verde",     sublabel: "Pouco Urgente",  bg: "bg-triage-green",  text: "text-triage-green",  border: "border-triage-green/40" },
  blue:   { label: "Azul",      sublabel: "Não Urgente",    bg: "bg-triage-blue",   text: "text-triage-blue",   border: "border-triage-blue/40" },
} as const;

type TriageKey = keyof typeof TRIAGE_CONFIG;

const TRIAGE_SEVERITY: Record<string, number> = {
  red: 1, orange: 2, yellow: 3, green: 4, blue: 5,
};

const SECTOR_FILTERS = [
  "Todos",
  "Sala Vermelha",
  "Sala Amarela Adulto",
  "Sala Amarela Pediátrica",
  "Observação Masculina",
  "Observação Feminina",
  "Medicação",
];

export default function Dashboard() {
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [altaPatient, setAltaPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Todos");
  const [triageFilter, setTriageFilter] = useState("all");

  const { data: patients, isLoading: isLoadingPatients } = useListPatients();
  const { data: summary, isLoading: isLoadingSummary } = useGetPatientsSummary();
  const deletePatient = useDeletePatient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!patients) return [];
    return patients
      .filter(p => {
        const q = search.toLowerCase();
        const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.bed?.toLowerCase().includes(q) ?? false);
        const matchesSector = sectorFilter === "Todos" || p.sector === sectorFilter;
        const matchesTriage = triageFilter === "all" || p.status === triageFilter;
        return matchesSearch && matchesSector && matchesTriage;
      })
      .sort((a, b) => (TRIAGE_SEVERITY[a.status] ?? 99) - (TRIAGE_SEVERITY[b.status] ?? 99));
  }, [patients, search, sectorFilter, triageFilter]);

  const handleAlta = () => {
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

  const summaryCards = [
    { key: "total",  label: "Total",    value: summary?.total,  color: "text-foreground",     borderClass: "border-border/50",          icon: <Users className="h-4 w-4 text-muted-foreground" /> },
    { key: "red",    label: "Vermelho", value: summary?.red,    color: "text-triage-red",    borderClass: "border-triage-red/40",    icon: <span className="w-3 h-3 rounded-full bg-triage-red" /> },
    { key: "orange", label: "Laranja",  value: summary?.orange, color: "text-triage-orange", borderClass: "border-triage-orange/40", icon: <span className="w-3 h-3 rounded-full bg-triage-orange" /> },
    { key: "yellow", label: "Amarelo",  value: summary?.yellow, color: "text-triage-yellow", borderClass: "border-triage-yellow/40", icon: <span className="w-3 h-3 rounded-full bg-triage-yellow" /> },
    { key: "green",  label: "Verde",    value: summary?.green,  color: "text-triage-green",  borderClass: "border-triage-green/40",  icon: <span className="w-3 h-3 rounded-full bg-triage-green" /> },
    { key: "blue",   label: "Azul",     value: summary?.blue,   color: "text-triage-blue",   borderClass: "border-triage-blue/40",   icon: <span className="w-3 h-3 rounded-full bg-triage-blue" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">UPA Breves — Gestão de Pacientes</h1>
          </div>
          <Button onClick={() => setIsNewPatientOpen(true)} data-testid="button-new-patient">
            <UserPlus className="mr-2 h-4 w-4" />
            Nova Admissão
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {summaryCards.map(card => (
            <Card
              key={card.key}
              className={`${card.borderClass} cursor-pointer transition-all hover:bg-muted/20 ${triageFilter === card.key ? "ring-1 ring-primary/50 bg-muted/20" : ""}`}
              onClick={() => setTriageFilter(card.key !== "total" ? (triageFilter === card.key ? "all" : card.key) : "all")}
              data-testid={`card-summary-${card.key}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
                {card.icon}
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {isLoadingSummary
                  ? <Skeleton className="h-7 w-10" />
                  : <div className={`text-2xl font-bold ${card.color}`}>{card.value ?? 0}</div>
                }
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter Bar */}
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

        {/* Heading */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pacientes Ativos
            {filtered.length > 0 && <span className="ml-2 text-foreground font-bold">{filtered.length}</span>}
          </h2>
          <span className="text-xs text-muted-foreground">Ordenado por gravidade</span>
        </div>

        {/* Patient Grid */}
        {isLoadingPatients ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-border/50 overflow-hidden">
                <Skeleton className="h-10 w-full rounded-none" />
                <CardHeader className="pb-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader>
                <CardContent><Skeleton className="h-14 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border border-border/50">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-base font-medium">Nenhum paciente encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search || sectorFilter !== "Todos" || triageFilter !== "all"
                ? "Tente ajustar os filtros de busca."
                : "Clique em 'Nova Admissão' para registrar um paciente."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(patient => {
              const cfg = TRIAGE_CONFIG[patient.status as TriageKey] ?? TRIAGE_CONFIG.blue;
              const hasVitals = patient.heartRate > 0 || patient.respiratoryRate > 0 || patient.glucose > 0;
              return (
                <div key={patient.id} data-testid={`card-patient-${patient.id}`}>
                  <Card className="h-full flex flex-col overflow-hidden border-border/50 transition-all hover:shadow-lg hover:shadow-black/20">

                    {/* Triage Classification Band — prominent at top */}
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

                    {/* Card Body — clickable, navigates to detail */}
                    <Link href={`/patients/${patient.id}`} className="flex-1 block hover:bg-muted/10 transition-colors">
                      <CardHeader className="pb-2 pt-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate">{patient.name}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                              {patient.age} anos{patient.bed ? ` • Leito ${patient.bed}` : ""}
                            </CardDescription>
                          </div>
                          {/* Sector badge — highlighted */}
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
                                {patient.heartRate > 0 ? <>{patient.heartRate} <span className="text-[10px] text-muted-foreground font-normal">bpm</span></> : "—"}
                              </div>
                            </div>
                            <div className="bg-background/50 rounded p-2 border border-border/50">
                              <div className="text-muted-foreground mb-1">FR</div>
                              <div className="font-mono font-semibold">
                                {patient.respiratoryRate > 0 ? <>{patient.respiratoryRate} <span className="text-[10px] text-muted-foreground font-normal">irpm</span></> : "—"}
                              </div>
                            </div>
                            <div className="bg-background/50 rounded p-2 border border-border/50">
                              <div className="text-muted-foreground mb-1">Gli.</div>
                              <div className="font-mono font-semibold">
                                {patient.glucose > 0 ? <>{patient.glucose} <span className="text-[10px] text-muted-foreground font-normal">mg/dL</span></> : "—"}
                              </div>
                            </div>
                          </div>
                        )}
                        {patient.nurse && (
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            Resp.: {patient.nurse}
                          </p>
                        )}
                      </CardContent>
                    </Link>

                    {/* Action row — outside Link, no navigation */}
                    <div className="border-t border-border/50 px-3 py-2 flex items-center justify-end gap-1">
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => setEditingPatient(patient)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setAltaPatient(patient)}
                      >
                        <LogOut className="h-3 w-3 mr-1" /> Alta
                      </Button>
                    </div>

                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Nova Admissão Dialog */}
      <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Admissão</DialogTitle>
            <DialogDescription>Preencha os dados obrigatórios. Informações adicionais e sinais vitais são opcionais.</DialogDescription>
          </DialogHeader>
          <PatientForm onSuccess={() => setIsNewPatientOpen(false)} onCancel={() => setIsNewPatientOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Editar Paciente Dialog */}
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

      {/* Alta AlertDialog */}
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
              onClick={e => { e.preventDefault(); handleAlta(); }}
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
