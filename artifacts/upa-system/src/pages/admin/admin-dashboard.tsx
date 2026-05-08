import { useState } from "react";
import { AdminLayout } from "./layout";
import { useListStaff, useListPatients, useGetPatientsSummary } from "@workspace/api-client-react";
import { useFeatures } from "@/lib/features-context";
import { FEATURE_LABELS } from "@/lib/features";
import type { FeatureKey } from "@/lib/features";
import { PERFIL_LABELS, PERFIS } from "@/lib/permissions";
import type { Perfil } from "@/lib/permissions";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users, BedDouble, Activity, CheckCircle2, XCircle, ShieldCheck,
  SlidersHorizontal, ArrowRight, ClipboardList, Trash2, AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PERFIL_COLOR: Record<Perfil, string> = {
  recepcionista:           "text-pink-400    bg-pink-500/10    border-pink-500/30",
  enfermeiro:              "text-cyan-400    bg-cyan-500/10    border-cyan-500/30",
  tecnico_enfermagem:      "text-blue-400    bg-blue-500/10    border-blue-500/30",
  medico:                  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  assistente_social:       "text-purple-400  bg-purple-500/10  border-purple-500/30",
  nutricionista:           "text-lime-400    bg-lime-500/10    border-lime-500/30",
  farmaceutico:            "text-amber-400   bg-amber-500/10   border-amber-500/30",
  laboratorio:             "text-teal-400    bg-teal-500/10    border-teal-500/30",
  administrador:           "text-yellow-400  bg-yellow-500/10  border-yellow-500/30",
  auxiliar_administrativo: "text-slate-400   bg-slate-500/10   border-slate-500/30",
  diretoria_geral:         "text-rose-400    bg-rose-500/10    border-rose-500/30",
};

const TRIAGE_STRIP = [
  { key: "red",    label: "Vermelho",  cls: "bg-red-500"    },
  { key: "orange", label: "Laranja",   cls: "bg-orange-500" },
  { key: "yellow", label: "Amarelo",   cls: "bg-yellow-400" },
  { key: "green",  label: "Verde",     cls: "bg-green-500"  },
  { key: "blue",   label: "Azul",      cls: "bg-blue-500"   },
] as const;

function getStaffId(): string {
  try {
    const raw = localStorage.getItem("upa_auth_user");
    if (!raw) return "0";
    const user = JSON.parse(raw) as { id?: number };
    return String(user.id ?? 0);
  } catch { return "0"; }
}

function ClearPatientsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ deleted: number } | null>(null);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  function handleClose() {
    if (loading) return;
    setConfirm("");
    setResult(null);
    setError("");
    onOpenChange(false);
  }

  async function handleDelete() {
    if (confirm !== "CONFIRMAR") return;
    setLoading(true);
    setError("");
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const resp = await fetch(`${base}/api/patients/all`, {
        method: "DELETE",
        headers: { "x-staff-id": getStaffId() },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao apagar pacientes");
      }
      const data = await resp.json() as { deleted: number };
      setResult(data);
      await qc.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Apagar Todos os Pacientes
          </DialogTitle>
          <DialogDescription>
            Esta ação é <strong>irreversível</strong>. Todos os pacientes, prontuários, evoluções,
            prescrições, sinais vitais e demais registros serão permanentemente excluídos do banco de dados.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1" />
              <strong>{result.deleted}</strong> paciente(s) excluído(s) com sucesso.
              <br />
              <span className="text-xs text-muted-foreground">Todos os registros relacionados foram removidos.</span>
            </div>
            <Button className="w-full" onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              Para confirmar, digite <strong>CONFIRMAR</strong> no campo abaixo.
            </div>
            <Input
              placeholder="Digite CONFIRMAR para prosseguir"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={cn(confirm === "CONFIRMAR" ? "border-destructive" : "")}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={confirm !== "CONFIRMAR" || loading}
                onClick={handleDelete}
              >
                {loading
                  ? <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />}
                Apagar Tudo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboardPage() {
  const { data: staff,    isLoading: loadingStaff    } = useListStaff();
  const { data: patients, isLoading: loadingPatients } = useListPatients();
  const { data: summary,  isLoading: loadingSummary  } = useGetPatientsSummary();
  const { features } = useFeatures();
  const [clearOpen, setClearOpen] = useState(false);

  const totalStaff    = staff?.length ?? 0;
  const activeStaff   = staff?.filter(s => s.active).length ?? 0;
  const totalPatients = patients?.length ?? 0;

  const byPerfil = PERFIS.map(p => ({
    perfil: p,
    count: (staff ?? []).filter(s => s.role === p).length,
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
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <BedDouble className="h-3.5 w-3.5" /> Pacientes ativos
            </div>
            {loadingPatients
              ? <Skeleton className="h-7 w-12" />
              : <p className="text-2xl font-bold">{totalPatients}</p>}
          </div>

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

          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Funcionalidades
            </div>
            <p className="text-2xl font-bold">{activeFeatures}<span className="text-sm text-muted-foreground font-normal">/{featureList.length}</span></p>
            <p className="text-xs text-muted-foreground">ativas</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/admin/usuarios",     icon: Users,         label: "Gerenciar Usuários",   desc: "Criar, editar e desativar funcionários"  },
            { href: "/admin/permissoes",   icon: ShieldCheck,   label: "Permissões por Cargo", desc: "Ver o que cada perfil pode acessar"      },
            { href: "/admin/auditoria",    icon: ClipboardList, label: "Log de Auditoria",     desc: "Histórico completo de ações no sistema" },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link key={href} href={href}>
              <div className="rounded-lg border border-border bg-card p-4 hover:bg-muted/20 transition-colors cursor-pointer group">
                <div className="flex items-start justify-between">
                  <Icon className="h-5 w-5 text-primary mb-2" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
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

        {/* Danger zone */}
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Zona de Perigo</h2>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/20 bg-card px-4 py-3">
            <div>
              <p className="text-sm font-medium">Apagar todos os pacientes</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Remove permanentemente todos os pacientes e seus prontuários do sistema.
                Útil para limpar dados de teste antes de entrar em produção real.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar
            </Button>
          </div>
        </div>
      </div>

      <ClearPatientsDialog open={clearOpen} onOpenChange={setClearOpen} />
    </AdminLayout>
  );
}
