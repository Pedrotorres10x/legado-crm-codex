import { Phone } from 'lucide-react';
import TwilioDialer from '@/components/TwilioDialer';
import CallHistory from '@/components/CallHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Calls = () => {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Phone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Centro de Llamadas</h1>
          <p className="text-sm text-muted-foreground">Llamadas VoIP · Gestión y registro automático</p>
        </div>
      </div>

      {/* Tabs: Dialer + History */}
      <Tabs defaultValue="dialer">
        <TabsList className="w-full">
          <TabsTrigger value="dialer" className="flex-1">Marcador</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="dialer" className="mt-4">
          <TwilioDialer />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <CallHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Calls;
