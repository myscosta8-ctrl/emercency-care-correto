import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthProvider } from "@/lib/auth-context";
import { useAuth } from "@/lib/use-auth";
import { FeaturesProvider } from "@/lib/features-context";

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

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route>
          <AuthGuard>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/recepcao" component={RecepcaoPage} />
              <Route path="/vitais" component={VitaisPage} />
              <Route path="/social" component={SocialPage} />
              <Route path="/nutricao" component={NutricaoPage} />
              <Route path="/farmacia" component={FarmaciaPage} />
              <Route path="/patients/:id/notifications/:notificationId/print" component={NotificationPrint} />
              <Route path="/patients/:id" component={PatientDetail} />
              <Route path="/passagem-plantao" component={ShiftHandover} />
              <Route path="/funcionarios" component={StaffPage} />
              <Route path="/admin/dashboard"       component={AdminDashboard} />
              <Route path="/admin/usuarios"        component={AdminUsuarios} />
              <Route path="/admin/permissoes"      component={AdminPermissoes} />
              <Route path="/admin/funcionalidades" component={AdminFuncionalidades} />
              <Route path="/admin/auditoria"       component={AdminAuditoria} />
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
