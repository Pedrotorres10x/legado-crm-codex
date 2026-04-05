import { useAuth } from '@/contexts/AuthContext';
import { Home, Search, Shield, UserRoundSearch } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileDashboard from '@/components/MobileDashboard';
import DashboardAgent from '@/pages/DashboardAgent';
import DashboardAdmin from '@/pages/DashboardAdmin';
import { useWorkspacePersona } from '@/hooks/useWorkspacePersona';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { canViewAll } = useAuth();
  const isMobile = useIsMobile();
  const { persona, setPersona } = useWorkspacePersona(canViewAll);
  const navigate = useNavigate();

  if (isMobile) return <MobileDashboard />;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <p className="text-sm font-medium text-muted-foreground mb-1 tracking-wide">Bienvenido de nuevo</p>
        <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
      </div>

      {canViewAll && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                {persona === 'agent' ? 'Modo agente' : 'Modo admin'}
              </p>
              <p className="text-sm text-muted-foreground">
                {persona === 'agent'
                  ? 'Vista ultrasimple para ejecutar: foco, prioridades y siguiente paso.'
                  : 'Vista de dirección para leer oficina, cuellos y actuar sobre el equipo.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => navigate('/demands')}
              >
                <Search className="h-4 w-4" />Demandas
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => navigate('/buyers-without-demand')}
              >
                <UserRoundSearch className="h-4 w-4" />Sin demanda
              </Button>
              <Button
                variant={persona === 'agent' ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => {
                  setPersona('agent');
                  navigate('/');
                }}
              >
                <Home className="h-4 w-4" />Modo agente
              </Button>
              <Button
                variant={persona === 'admin' ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => {
                  setPersona('admin');
                  navigate('/admin');
                }}
              >
                <Shield className="h-4 w-4" />Modo admin
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canViewAll ? (persona === 'agent' ? <DashboardAgent /> : <DashboardAdmin />) : <DashboardAgent />}
    </div>
  );
};

export default Dashboard;
