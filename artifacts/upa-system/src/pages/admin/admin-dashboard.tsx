import { AdminLayout } from "./layout";
import { useListStaff, useListPatients, useGetPatientsSummary } from "@workspace/api-client-react";
import { useFeatures } from "@/lib/features-context";
import { FEATURE_LABELS } from "@/lib/features";
import type { FeatureKey } from "@/lib/features";
import { PERFIL_LABELS, PERFIS } from "@/lib/permissions";
import type { Perfil } from "@/lib/permissions";
import { Users, BedDouble, Activity, CheckCircle2, XCircle, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PERFIL_COLOR: Record<Perfil, string> = {
  direcao:        "text-yellow-400  bg-yellow-500/10  border-yellow-500/30",
  administrativo: "text-slate-400   bg-slate-500/10   border-slate-500/30",
  coordenacao:    "text-orange-400  bg-orange-500/10  border-orange-500/30",
  enfermeiro:     "text-cyan-400    bg-cyan-500/10    border-cyan-500/30",
  tecnico:        "text-blue-400    bg-blue-500/10    border-blue-500/30",
};

const TRIAGE_STRIP = [
  { key: "red",    label: "Vermelho",  cls: "bg-red-500"    },
  { key: "orange", label: "Laranja",   cls: "bg-orange-500" },
  { key: "yellow", label: "Amarelo",   cls: "bg-yellow-400" },
  { key: "green",  label: "Verde",     cls: "bg-green-500"  },
  { key: "blue",   label: "Azul",      cls: "bg-blue-500"   },
] as const;

export default function AdminDashboardPage() {
  const { data: staff,   isLoading: loadingStaff   } = useListStaff();
  const { data: patients, isLoading: loadingPatients } = useListPatients();
  const { data: summary, isLoading: loadingSummary  } = useGetPatientsSummary();
  const { features } = useFeatures();

  const totalStaff    = staff?.length ?? 0;
  const activeStaff   = staff?.filter(s => s.ativo).length ?? 0;
  const totalPatients = patients?.length ?? 0;

  const byPerfil = PERFIS.map(p => ({
    perfil: p,
    count: (staff ?? []).filter(s => s.perfil === p).length,
  }));

  const featureList = Object.entries(features) as [FeatureKey, boolean][];
  const activeFeatures = featureList.filter(([, v]) => v).length;

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Visão Geral do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resumo em tempo real do estado da UPA Breves</p>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Pacientes ativos */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <BedDouble className="h-3.5 w-3.5" /> Pacientes ativos
            </div>
            {loadingPatients
              ? <Skeleton className="h-7 w-12" />
              : <p className="text-2xl font-bold">{totalPatients}</p>}
          </div>

          {/* Funcionários */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Users className="h-3.5 w-3.5" /> Funcionários
            </div>
            {loadingStaff
              ? <Skeleton className="h-7 w-12" />
              : <>
                  <p className="text-2xl font-bold">{totalStaff}</p>
                  <p className="text-xs text-muted-foreground">{activeStaff} ativos</p>
                </>}
          </div>

          {/* Triage sumário */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Activity className="h-3.5 w-3.5" /> Por triagem
            </div>
            {loadingSummary
              ? <Skeleton className="h-7 w-full" />
              : <div className="flex gap-1 flex-wrap">
                  {TRIAGE_STRIP.map(t => {
                    const val = summary?.[t.key as keyof typeof summary] as number ?? 0;
                    return (
                      <span key={t.key} className={cn(
                        "text-[11px] font-bold px-1.5 py-0.5 rounded text-white",
                        t.cls
                      )}>{val}</span>
                    );
                  })}
                </div>}
          </div>

          {/* Feature flags */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Funcionalidades
            </div>
            <p className="text-2xl font-bold">{activeFeatures}<span className="text-sm text-muted-foreground font-normal">/{featureList.length}</span></p>
            <p className="text-xs text-muted-foreground">ativas</p>
          </div>
        </div>

        {/* Staff by perfil */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Funcionários por Perfil</h2>
          </div>
          {loadingStaff
            ? <div className="space-y-2">{Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            : <div className="space-y-1.5">
                {byPerfil.map(({ perfil, count }) => (
                  <div key={perfil} className="flex items-center gap-3">
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded border w-32 text-center shrink-0",
                      PERFIL_COLOR[perfil]
                    )}>
                      {PERFIL_LABELS[perfil]}
                    </span>
                    <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-primary/60 transition-all"
                        style={{ width: totalStaff > 0 ? `${(count / totalStaff) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-sm font-mono w-6 text-right text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>}
        </div>

        {/* Feature flags status */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Estado das Funcionalidades</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {featureList.map(([key, ativo]) => (
              <div key={key} className="flex items-center gap-2.5 rounded-md border border-border/50 px-3 py-2 bg-muted/10">
                {ativo
                  ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  : <XCircle     className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className={cn("text-sm", ativo ? "text-foreground" : "text-muted-foreground")}>
                  {FEATURE_LABELS[key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
