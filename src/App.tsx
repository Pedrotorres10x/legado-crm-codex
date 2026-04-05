import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppSplashScreen from "@/components/AppSplashScreen";
import Auth from "@/pages/Auth";

const queryClient = new QueryClient();
const AppLayout = lazy(() => import("@/components/AppLayout"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Properties = lazy(() => import("@/pages/Properties"));
const PropertyDetail = lazy(() => import("@/pages/PropertyDetail"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const ContactDetail = lazy(() => import("@/pages/ContactDetail"));
const Demands = lazy(() => import("@/pages/Demands"));
const Matches = lazy(() => import("@/pages/Matches"));
const BuyersWithoutDemand = lazy(() => import("@/pages/BuyersWithoutDemand"));
const WhatsAppPending = lazy(() => import("@/pages/WhatsAppPending"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const OperationsCenter = lazy(() => import("@/pages/OperationsCenter"));
const DashboardAdmin = lazy(() => import("@/pages/DashboardAdmin"));
const AdminActivity = lazy(() => import("@/pages/AdminActivity"));
const AdminTeam = lazy(() => import("@/pages/AdminTeam"));
const WebLeads = lazy(() => import("@/pages/WebLeads"));
const Tools = lazy(() => import("@/pages/Tools"));
const Communications = lazy(() => import("@/pages/Communications"));
const SignContract = lazy(() => import("@/pages/SignContract"));
const ConfirmVisit = lazy(() => import("@/pages/ConfirmVisit"));
const Profile = lazy(() => import("@/pages/Profile"));
const Portales = lazy(() => import("@/pages/Portales"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AgentCard = lazy(() => import("@/pages/AgentCard"));
const LinkInBioStats = lazy(() => import("@/pages/LinkInBioStats"));
const BlindPropertySheet = lazy(() => import("@/pages/BlindPropertySheet"));
const AgentPerformance = lazy(() => import("@/pages/AgentPerformance"));
const Valoracion = lazy(() => import("@/pages/Valoracion"));
const AdvisorGuide = lazy(() => import("@/pages/AdvisorGuide"));

const RouteFallback = () => <AppSplashScreen />;
const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<RouteFallback />}>{children}</Suspense>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppSplashScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, canViewAll } = useAuth();
  if (loading) return <AppSplashScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!canViewAll) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <AppSplashScreen />;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/valoracion" element={<LazyPage><Valoracion /></LazyPage>} />
            <Route path="/agente/:slug" element={<LazyPage><AgentCard /></LazyPage>} />
            <Route path="/ficha-ciega/:id" element={<LazyPage><BlindPropertySheet /></LazyPage>} />
            <Route path="/firmar/:token" element={<LazyPage><SignContract /></LazyPage>} />
            <Route path="/visita/:token" element={<LazyPage><ConfirmVisit /></LazyPage>} />
            
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/auth/callback" element={<LazyPage><AuthCallback /></LazyPage>} />
            <Route path="/" element={<ProtectedRoute><LazyPage><AppLayout /></LazyPage></ProtectedRoute>}>
              <Route index element={<LazyPage><Dashboard /></LazyPage>} />
              <Route path="properties" element={<LazyPage><Properties /></LazyPage>} />
              <Route path="properties/:id" element={<LazyPage><PropertyDetail /></LazyPage>} />
              <Route path="contacts" element={<LazyPage><Contacts /></LazyPage>} />
              <Route path="contacts/:id" element={<LazyPage><ContactDetail /></LazyPage>} />
              <Route path="demands" element={<LazyPage><Demands /></LazyPage>} />
              <Route path="buyers-without-demand" element={<LazyPage><BuyersWithoutDemand /></LazyPage>} />
              <Route path="matches" element={<LazyPage><Matches /></LazyPage>} />
              <Route path="whatsapp-pending" element={<LazyPage><WhatsAppPending /></LazyPage>} />
              <Route path="tasks" element={<LazyPage><Tasks /></LazyPage>} />
              <Route path="operations" element={<LazyPage><OperationsCenter /></LazyPage>} />
              <Route path="captaciones" element={<Navigate to="/" replace />} />
              <Route path="sales" element={<Navigate to="/matches" replace />} />
              <Route path="tools" element={<LazyPage><Tools /></LazyPage>} />
              <Route path="comms" element={<LazyPage><Communications /></LazyPage>} />
              <Route path="calls" element={<Navigate to="/comms" replace />} />
              <Route path="chat" element={<Navigate to="/comms" replace />} />
              <Route path="commissions" element={<Navigate to="/profile" replace />} />
              <Route path="profile" element={<LazyPage><Profile /></LazyPage>} />
              <Route path="guide/advisors" element={<LazyPage><AdvisorGuide /></LazyPage>} />
              <Route path="contracts" element={<Navigate to="/tools" replace />} />
              <Route path="ai" element={<Navigate to="/tools" replace />} />
              <Route path="import" element={<Navigate to="/" replace />} />
              <Route path="admin" element={<AdminRoute><LazyPage><DashboardAdmin /></LazyPage></AdminRoute>} />
              <Route path="admin/activity" element={<AdminRoute><LazyPage><AdminActivity /></LazyPage></AdminRoute>} />
              <Route path="admin/team" element={<AdminRoute><LazyPage><AdminTeam /></LazyPage></AdminRoute>} />
              <Route path="admin/tracking" element={<Navigate to="/admin/team?tab=tracking" replace />} />
              <Route path="admin/users" element={<Navigate to="/admin/team" replace />} />
              <Route path="team" element={<Navigate to="/" replace />} />
              <Route path="portales" element={<AdminRoute><LazyPage><Portales /></LazyPage></AdminRoute>} />
              <Route path="web-leads" element={<AdminRoute><LazyPage><WebLeads /></LazyPage></AdminRoute>} />
              <Route path="linkinbio-stats" element={<LazyPage><LinkInBioStats /></LazyPage>} />
              <Route path="performance" element={<LazyPage><AgentPerformance /></LazyPage>} />
            </Route>
            <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
