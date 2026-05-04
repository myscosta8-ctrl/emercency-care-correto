import { Activity, Power, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PERFIL_LABELS } from "@/lib/permissions";
import type { Perfil } from "@/lib/permissions";
import { getRoleHome } from "@/lib/role-home";

const ROLE_COLORS: Record<string, string> = {
  recepcionista:      "bg-sky-500/20 text-sky-400 border-sky-500/30",
  tecnico_enfermagem: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  enfermeiro:         "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  medico:             "bg-purple-500/20 text-purple-400 border-purple-500/30",
  assistente_social:  "bg-orange-500/20 text-orange-400 border-orange-500/30",
  nutricionista:      "bg-green-500/20 text-green-400 border-green-500/30",
  farmaceutico:       "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  administrador:      "bg-red-500/20 text-red-400 border-red-500/30",
};

interface Props {
  title: string;
  icon?: React.ReactNode;
}

export function RoleHeader({ title, icon }: Props) {
  const { activeUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const role = activeUser?.role ?? "";
  const roleLabel = PERFIL_LABELS[role as Perfil] ?? role;
  const roleColor = ROLE_COLORS[role] ?? "bg-muted text-muted-foreground border-border";
  const home = getRoleHome(role);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-4 h-12">
        <Link href={home}>
          <button className="flex items-center gap-1.5 hover:opacity-75 transition-opacity shrink-0">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm hidden sm:block">UPA Breves</span>
          </button>
        </Link>

        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border shrink-0", roleColor)}>
          {roleLabel}
        </span>

        <span className="text-sm font-semibold truncate flex-1 min-w-0 text-muted-foreground">
          {title}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {role !== "recepcionista" && role !== "tecnico_enfermagem" && role !== "assistente_social" && role !== "nutricionista" && role !== "farmaceutico" && (
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                <LayoutDashboard className="h-3 w-3" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
          )}
          <span className="text-xs text-muted-foreground hidden md:block max-w-32 truncate">
            {activeUser?.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            title={`Sair (${activeUser?.name ?? ""})`}
            aria-label="Sair"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => { logout(); setLocation("/login"); }}
          >
            <Power className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
