import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListPatients, useGetPatientsSummary } from "@workspace/api-client-react";
import { Activity, HeartPulse, UserPlus, Users, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PatientForm } from "@/components/patient-form";

const TRIAGE_CONFIG = {
  red:    { label: "Vermelho",    sublabel: "Emergência",      bg: "bg-triage-red",    text: "text-triage-red",    border: "border-triage-red/40",    dot: "bg-triage-red" },
  orange: { label: "Laranja",     sublabel: "Muito Urgente",   bg: "bg-triage-orange", text: "text-triage-orange", border: "border-triage-orange/40", dot: "bg-triage-orange" },
  yellow: { label: "Amarelo",     sublabel: "Urgente",         bg: "bg-triage-yellow", text: "text-triage-yellow", border: "border-triage-yellow/40", dot: "bg-triage-yellow" },
  green:  { label: "Verde",       sublabel: "Pouco Urgente",   bg: "bg-triage-green",  text: "text-triage-green",  border: "border-triage-green/40",  dot: "bg-triage-green" },
  blue:   { label: "Azul",        sublabel: "Não Urgente",     bg: "bg-triage-blue",   text: "text-triage-blue",   border: "border-triage-blue/40",   dot: "bg-triage-blue" },
} as const;

type TriageKey = keyof typeof TRIAGE_CONFIG;

const SECTOR_FILTERS = [
  "Todos",
  "Sala Vermelha",
  "Sala Amarela Adulto",
  "Sala Amarela Pediátrica",
  "Observação Masculina",
  "Observação Feminina",
  "Medicação",
];

function TriageBadge({ status }: { status: string }) {
  const cfg = TRIAGE_CONFIG[status as TriageKey];
  if (!cfg) return <Badge variant="outline">{status}</Badge>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} text-triage-${status as TriageKey}-foreground`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current opacity-80`} />
      {cfg.label}
    </span>
  );
}

export default function Dashboard() {
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Todos");
  const [triageFilter, setTriageFilter] = useState("all");

  const { data: patients, isLoading: isLoadingPatients } = useListPatients();
  const { data: summary, isLoading: isLoadingSummary } = useGetPatientsSummary();

  const filtered = useMemo(() => {
    if (!patients) return [];
    return patients.filter(p => {
      const q = search.toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.bed.toLowerCase().includes(q);
      const matchesSector = sectorFilter === "Todos" || p.sector === sectorFilter;
      const matchesTriage = triageFilter === "all" || p.status === triageFilter;
      return matchesSearch && matchesSector && matchesTriage;
    });
  }, [patients, search, sectorFilter, triageFilter]);

  const summaryCards = [
    { key: "total", label: "Total", value: summary?.total, color: "text-foreground", borderClass: "border-border/50", icon: <Users className="h-4 w-4 text-muted-foreground" /> },
    { key: "red",    label: "Vermelho",  value: summary?.red,    color: "text-triage-red",    borderClass: "border-triage-red/40",    icon: <span className="w-3 h-3 rounded-full bg-triage-red" /> },
    { key: "orange", label: "Laranja",   value: summary?.orange, color: "text-triage-orange", borderClass: "border-triage-orange/40", icon: <span className="w-3 h-3 rounded-full bg-triage-orange" /> },
    { key: "yellow", label: "Amarelo",   value: summary?.yellow, color: "text-triage-yellow", borderClass: "border-triage-yellow/40", icon: <span className="w-3 h-3 rounded-full bg-triage-yellow" /> },
    { key: "green",  label: "Verde",     value: summary?.green,  color: "text-triage-green",  borderClass: "border-triage-green/40",  icon: <span className="w-3 h-3 rounded-full bg-triage-green" /> },
    { key: "blue",   label: "Azul",      value: summary?.blue,   color: "text-triage-blue",   borderClass: "border-triage-blue/40",   icon: <span className="w-3 h-3 rounded-full bg-triage-blue" /> },
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
            Novo Paciente
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {summaryCards.map(card => (
            <Card key={card.key} className={`${card.borderClass} cursor-pointer transition-all hover:bg-muted/20`}
              onClick={() => card.key !== "total" ? setTriageFilter(triageFilter === card.key ? "all" : card.key) : setTriageFilter("all")}
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

        {/* Search + Filter Bar */}
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
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-sector-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTOR_FILTERS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(triageFilter !== "all") && (
            <Button variant="outline" size="sm" onClick={() => setTriageFilter("all")} className="shrink-0">
              Limpar filtro
            </Button>
          )}
        </div>

        {/* Patient heading */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pacientes Ativos
            {filtered.length > 0 && <span className="ml-2 text-foreground font-bold">{filtered.length}</span>}
          </h2>
        </div>

        {/* Patient Grid */}
        {isLoadingPatients ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-border/50">
                <CardHeader className="pb-2"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader>
                <CardContent className="pb-2"><Skeleton className="h-16 w-full" /></CardContent>
                <CardFooter><Skeleton className="h-4 w-1/3" /></CardFooter>
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
                : "Clique em 'Novo Paciente' para registrar uma admissão."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(patient => {
              const cfg = TRIAGE_CONFIG[patient.status as TriageKey];
              return (
                <Link key={patient.id} href={`/patients/${patient.id}`} className="block group" data-testid={`card-patient-${patient.id}`}>
                  <Card className={`h-full transition-all hover:bg-muted/20 cursor-pointer border-l-4 ${cfg?.border ?? "border-border/50"} border-t-border/50 border-r-border/50 border-b-border/50`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                            {patient.name}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {patient.age} anos &bull; Leito {patient.bed}
                          </CardDescription>
                        </div>
                        <TriageBadge status={patient.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm text-muted-foreground truncate mb-3" title={patient.diagnosis}>
                        {patient.diagnosis}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-background/50 rounded p-2 border border-border/50">
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <HeartPulse className="h-3 w-3" /> FC
                          </div>
                          <div className="font-mono font-semibold">{patient.heartRate} <span className="text-[10px] text-muted-foreground font-normal">bpm</span></div>
                        </div>
                        <div className="bg-background/50 rounded p-2 border border-border/50">
                          <div className="text-muted-foreground mb-1">FR</div>
                          <div className="font-mono font-semibold">{patient.respiratoryRate} <span className="text-[10px] text-muted-foreground font-normal">irpm</span></div>
                        </div>
                        <div className="bg-background/50 rounded p-2 border border-border/50">
                          <div className="text-muted-foreground mb-1">Gli.</div>
                          <div className="font-mono font-semibold">{patient.glucose} <span className="text-[10px] text-muted-foreground font-normal">mg/dL</span></div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="text-xs text-muted-foreground border-t border-border/50 mt-1 pt-2 flex justify-between">
                      <span className="font-medium">{patient.sector}</span>
                      <span>Admitido: {format(new Date(patient.createdAt), "dd/MM HH:mm", { locale: ptBR })}</span>
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admitir Novo Paciente</DialogTitle>
            <DialogDescription>Preencha os dados, triagem Manchester e enfermeiro(a) responsável.</DialogDescription>
          </DialogHeader>
          <PatientForm onSuccess={() => setIsNewPatientOpen(false)} onCancel={() => setIsNewPatientOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
