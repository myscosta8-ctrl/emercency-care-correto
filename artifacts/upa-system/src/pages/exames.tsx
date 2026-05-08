import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListExamRequests } from "@workspace/api-client-react";
import type { GlobalExamRequest } from "@workspace/api-client-react";
import {
  FlaskConical, Microscope, ImageIcon, Clock, CheckCircle2, Loader2,
  ArrowUpRight, Filter, SortAsc, ArrowLeft,
} from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── config ──────────────────────────────────────────────────────────────────

const PRIORIDADE_CFG = {
  urgente: { label: "URGENTE", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  rotina:  { label: "Rotina",  cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  eletivo: { label: "Eletivo", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
} as const;

const STATUS_CFG = {
  solicitado: { label: "Solicitado", cls: "text-yellow-400", icon: Clock },
  coletado:   { label: "Coletado",   cls: "text-sky-400",    icon: CheckCircle2 },
  laudado:    { label: "Laudado",    cls: "text-green-400",  icon: CheckCircle2 },
} as const;

const TRIAGE_DOT = {
  red:    "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  green:  "bg-green-500",
  blue:   "bg-blue-500",
} as const;

type Status   = "solicitado" | "coletado" | "laudado";
type Priority = "urgente" | "rotina" | "eletivo";
type SortKey  = "priority" | "date";
type TypeFilter = "all" | "laboratorial" | "imagem";

const PRIORITY_ORDER: Record<Priority, number> = { urgente: 0, rotina: 1, eletivo: 2 };

// ── helpers ──────────────────────────────────────────────────────────────────

function examType(req: GlobalExamRequest): TypeFilter {
  const hasLab = req.laboratoriais.length > 0;
  const hasImg = req.imagem.length > 0;
  if (hasLab && hasImg) return "all";
  if (hasLab) return "laboratorial";
  if (hasImg) return "imagem";
  return "all";
}

function allExamNames(req: GlobalExamRequest): string[] {
  return [...req.laboratoriais, ...req.imagem];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/60 px-4 py-3 flex flex-col gap-0.5">
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  active, onClick, children, className,
}: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-primary/15 text-primary border-primary/40"
          : "text-muted-foreground border-border/40 hover:border-border",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ── exam row ─────────────────────────────────────────────────────────────────

function ExamRow({ req }: { req: GlobalExamRequest }) {
  const pCfg  = PRIORIDADE_CFG[req.prioridade] ?? PRIORIDADE_CFG.rotina;
  const sCfg  = STATUS_CFG[req.status]         ?? STATUS_CFG.solicitado;
  const dot   = TRIAGE_DOT[req.patientTriageLevel as keyof typeof TRIAGE_DOT] ?? "bg-blue-500";
  const names = allExamNames(req);
  const StatusIcon = sCfg.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/5 transition-colors">
      <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", dot)} />

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] font-bold px-1.5 rounded border leading-5", pCfg.cls)}>
            {pCfg.label}
          </span>
          <p className="text-sm font-semibold truncate">{req.patientName}</p>
          {req.patientBed && (
            <span className="text-xs text-muted-foreground shrink-0">· Leito {req.patientBed}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mt-1">
          {req.laboratoriais.map(n => (
            <span key={n} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Microscope className="h-2.5 w-2.5" />{n}
            </span>
          ))}
          {req.imagem.map(n => (
            <span key={n} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <ImageIcon className="h-2.5 w-2.5" />{n}
            </span>
          ))}
          {names.length === 0 && (
            <span className="text-[10px] text-muted-foreground/60 italic">Sem exames listados</span>
          )}
        </div>

        {req.justificativa && (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{req.justificativa}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", sCfg.cls)}>
          <StatusIcon className="h-3 w-3" />
          {sCfg.label}
        </span>
        <span className="text-[10px] text-muted-foreground">{formatDate(req.createdAt)}</span>
        <Link
          href={`/patients/${req.patientId}`}
          className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
        >
          Ver paciente<ArrowUpRight className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ExamesPage() {
  const [statusFilter,   setStatusFilter]   = useState<Status | "all" | "open">("open");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [typeFilter,     setTypeFilter]     = useState<TypeFilter>("all");
  const [sortKey,        setSortKey]        = useState<SortKey>("priority");

  const statusParam = useMemo(() => {
    if (statusFilter === "open") return {};
    if (statusFilter === "all")  return { status: "all" as const };
    return { status: statusFilter as Status };
  }, [statusFilter]);

  const { data: raw, isLoading, error, refetch } = useListExamRequests(statusParam);

  const filtered = useMemo(() => {
    if (!raw) return [];
    let items = [...raw];

    if (priorityFilter !== "all") {
      items = items.filter(r => r.prioridade === priorityFilter);
    }
    if (typeFilter !== "all") {
      items = items.filter(r => {
        if (typeFilter === "laboratorial") return r.laboratoriais.length > 0;
        if (typeFilter === "imagem")       return r.imagem.length > 0;
        return true;
      });
    }

    if (sortKey === "priority") {
      items.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.prioridade as Priority] ?? 99;
        const pb = PRIORITY_ORDER[b.prioridade as Priority] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return items;
  }, [raw, priorityFilter, typeFilter, sortKey]);

  const total     = filtered.length;
  const urgentes  = filtered.filter(r => r.prioridade === "urgente").length;
  const pendentes = filtered.filter(r => r.status === "solicitado").length;
  const laudados  = filtered.filter(r => r.status === "laudado").length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <RoleHeader
        title="Pendências de Exames"
        icon={<FlaskConical className="h-5 w-5 text-primary" />}
      />

      <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl space-y-4">

        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>

        {/* ── stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Total"        value={total}     color="text-foreground" />
          <StatCard label="Urgentes"     value={urgentes}  color="text-red-400" />
          <StatCard label="Solicitados"  value={pendentes} color="text-yellow-400" />
          <StatCard label="Laudados"     value={laudados}  color="text-green-400" />
        </div>

        {/* ── filters ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground font-medium">Status:</span>
            {([
              { value: "open",       label: "Abertos" },
              { value: "solicitado", label: "Solicitado" },
              { value: "coletado",   label: "Coletado" },
              { value: "laudado",    label: "Laudado" },
              { value: "all",        label: "Todos" },
            ] as const).map(s => (
              <FilterPill key={s.value} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)}>
                {s.label}
              </FilterPill>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium ml-5">Prioridade:</span>
            {(["all", "urgente", "rotina", "eletivo"] as const).map(p => (
              <FilterPill key={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>
                {p === "all" ? "Todas" : p.charAt(0).toUpperCase() + p.slice(1)}
              </FilterPill>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium ml-5">Tipo:</span>
            {(["all", "laboratorial", "imagem"] as const).map(t => (
              <FilterPill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                {t === "all" ? "Todos" : t.charAt(0).toUpperCase() + t.slice(1)}
              </FilterPill>
            ))}
            <span className="ml-auto flex items-center gap-1">
              <SortAsc className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ordenar:</span>
              <FilterPill active={sortKey === "priority"} onClick={() => setSortKey("priority")}>Prioridade</FilterPill>
              <FilterPill active={sortKey === "date"}     onClick={() => setSortKey("date")}>Data</FilterPill>
            </span>
          </div>
        </div>

        {/* ── list ── */}
        <div className="rounded-lg border border-border/40 overflow-hidden">
          {isLoading ? (
            <div className="space-y-0 divide-y divide-border/20">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-muted/30 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-muted/30 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-muted/20 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-destructive">Erro ao carregar solicitações de exames</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <FlaskConical className="h-8 w-8 mx-auto opacity-30" />
              <p className="text-sm">Nenhuma solicitação de exame encontrada</p>
              {(statusFilter !== "open" || priorityFilter !== "all" || typeFilter !== "all") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => { setStatusFilter("open"); setPriorityFilter("all"); setTypeFilter("all"); }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {filtered.map(req => (
                <ExamRow key={req.id} req={req} />
              ))}
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {filtered.length} {filtered.length === 1 ? "solicitação" : "solicitações"} encontrada{filtered.length !== 1 ? "s" : ""}
          </p>
        )}
      </main>
    </div>
  );
}
