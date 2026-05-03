import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, Users, ShieldCheck, SlidersHorizontal, ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/dashboard",       label: "Dashboard",       icon: LayoutDashboard },
  { href: "/admin/usuarios",        label: "Usuários",        icon: Users           },
  { href: "/admin/permissoes",      label: "Permissões",      icon: ShieldCheck     },
  { href: "/admin/funcionalidades", label: "Funcionalidades", icon: SlidersHorizontal },
];

function AccessDenied() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Esta área é exclusiva para o perfil <strong>Direção</strong>.
        </p>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Sistema
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { activeUser, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="flex gap-6">
          <Skeleton className="h-64 w-48 shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeUser || activeUser.perfil !== "direcao") {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-5 w-5 text-primary shrink-0" />
            <span className="text-muted-foreground text-sm hidden sm:inline">/</span>
            <span className="text-sm font-semibold hidden sm:inline">Administração</span>
            <span className="text-muted-foreground text-sm hidden sm:inline">/</span>
            <span className="text-sm text-muted-foreground truncate">{title}</span>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Voltar ao Sistema</span>
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="w-48 shrink-0 border-r border-border bg-card hidden md:block">
          <nav className="p-2 space-y-0.5 sticky top-12 pt-4">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = location === href || location.startsWith(href + "/");
              return (
                <Link key={href} href={href}>
                  <div className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}>
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile tab bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
