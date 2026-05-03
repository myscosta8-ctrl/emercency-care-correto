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
const AdminDashboard      = lazy(() => import("@/pages/admin/admin-dashboard"));
const AdminUsuarios       = lazy(() => import("@/pages/admin/usuarios"));
const AdminPermissoes     = lazy(() => import("@/pages/admin/permissoes"));
const AdminFuncionalidades = lazy(() => import("@/pages/admin/funcionalidades"));
const AdminAuditoria       = lazy(() => import("@/pages/admin/auditoria"));

const RecepcaoPage = lazy(() => import("@/pages/recepcao"));
const VitaisPage   = lazy(() => import("@/pages/vitais"));
const SocialPage   = lazy(() => import("@/pages/social"));
const NutricaoPage = lazy(() => import("@/pages/nutricao"));
const FarmaciaPage = lazy(() => import("@/pages/farmacia"));

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
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!activeUser) setLocation("/login");
  }, [activeUser, setLocation]);

  if (!activeUser) return <PageLoader />;
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
 * Guards admin-only routes by role (administrador).
 */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { activeUser } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = activeUser?.role === "administrador";

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
        <Route>
          <AuthGuard>
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

              <Route path="/patients/:id/notifications/:notificationId/print" component={NotificationPrint} />
              <Route path="/patients/:id" component={PatientDetail} />

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

              <Route component={NotFound} />
            </Switch>
          </AuthGuard>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
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
