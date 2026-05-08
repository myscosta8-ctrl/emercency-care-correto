import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListPatients } from "@workspace/api-client-react";
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

function fmt(iso: string) {
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function fmtDate(iso: string) {
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function diffHours(start: string, end: string): string {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 0) return "—";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h === 0) return `${m}min`;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  } catch {
    return "—";
  }
}

interface PatientCardProps {
  patient: Patient;
}

function PatientCard({ patient }: PatientCardProps) {
  const tc = TRIAGE_CFG[patient.triage_level as keyof typeof TRIAGE_CFG] ?? TRIAGE_CFG.blue;
  const admissao = patient.createdAt;
  const alta = patient.careStatusChangedAt as string;
  const permanencia = diffHours(admissao, alta);

  return (
    <Link href={`/patients/${patient.id}`}>
      <div className="rounded-lg border border-border/40 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", tc.dot)} />

          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{patient.full_name}</span>
              <span className="text-xs text-muted-foreground">{patient.age}a</span>
              <span className={cn("text-[10px] font-bold px-1.5 rounded border leading-5 shrink-0", tc.text, "bg-muted/20 border-border/30")}>
                {tc.label}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              {patient.prontuarioNumber && (
                <span className="font-mono">{patient.prontuarioNumber}</span>
              )}
              {patient.diagnosis && (
                <span className="truncate max-w-[240px]">{patient.diagnosis}</span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground/70">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Entrada: {fmtDate(admissao)}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-green-400" />
                Alta: {fmt(alta)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Permanência: {permanencia}
              </span>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    </Link>
  );
}

export default function HistoricoPage() {
  const { data: patients, isLoading } = useListPatients();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]   = useState("");

  const discharged = useMemo(() => {
    const alta = (patients ?? []).filter(p => p.careStatus === "Alta");
    return alta.sort((a, b) =>
      new Date(b.careStatusChangedAt as string).getTime() -
      new Date(a.careStatusChangedAt as string).getTime()
    );
  }, [patients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return discharged.filter(p => {
      if (q && !(
        p.full_name.toLowerCase().includes(q) ||
        (p.cpf ?? "").includes(q) ||
        (p.diagnosis ?? "").toLowerCase().includes(q) ||
        (p.prontuarioNumber ?? "").toLowerCase().includes(q) ||
        (p.atendimentoNumber ?? "").toLowerCase().includes(q)
      )) return false;

      if (dateFrom) {
        const alta = new Date(p.careStatusChangedAt as string);
        if (alta < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const alta = new Date(p.careStatusChangedAt as string);
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (alta > end) return false;
      }
      return true;
    });
  }, [discharged, search, dateFrom, dateTo]);

  const handleExport = () => {
    const rows = [
      ["Prontuário", "Nome", "Idade", "Triagem", "Diagnóstico", "Admissão", "Alta", "Permanência"],
      ...filtered.map(p => [
        p.prontuarioNumber ?? "",
        p.full_name,
        String(p.age),
        TRIAGE_CFG[p.triage_level as keyof typeof TRIAGE_CFG]?.label ?? p.triage_level,
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

        {/* cabeçalho */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold">Pacientes com Alta</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Carregando..." : `${discharged.length} paciente${discharged.length !== 1 ? "s" : ""} no arquivo`}
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

        {/* filtros */}
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
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
        </div>

        {/* resultados */}
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
              {discharged.length === 0
                ? "Nenhum paciente com alta registrado ainda"
                : "Nenhum resultado para os filtros aplicados"}
            </p>
            {discharged.length === 0 && (
              <p className="text-xs mt-1 opacity-70">
                Os pacientes aparecem aqui automaticamente após receberem alta.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Exibindo {filtered.length} de {discharged.length} pacientes
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
