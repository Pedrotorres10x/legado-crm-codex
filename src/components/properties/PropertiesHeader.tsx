import { Bot, Plus } from 'lucide-react';
import AgentFilter from '@/components/AgentFilter';
import DocumentScanner from '@/components/DocumentScanner';
import ViewToggle from '@/components/ViewToggle';
import { Button } from '@/components/ui/button';

type PropertiesHeaderProps = {
  totalCount: number;
  isMobile: boolean;
  viewMode: 'grid' | 'list';
  setViewMode: (value: 'grid' | 'list') => void;
  showAll: boolean;
  setShowAll: (value: boolean) => void;
  onAutoCreateFromDocument: (data: unknown) => Promise<void>;
  onOpenAiDialog: () => void;
  onOpenCreateDialog: () => void;
};

export default function PropertiesHeader({
  totalCount,
  isMobile,
  viewMode,
  setViewMode,
  showAll,
  setShowAll,
  onAutoCreateFromDocument,
  onOpenAiDialog,
  onOpenCreateDialog,
}: PropertiesHeaderProps) {
  return (
    <div className="flex items-center justify-between animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight md:text-3xl">Inmuebles</h1>
        <p className="text-sm text-muted-foreground">{totalCount} propiedades en cartera</p>
      </div>
      {!isMobile && (
        <div className="flex gap-2">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <AgentFilter showAll={showAll} onToggle={setShowAll} />
          <DocumentScanner context="property" buttonLabel="Alta por Nota Simple" onExtracted={onAutoCreateFromDocument} />
          <Button variant="outline" onClick={onOpenAiDialog} className="hover-lift">
            <Bot className="mr-2 h-4 w-4" />Crear con IA
          </Button>
          <Button onClick={onOpenCreateDialog} style={{ background: 'var(--gradient-primary)' }} className="hover-lift">
            <Plus className="mr-2 h-4 w-4" />Añadir Inmueble
          </Button>
        </div>
      )}
    </div>
  );
}
