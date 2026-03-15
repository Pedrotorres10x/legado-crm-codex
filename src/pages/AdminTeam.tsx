import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Radar, Eye } from 'lucide-react';

// Inline the content from AdminUsers and AdminTracking
import AdminUsersContent from '@/pages/AdminUsers';
import AdminAgentTracker from '@/components/AdminAgentTracker';
import AdminPipelineView from '@/components/AdminPipelineView';

const AdminTeam = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'users';
  const initialAgentId = searchParams.get('agent') || '';
  const [tab, setTab] = useState(initialTab);

  const handleTabChange = (value: string) => {
    setTab(value);
    setSearchParams(value === 'users' ? {} : { tab: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Equipo</h1>
        <p className="text-sm text-muted-foreground">Gestión de usuarios y seguimiento de agentes</p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4" />Usuarios
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1.5">
            <Radar className="h-4 w-4" />Seguimiento
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Eye className="h-4 w-4" />Vista Águila
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <AdminUsersContent />
        </TabsContent>
        <TabsContent value="tracking" className="mt-4">
          <AdminAgentTracker initialAgentId={initialAgentId} />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-4">
          <AdminPipelineView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTeam;
