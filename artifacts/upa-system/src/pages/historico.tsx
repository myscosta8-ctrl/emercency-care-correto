import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import type { Patient } from "@workspace/api-client-react";
import {
  Archive, Search, User, Calendar, FileText, ChevronRight,
  Activity, Clock, Download, ArrowLeft,
} from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TRIAGE_CFG = {
  red:    { dot: "bg-red-500",    text: "text-red-400",    label: "Vermelho"  },
  orange: { dot: "bg-orange-500", text: "text-orange-400", label: "Laranja"   },
  yellow: { dot: "bg-yellow-400", text: "text-yellow-400", label: "Amarelo"   },
  green:  { dot: "bg-green-500",  text: "text-green-400",  label: "Verde"     },
  blue:   { dot: "bg-blue-500",   text: "text-blue-400",   label: "Azul"      },
} as const;

const TIPO_ALTA_CFG: Record<string, { label: string; cls: string }> = {
  "Alta com melhora clínica": { label: "Melhora clínica", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  "Transferência hospitalar":  { label: "Transferência",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  "Alta a pedido":             { label: "A pedido",        cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  "Óbito":                     { label: "Óbito",           cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  "Evasão":                    { label: "Evasão",          cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
};

function getStaffId(): string {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}

function fmt(iso: string) {
  try { return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return "—"; }
}

function diffHours(start: string, end: string): string {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(ms) || ms < 0) return "—";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  } catch { return "—"; }
}

type HistoricoPatient = Patient & { tipo_alta?: string };

function PatientCard({ patient }: { patient: HistoricoPatient }) {
  const cfg  = TRIAGE_CFG[patient.triage_level as keyof typeof TRIAGE_CFG];
  const alta = patient.careStatusChangedAt as string;
  const tipoAltaCfg = patient.tipo_alta ? TIPO_ALTA_CFG[patient.tipo_alta] : null;

  return (
    <Link href={`/patients/${patient.id}`}>
      <div className="rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors cursor-pointer">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg?.dot ?? "bg-muted-foreground")} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{patient.full_name}</p>
              {tipoAltaCfg && (
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", tipoAltaCfg.cls)}>
                  {tipoAltaCfg.label}
                </span>
              )}
              {!tipoAltaCfg && patient.tipo_alta && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-muted/20 text-muted-foreground border-border/40">
                  {patient.tipo_alta}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {patient.age} anos
              </span>
              {patient.diagnosis && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-[180px]">{patient.diagnosis}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Admissão: {format(new Date(patient.createdAt), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" /> Alta: {fmt(alta)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Permanência: {diffHours(patient.createdAt, alta)}
              </span>
            </div>
            <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground/70">
              <span>Pront. {patient.prontuarioNumber}</span>
              {patient.cpf && <span>CPF: {patient.cpf}</span>}
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    </Link>
  );
}

export default function HistoricoPage() {
  const [patients, setPatients]   = useState<HistoricoPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch]       = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/patients/historico", { headers: { "x-staff-id": getStaffId() } })
      .then(r => r.ok ? r.json() : [])
      .then((data: HistoricoPatient[]) => setPatients(data))
      .catch(() => setPatients([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter(p => {
      if (q && !(
        p.full_name.toLowerCase().includes(q) ||
        (p.cpf ?? "").includes(q) ||
        (p.diagnosis ?? "").toLowerCase().includes(q) ||
        (p.prontuarioNumber ?? "").toLowerCase().includes(q) ||
        (p.atendimentoNumber ?? "").toLowerCase().includes(q)
      )) return false;

      if (tipoFiltro && (p.tipo_alta ?? "") !== tipoFiltro) return false;

      if (dateFrom) {
        const altaDate = new Date(p.careStatusChangedAt as string);
        if (altaDate < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const altaDate = new Date(p.careStatusChangedAt as string);
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (altaDate > end) return false;
      }
      return true;
    });
  }, [patients, search, dateFrom, dateTo, tipoFiltro]);

  const handleExport = () => {
    const rows = [
      ["Prontuário", "Nome", "Idade", "Triagem", "Tipo de Alta", "Diagnóstico", "Admissão", "Alta", "Permanência"],
      ...filtered.map(p => [
        p.prontuarioNumber ?? "",
        p.full_name,
        String(p.age),
        TRIAGE_CFG[p.triage_level as keyof typeof TRIAGE_CFG]?.label ?? p.triage_level,
        p.tipo_alta ?? "",
        p.diagnosis ?? "",
        p.createdAt ? format(new Date(p.createdAt), "dd/MM/yyyy HH:mm") : "",
        p.careStatusChangedAt ? format(new Date(p.careStatusChangedAt as string), "dd/MM/yyyy HH:mm") : "",
        diffHours(p.createdAt, p.careStatusChangedAt as string),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico_pacientes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <RoleHeader title="Histórico de Pacientes" icon={<Archive className="h-5 w-5 text-primary" />} />

      <main className="flex-1 container mx-auto px-4 py-4 max-w-4xl space-y-4">

        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold">Pacientes com Alta</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Carregando..." : `${patients.length} paciente${patients.length !== 1 ? "s" : ""} no arquivo`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nome, CPF, diagnóstico, nº prontuário ou nº registro..."
              className="pl-9 text-sm"
            />
          </div>
          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos os tipos de alta</option>
            {Object.keys(TIPO_ALTA_CFG).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <span>Alta de</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span>até</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-lg bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Archive className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm font-medium">
              {patients.length === 0
                ? "Nenhum paciente com alta registrado ainda"
                : "Nenhum resultado para os filtros aplicados"}
            </p>
            {patients.length === 0 && (
              <p className="text-xs mt-1 opacity-70">
                Os pacientes aparecem aqui automaticamente após receberem alta.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Exibindo {filtered.length} de {patients.length} pacientes
            </p>
            <div className="space-y-2">
              {filtered.map(p => (
                <PatientCard key={p.id} patient={p} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
