import { Activity, LayoutDashboard, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PERFIL_LABELS } from "@/lib/permissions";
import type { Perfil } from "@/lib/permissions";
import { getRoleHome } from "@/lib/role-home";
import { InternalNotificationsBell } from "@/components/internal-notifications-bell";

const ROLE_COLORS: Record<string, string> = {
  recepcionista:      "bg-sky-100 text-sky-700 border-sky-300",
  tecnico_enfermagem: "bg-teal-100 text-teal-700 border-teal-300",
  enfermeiro:         "bg-cyan-100 text-cyan-700 border-cyan-300",
  medico:             "bg-purple-100 text-purple-700 border-purple-300",
  assistente_social:  "bg-orange-100 text-orange-700 border-orange-300",
  nutricionista:      "bg-green-100 text-green-700 border-green-300",
  farmaceutico:       "bg-yellow-100 text-yellow-700 border-yellow-300",
  administrador:      "bg-red-100 text-red-700 border-red-300",
};

interface Props {
  title: string;
  icon?: React.ReactNode;
  backHref?: string;
}

export function RoleHeader({ title, icon, backHref }: Props) {
  const { activeUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const role = activeUser?.role ?? "";
  const roleLabel = PERFIL_LABELS[role as Perfil] ?? role;
  const roleColor = ROLE_COLORS[role] ?? "bg-muted text-muted-foreground border-border";
  const home = getRoleHome(role);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 px-4 h-14">
        {backHref && (
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground hover:text-foreground shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Voltar</span>
            </Button>
          </Link>
        )}
        {/* Logo + branding */}
        <Link href={home}>
          <button className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
            <img
              src={`${import.meta.env.BASE_URL}logo-sistema-transp.png`}
              alt="Emergency Care logo"
              className="h-9 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <div className="font-black text-xs text-foreground tracking-wide leading-tight">UPA BREVES</div>
              <div className="text-[9px] text-muted-foreground leading-tight">SEMSA — Breves</div>
            </div>
          </button>
        </Link>

        <span className="text-border">|</span>

        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border shrink-0", roleColor)}>
          {roleLabel}
        </span>

        <span className="text-sm font-semibold truncate flex-1 min-w-0 text-muted-foreground">
          {icon && <span className="mr-1.5 inline-flex">{icon}</span>}
          {title}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {role !== "recepcionista" && role !== "tecnico_enfermagem" && role !== "assistente_social" && role !== "nutricionista" && role !== "farmaceutico" && (
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
                <LayoutDashboard className="h-3 w-3" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
          )}
          <InternalNotificationsBell />
          <span className="text-xs text-muted-foreground hidden md:block max-w-32 truncate">
            {activeUser?.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            title={`Sair (${activeUser?.name ?? ""})`}
            aria-label="Sair"
            className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
            onClick={() => { logout(); setLocation("/login"); }}
          >
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
