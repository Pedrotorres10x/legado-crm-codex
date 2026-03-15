import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radar, Eye } from 'lucide-react';
import AdminAgentTracker from '@/components/AdminAgentTracker';
import AdminPipelineView from '@/components/AdminPipelineView';

const AdminTracking = () => {
  const [tab, setTab] = useState('performance');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Supervisión individual</p>
        <h1 className="text-2xl font-display font-bold">Seguimiento de Agentes</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="performance" className="gap-1.5">
            <Radar className="h-4 w-4" />Rendimiento
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Eye className="h-4 w-4" />Vista Águila
          </TabsTrigger>
        </TabsList>
        <TabsContent value="performance" className="mt-4">
          <AdminAgentTracker />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-4">
          <AdminPipelineView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTracking;
