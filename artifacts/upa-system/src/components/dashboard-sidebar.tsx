import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/use-auth";
import { useCriticalAlerts } from "@/hooks/use-critical-alerts";
import { PERFIL_LABELS } from "@/lib/permissions";
import type { Perfil } from "@/lib/permissions";
import {
  Zap, BedDouble, Stethoscope, FlaskConical, Microscope,
  ClipboardList, BarChart3, Target, Settings2,
  Users, History, AlertTriangle, Package,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  show: boolean;
}

function PrimaryLink({ href, icon, label, active }: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-md mb-1 cursor-pointer transition-all text-sm font-semibold",
        active
          ? "bg-primary/12 text-primary shadow-sm border border-primary/20"
          : "text-foreground/80 hover:text-foreground hover:bg-muted/50",
      )}>
        <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
        <span className="truncate">{label}</span>
        {active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
        )}
      </div>
    </Link>
  );
}

function SecondaryLink({ href, icon, label, active }: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md mb-0.5 cursor-pointer transition-colors text-xs",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
      )}>
        <span className="shrink-0 opacity-70">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
    </Link>
  );
}

export function DashboardSidebar() {
  const [location] = useLocation();
  const { pode, activeUser } = useAuth();
  const { criticals } = useCriticalAlerts({ alertsEnabled: false });

  const role = activeUser?.role ?? "";
  const roleLabel = PERFIL_LABELS[role as Perfil] ?? role;

  const ROLE_COLORS: Record<string, string> = {
    recepcionista:      "bg-sky-100 text-sky-700 border-sky-200",
    tecnico_enfermagem: "bg-teal-100 text-teal-700 border-teal-200",
    enfermeiro:         "bg-cyan-100 text-cyan-700 border-cyan-200",
    medico:             "bg-purple-100 text-purple-700 border-purple-200",
    assistente_social:  "bg-orange-100 text-orange-700 border-orange-200",
    nutricionista:      "bg-green-100 text-green-700 border-green-200",
    farmaceutico:       "bg-yellow-100 text-yellow-700 border-yellow-200",
    administrador:      "bg-red-100 text-red-700 border-red-200",
    diretoria_geral:    "bg-rose-100 text-rose-700 border-rose-200",
  };
  const roleColor = ROLE_COLORS[role] ?? "bg-muted text-muted-foreground border-border";

  const primaryItems: NavItem[] = [
    {
      href: "/",
      icon: <Zap className="h-4 w-4" />,
      label: "Fluxo Rápido",
      show: true,
    },
    {
      href: "/observacao",
      icon: <BedDouble className="h-4 w-4" />,
      label: "Leitos & Observação",
      show: true,
    },
  ];

  const secondaryItems: NavItem[] = [
    {
      href: "/fila-medico",
      icon: <Stethoscope className="h-3.5 w-3.5" />,
      label: "Fila Médica",
      show: true,
    },
    {
      href: "/laboratorio",
      icon: <FlaskConical className="h-3.5 w-3.5" />,
      label: "Laboratório",
      show: pode("registrar_exames"),
    },
    {
      href: "/exames",
      icon: <Microscope className="h-3.5 w-3.5" />,
      label: "Pendências de Exames",
      show: pode("registrar_exames"),
    },
    {
      href: "/leitos",
      icon: <BedDouble className="h-3.5 w-3.5" />,
      label: "Gestão de Leitos",
      show: true,
    },
    {
      href: "/historico",
      icon: <History className="h-3.5 w-3.5" />,
      label: "Histórico de Altas",
      show: true,
    },
    {
      href: "/farmacia/estoque",
      icon: <Package className="h-3.5 w-3.5" />,
      label: "Estoque Farmácia",
      show: pode("registrar_farmacia"),
    },
    {
      href: "/passagem-plantao",
      icon: <ClipboardList className="h-3.5 w-3.5" />,
      label: "Passagem de Plantão",
      show: pode("registrar_evolucao"),
    },
    {
      href: "/tempos-metas",
      icon: <Target className="h-3.5 w-3.5" />,
      label: "Tempos & Metas",
      show: pode("visualizar_relatorios"),
    },
    {
      href: "/relatorios",
      icon: <BarChart3 className="h-3.5 w-3.5" />,
      label: "Relatórios",
      show: pode("visualizar_relatorios"),
    },
    {
      href: "/funcionarios",
      icon: <Users className="h-3.5 w-3.5" />,
      label: "Funcionários",
      show: pode("gerenciar_usuarios"),
    },
    {
      href: "/admin/dashboard",
      icon: <Settings2 className="h-3.5 w-3.5" />,
      label: "Administração",
      show: activeUser?.role === "administrador" || activeUser?.role === "diretoria_geral",
    },
  ];

  const visibleSecondary = secondaryItems.filter(i => i.show);

  return (
    <aside className="w-52 min-h-screen bg-card border-r border-border flex-col shrink-0 hidden lg:flex sticky top-0 h-screen overflow-y-auto">

      {/* ── User card — pinned, highlighted ──────────────────────────── */}
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <span className="text-xs font-black text-primary">
              {activeUser?.name?.charAt(0).toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground truncate leading-tight">
              {activeUser?.name ?? "Usuário"}
            </div>
            <span className={cn(
              "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none mt-0.5",
              roleColor,
            )}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── Critical patients panel ───────────────────────────────────── */}
      {criticals.length > 0 && (
        <div className="mx-2 mt-3 rounded-lg border border-red-200 bg-red-50 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-100/80 border-b border-red-200">
            <AlertTriangle className="h-3 w-3 text-red-600 shrink-0 animate-pulse" />
            <span className="text-[10px] font-black text-red-700 uppercase tracking-wider flex-1">
              Críticos
            </span>
            <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
              {criticals.length}
            </span>
          </div>
          <div className="py-1">
            {criticals.slice(0, 4).map(alert => (
              <Link key={alert.patientId} href={`/patients/${alert.patientId}`}>
                <div className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-100/60 transition-colors cursor-pointer">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-red-700 truncate leading-tight">
                      {alert.full_name.split(" ").slice(0, 2).join(" ")}
                    </div>
                    {alert.bed && (
                      <div className="text-[9px] text-red-500 leading-tight">Leito {alert.bed}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {criticals.length > 4 && (
              <div className="px-2.5 py-1 text-[9px] text-red-500 text-center">
                +{criticals.length - 4} mais
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Primary navigation ────────────────────────────────────────── */}
      <div className="p-2 pt-3">
        <p className="text-[9px] uppercase font-black text-muted-foreground/50 tracking-widest mb-1.5 px-3">
          Principais
        </p>
        {primaryItems
          .filter(i => i.show)
          .map(item => (
            <PrimaryLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={location === item.href}
            />
          ))}
      </div>

      {/* ── Secondary navigation ─────────────────────────────────────── */}
      {visibleSecondary.length > 0 && (
        <div className="p-2 border-t border-border/50 mt-1">
          <p className="text-[9px] uppercase font-black text-muted-foreground/50 tracking-widest mb-1.5 px-3">
            Navegação
          </p>
          {visibleSecondary.map(item => (
            <SecondaryLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={location === item.href}
            />
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Version badge */}
      <div className="p-3 border-t border-border/40">
        <p className="text-[9px] text-muted-foreground/40 text-center">UPA Breves · SEMSA</p>
      </div>
    </aside>
  );
}

export function MobileSectorTabs({ current }: { current: "fluxo" | "leitos" }) {
  return (
    <div className="flex lg:hidden border-b border-border bg-card px-3 gap-1 py-1.5">
      <Link href="/">
        <button className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
          current === "fluxo"
            ? "bg-primary/15 text-primary font-semibold"
            : "text-muted-foreground hover:bg-muted/30",
        )}>
          <Zap className="h-3 w-3" />
          Fluxo Rápido
        </button>
      </Link>
      <Link href="/observacao">
        <button className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
          current === "leitos"
            ? "bg-primary/15 text-primary font-semibold"
            : "text-muted-foreground hover:bg-muted/30",
        )}>
          <BedDouble className="h-3 w-3" />
          Leitos & Obs.
        </button>
      </Link>
    </div>
  );
}
