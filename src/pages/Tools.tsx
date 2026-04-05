import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Sparkles, Users, PenTool, Brain, ShieldCheck, Mic } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import AIAssistant from '@/pages/AIAssistant';
import Reengagement from '@/components/Reengagement';
import DuplicateContacts from '@/components/DuplicateContacts';
import FreeSignature from '@/components/FreeSignature';
import AdminAILearning from '@/components/AdminAILearning';
import ContactBackup from '@/components/ContactBackup';
import VoiceCampaigns from '@/components/VoiceCampaigns';

const Tools = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'ai';
  const [tab, setTab] = useState(initialTab);
  const { isAdmin, canViewAll } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setTab(t);
  }, [searchParams]);

  // On mobile, show only AI Assistant directly
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asistente IA</h1>
          <p className="text-sm text-muted-foreground">Tu asistente inteligente</p>
        </div>
        <AIAssistant />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Herramientas</h1>
        <p className="text-sm text-muted-foreground">IA, reengagement y más</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="flex w-max md:w-auto md:flex-wrap gap-0.5">
          <TabsTrigger value="ai" className="gap-1.5 text-xs md:text-sm shrink-0">
            <Bot className="h-4 w-4" />Asistente IA
          </TabsTrigger>
          <TabsTrigger value="reengagement" className="gap-1.5 text-xs md:text-sm shrink-0">
            <Sparkles className="h-4 w-4" />Reengagement
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-1.5 text-xs md:text-sm shrink-0">
            <Users className="h-4 w-4" />Duplicados
          </TabsTrigger>
          <TabsTrigger value="firma" className="gap-1.5 text-xs md:text-sm shrink-0">
            <PenTool className="h-4 w-4" />Firma
          </TabsTrigger>
          {canViewAll && (
            <TabsTrigger value="voice-campaigns" className="gap-1.5 text-xs md:text-sm shrink-0">
              <Mic className="h-4 w-4" />Voice Campaigns
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="ia-learning" className="gap-1.5 text-xs md:text-sm shrink-0">
              <Brain className="h-4 w-4" />IA Learning
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="backup" className="gap-1.5 text-xs md:text-sm shrink-0">
              <ShieldCheck className="h-4 w-4" />Backup
            </TabsTrigger>
          )}
          </TabsList>
        </div>

        <TabsContent value="ai">
          <AIAssistant />
        </TabsContent>

        <TabsContent value="reengagement">
          <Reengagement />
        </TabsContent>

        <TabsContent value="duplicates">
          <DuplicateContacts />
        </TabsContent>

        <TabsContent value="firma">
          <FreeSignature />
        </TabsContent>

        {canViewAll && (
          <TabsContent value="voice-campaigns">
            <VoiceCampaigns />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="ia-learning">
            <AdminAILearning />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="backup">
            <ContactBackup />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Tools;
