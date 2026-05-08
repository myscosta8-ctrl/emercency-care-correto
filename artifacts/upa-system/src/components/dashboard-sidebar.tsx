import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/use-auth";
import {
  Zap, BedDouble, Stethoscope, FlaskConical, Microscope,
  BookOpen, ClipboardList, BarChart3, Target, Settings2,
  Users, History,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  show: boolean;
}

function SidebarLink({ href, icon, label, active }: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md mb-0.5 cursor-pointer transition-colors text-sm",
        active
          ? "bg-primary/15 text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
      )}>
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
    </Link>
  );
}

export function DashboardSidebar() {
  const [location] = useLocation();
  const { pode, activeUser } = useAuth();

  const sectorItems: NavItem[] = [
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

  const featureItems: NavItem[] = [
    {
      href: "/fila-medico",
      icon: <Stethoscope className="h-4 w-4" />,
      label: "Fila Médica",
      show: true,
    },
    {
      href: "/laboratorio",
      icon: <FlaskConical className="h-4 w-4" />,
      label: "Laboratório",
      show: pode("registrar_exames"),
    },
    {
      href: "/exames",
      icon: <Microscope className="h-4 w-4" />,
      label: "Pendências de Exames",
      show: pode("registrar_exames"),
    },
    {
      href: "/leitos",
      icon: <BedDouble className="h-4 w-4" />,
      label: "Gestão de Leitos",
      show: true,
    },
    {
      href: "/historico",
      icon: <History className="h-4 w-4" />,
      label: "Histórico de Altas",
      show: true,
    },
    {
      href: "/passagem-plantao",
      icon: <ClipboardList className="h-4 w-4" />,
      label: "Passagem de Plantão",
      show: pode("registrar_evolucao"),
    },
    {
      href: "/tempos-metas",
      icon: <Target className="h-4 w-4" />,
      label: "Tempos & Metas",
      show: pode("visualizar_relatorios"),
    },
    {
      href: "/relatorios",
      icon: <BarChart3 className="h-4 w-4" />,
      label: "Relatórios",
      show: pode("visualizar_relatorios"),
    },
    {
      href: "/funcionarios",
      icon: <Users className="h-4 w-4" />,
      label: "Funcionários",
      show: pode("gerenciar_usuarios"),
    },
    {
      href: "/admin/dashboard",
      icon: <Settings2 className="h-4 w-4" />,
      label: "Administração",
      show: activeUser?.role === "administrador" || activeUser?.role === "diretoria_geral",
    },
  ];

  return (
    <aside className="w-52 min-h-screen bg-card border-r border-border flex-col shrink-0 hidden lg:flex sticky top-0 h-screen overflow-y-auto">
      {/* Setores */}
      <div className="p-2 pt-4">
        <p className="text-[10px] uppercase font-bold text-muted-foreground/50 tracking-widest mb-1.5 px-3">
          Setores
        </p>
        {sectorItems
          .filter(i => i.show)
          .map(item => (
            <SidebarLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={location === item.href}
            />
          ))}
      </div>

      {/* Menu */}
      <div className="p-2 border-t border-border/60 mt-1">
        <p className="text-[10px] uppercase font-bold text-muted-foreground/50 tracking-widest mb-1.5 px-3">
          Menu
        </p>
        {featureItems
          .filter(i => i.show)
          .map(item => (
            <SidebarLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={location === item.href}
            />
          ))}
      </div>

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
