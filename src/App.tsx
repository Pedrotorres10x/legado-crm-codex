import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TwilioProvider } from "@/contexts/TwilioContext";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import PropertyDetail from "@/pages/PropertyDetail";
import Contacts from "@/pages/Contacts";
import ContactDetail from "@/pages/ContactDetail";
import Matches from "@/pages/Matches";
import Tasks from "@/pages/Tasks";
import OperationsCenter from "@/pages/OperationsCenter";
import DashboardAdmin from "@/pages/DashboardAdmin";
import AdminActivity from "@/pages/AdminActivity";
import AdminTeam from "@/pages/AdminTeam";
import WebLeads from "@/pages/WebLeads";
import Tools from "@/pages/Tools";
import Communications from "@/pages/Communications";

import SignContract from "@/pages/SignContract";
import ConfirmVisit from "@/pages/ConfirmVisit";

import Profile from "@/pages/Profile";
import Portales from "@/pages/Portales";
import NotFound from "./pages/NotFound";
import AgentCard from "@/pages/AgentCard";
import LinkInBioStats from "@/pages/LinkInBioStats";
import BlindPropertySheet from "@/pages/BlindPropertySheet";
import AgentPerformance from "@/pages/AgentPerformance";
import Valoracion from "@/pages/Valoracion";
import AdvisorGuide from "@/pages/AdvisorGuide";

import AdminUsers from "@/pages/AdminUsers"; // still used by AdminTeam
import AppSplashScreen from "@/components/AppSplashScreen";

const queryClient = new QueryClient();

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
            <Route path="/valoracion" element={<Valoracion />} />
            <Route path="/agente/:slug" element={<AgentCard />} />
            <Route path="/ficha-ciega/:id" element={<BlindPropertySheet />} />
            <Route path="/firmar/:token" element={<SignContract />} />
            <Route path="/visita/:token" element={<ConfirmVisit />} />
            
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/" element={<ProtectedRoute><TwilioProvider><AppLayout /></TwilioProvider></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="properties" element={<Properties />} />
              <Route path="properties/:id" element={<PropertyDetail />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="contacts/:id" element={<ContactDetail />} />
              <Route path="demands" element={<Navigate to="/contacts" replace />} />
              <Route path="matches" element={<Matches />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="operations" element={<OperationsCenter />} />
              <Route path="captaciones" element={<Navigate to="/" replace />} />
              <Route path="sales" element={<Navigate to="/matches" replace />} />
              <Route path="tools" element={<Tools />} />
              <Route path="comms" element={<Communications />} />
              <Route path="calls" element={<Navigate to="/comms?tab=calls" replace />} />
              <Route path="chat" element={<Navigate to="/comms" replace />} />
              <Route path="commissions" element={<Navigate to="/profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="guide/advisors" element={<AdvisorGuide />} />
              <Route path="contracts" element={<Navigate to="/tools" replace />} />
              <Route path="ai" element={<Navigate to="/tools" replace />} />
              <Route path="import" element={<Navigate to="/" replace />} />
              <Route path="admin" element={<AdminRoute><DashboardAdmin /></AdminRoute>} />
              <Route path="admin/activity" element={<AdminRoute><AdminActivity /></AdminRoute>} />
              <Route path="admin/team" element={<AdminRoute><AdminTeam /></AdminRoute>} />
              <Route path="admin/tracking" element={<Navigate to="/admin/team?tab=tracking" replace />} />
              <Route path="admin/users" element={<Navigate to="/admin/team" replace />} />
              <Route path="team" element={<Navigate to="/" replace />} />
              <Route path="portales" element={<AdminRoute><Portales /></AdminRoute>} />
              <Route path="web-leads" element={<AdminRoute><WebLeads /></AdminRoute>} />
              <Route path="linkinbio-stats" element={<LinkInBioStats />} />
              <Route path="performance" element={<AgentPerformance />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
