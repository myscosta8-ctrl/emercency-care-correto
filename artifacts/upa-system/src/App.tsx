import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthProvider } from "@/lib/auth-context";
import { useAuth } from "@/lib/use-auth";
import { FeaturesProvider } from "@/lib/features-context";
import { getRoleHome } from "@/lib/role-home";
import type { Acao } from "@/lib/permissions";

const Dashboard          = lazy(() => import("@/pages/dashboard"));
const PatientDetail      = lazy(() => import("@/pages/patient-detail"));
const NotificationPrint  = lazy(() => import("@/pages/notification-print"));
const ShiftHandover      = lazy(() => import("@/pages/shift-handover"));
const StaffPage          = lazy(() => import("@/pages/staff"));
const NotFound           = lazy(() => import("@/pages/not-found"));
const LoginPage          = lazy(() => import("@/pages/login"));
const ChangePasswordPage  = lazy(() => import("@/pages/change-password"));
const ResetPasswordPage   = lazy(() => import("@/pages/reset-password"));
const AdminDashboard        = lazy(() => import("@/pages/admin/admin-dashboard"));
const AdminUsuarios         = lazy(() => import("@/pages/admin/usuarios"));
const AdminPermissoes       = lazy(() => import("@/pages/admin/permissoes"));
const AdminFuncionalidades  = lazy(() => import("@/pages/admin/funcionalidades"));
const AdminAuditoria        = lazy(() => import("@/pages/admin/auditoria"));
const AdminRedefinicaoSenha = lazy(() => import("@/pages/admin/redefinicao-senha"));

const LeitosPage         = lazy(() => import("@/pages/leitos"));
const ObservacaoPage     = lazy(() => import("@/pages/observacao-leitos"));
const RecepcaoPage    = lazy(() => import("@/pages/recepcao"));
const VitaisPage      = lazy(() => import("@/pages/vitais"));
const SocialPage      = lazy(() => import("@/pages/social"));
const NutricaoPage    = lazy(() => import("@/pages/nutricao"));
const FarmaciaPage        = lazy(() => import("@/pages/farmacia"));
const FarmaciaEstoquePage = lazy(() => import("@/pages/farmacia-estoque"));
const FilaMedicoPage  = lazy(() => import("@/pages/fila-medico"));
const LaboratorioPage = lazy(() => import("@/pages/laboratorio"));
const ExamesPage      = lazy(() => import("@/pages/exames"));
const HistoricoPage   = lazy(() => import("@/pages/historico"));
const PainelTvPage    = lazy(() => import("@/pages/painel-tv"));
const RelatoriosPage  = lazy(() => import("@/pages/relatorios"));
const TemposMetasPage = lazy(() => import("@/pages/tempos-metas"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-4">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { activeUser } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!activeUser) {
      setLocation("/login");
      return;
    }
    if (activeUser.mustChangePassword && location !== "/change-password") {
      setLocation("/change-password");
    }
  }, [activeUser, location, setLocation]);

  if (!activeUser) return <PageLoader />;
  if (activeUser.mustChangePassword && location !== "/change-password") return <PageLoader />;
  return <>{children}</>;
}

/**
 * Guards a route by permission. If the user lacks the required action,
 * they are redirected to their role's home page instead of seeing an error.
 */
function RoleGuard({ acao, children }: { acao: Acao; children: React.ReactNode }) {
  const { pode, activeUser } = useAuth();
  const [, setLocation] = useLocation();
  const hasAccess = pode(acao);

  useEffect(() => {
    if (!hasAccess && activeUser) {
      setLocation(getRoleHome(activeUser.role ?? ""));
    }
  }, [hasAccess, activeUser, setLocation]);

  if (!hasAccess) return <PageLoader />;
  return <>{children}</>;
}

/**
 * Blocks mobile/tablet access for non-admin roles.
 * Only administrador and diretoria_geral may use the system on small devices.
 */
const MOBILE_ALLOWED_ROLES = ["administrador", "diretoria_geral"];

function isMobileOrTablet(): boolean {
  const smallScreen = window.innerWidth < 1024;
  const mobileUA    = /android|iphone|ipad|ipod|blackberry|windows phone|mobile|tablet/i.test(navigator.userAgent);
  return smallScreen || mobileUA;
}

function MobileGuard({ children }: { children: React.ReactNode }) {
  const { activeUser } = useAuth();
  const role    = activeUser?.role ?? "";
  const blocked = isMobileOrTablet() && !MOBILE_ALLOWED_ROLES.includes(role);

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-card border border-red-500/30 rounded-2xl p-8 max-w-xs space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-red-400 mb-1">Acesso Restrito</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O sistema UPA Breves deve ser utilizado em{" "}
              <span className="text-foreground font-semibold">computadores autorizados</span>.
            </p>
          </div>
          <p className="text-xs text-muted-foreground/60 border-t border-border/40 pt-3">
            Acesso via celular e tablet está disponível apenas para administradores do sistema.
          </p>
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
            className="w-full text-xs py-2 px-4 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            Sair / Trocar conta
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Guards admin-only routes by role (administrador).
 */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { activeUser } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = activeUser?.role === "administrador" || activeUser?.role === "diretoria_geral";

  useEffect(() => {
    if (!isAdmin && activeUser) {
      setLocation(getRoleHome(activeUser.role ?? ""));
    }
  }, [isAdmin, activeUser, setLocation]);

  if (!isAdmin) return <PageLoader />;
  return <>{children}</>;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/painel-tv" component={PainelTvPage} />
        <Route path="/change-password">
          <AuthGuardChangePassword>
            <ChangePasswordPage />
          </AuthGuardChangePassword>
        </Route>
        <Route>
          <AuthGuard>
            <MobileGuard>
            <Switch>
              <Route path="/" component={Dashboard} />

              <Route path="/recepcao">
                <RoleGuard acao="criar_paciente"><RecepcaoPage /></RoleGuard>
              </Route>
              <Route path="/vitais">
                <RoleGuard acao="registrar_sinais_vitais"><VitaisPage /></RoleGuard>
              </Route>
              <Route path="/social">
                <RoleGuard acao="registrar_nota_social"><SocialPage /></RoleGuard>
              </Route>
              <Route path="/nutricao">
                <RoleGuard acao="registrar_avaliacao_nutricional"><NutricaoPage /></RoleGuard>
              </Route>
              <Route path="/farmacia">
                <RoleGuard acao="registrar_farmacia"><FarmaciaPage /></RoleGuard>
              </Route>
              <Route path="/farmacia/estoque">
                <RoleGuard acao="registrar_farmacia"><FarmaciaEstoquePage /></RoleGuard>
              </Route>

              <Route path="/patients/:id/notifications/:notificationId/print" component={NotificationPrint} />
              <Route path="/patients/:id" component={PatientDetail} />

              <Route path="/leitos" component={LeitosPage} />
              <Route path="/observacao" component={ObservacaoPage} />

              <Route path="/fila-medico">
                <RoleGuard acao="registrar_prescricao"><FilaMedicoPage /></RoleGuard>
              </Route>
              <Route path="/laboratorio">
                <RoleGuard acao="registrar_exames"><LaboratorioPage /></RoleGuard>
              </Route>
              <Route path="/exames">
                <RoleGuard acao="registrar_exames"><ExamesPage /></RoleGuard>
              </Route>

              <Route path="/historico" component={HistoricoPage} />

              <Route path="/passagem-plantao">
                <RoleGuard acao="registrar_evolucao"><ShiftHandover /></RoleGuard>
              </Route>
              <Route path="/funcionarios">
                <RoleGuard acao="gerenciar_usuarios"><StaffPage /></RoleGuard>
              </Route>

              <Route path="/admin/dashboard">
                <AdminGuard><AdminDashboard /></AdminGuard>
              </Route>
              <Route path="/admin/usuarios">
                <AdminGuard><AdminUsuarios /></AdminGuard>
              </Route>
              <Route path="/admin/permissoes">
                <AdminGuard><AdminPermissoes /></AdminGuard>
              </Route>
              <Route path="/admin/funcionalidades">
                <AdminGuard><AdminFuncionalidades /></AdminGuard>
              </Route>
              <Route path="/admin/auditoria">
                <AdminGuard><AdminAuditoria /></AdminGuard>
              </Route>
              <Route path="/admin/redefinicao-senha">
                <AdminGuard><AdminRedefinicaoSenha /></AdminGuard>
              </Route>

              <Route path="/relatorios">
                <RoleGuard acao="visualizar_relatorios"><RelatoriosPage /></RoleGuard>
              </Route>
              <Route path="/tempos-metas">
                <RoleGuard acao="visualizar_relatorios"><TemposMetasPage /></RoleGuard>
              </Route>

              <Route component={NotFound} />
            </Switch>
            </MobileGuard>
          </AuthGuard>
        </Route>
      </Switch>
    </Suspense>
  );
}

function AuthGuardChangePassword({ children }: { children: React.ReactNode }) {
  const { activeUser } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!activeUser) setLocation("/login");
  }, [activeUser, setLocation]);

  if (!activeUser) return <PageLoader />;
  return <>{children}</>;
}

function App() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FeaturesProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </FeaturesProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
