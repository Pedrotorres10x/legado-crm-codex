import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Stage = {
  key: string;
  label: string;
  color: string;
};

type PipelineContact = {
  id: string;
  pipeline_stage?: string | null;
};

type ContactsPipelineControlsProps = {
  isMobile: boolean;
  isAgentMode: boolean;
  searchField: 'all' | 'name' | 'phone' | 'email' | 'city' | 'id_number' | 'tags';
  setSearchField: (value: 'all' | 'name' | 'phone' | 'email' | 'city' | 'id_number' | 'tags') => void;
  search: string;
  setSearch: (value: string) => void;
  typeCounts: Record<string, number>;
  pipelineTab: 'captacion' | 'compradores' | 'cerrados' | 'red';
  setPipelineTab: (value: 'captacion' | 'compradores' | 'cerrados' | 'red') => void;
  captacionCount: number;
  compradoresCount: number;
  cerradosCount: number;
  redCount: number;
  pipelineStages: Stage[];
  pipelineContacts: PipelineContact[];
  stageFilter: string | null;
  setStageFilter: (value: string | null) => void;
};

function MiniFunnel({
  typeCounts,
  activeTab,
  onTabChange,
}: {
  typeCounts: Record<string, number>;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const captacionTotal = (typeCounts['statefox'] ?? 0) + (typeCounts['prospecto'] ?? 0) + (typeCounts['propietario'] ?? 0);
  const compradoresTotal = (typeCounts['comprador'] ?? 0) + (typeCounts['ambos'] ?? 0);
  const cerradosTotal = (typeCounts['comprador_cerrado'] ?? 0) + (typeCounts['vendedor_cerrado'] ?? 0);

  const funnels = [
    { key: 'captacion', label: 'Captación', icon: '🏠', count: captacionTotal, color: 'bg-amber-500' },
    { key: 'compradores', label: 'Compradores', icon: '🛒', count: compradoresTotal, color: 'bg-blue-500' },
    { key: 'cerrados', label: 'Cerrados', icon: '✅', count: cerradosTotal, color: 'bg-emerald-500' },
  ];

  const maxCount = Math.max(...funnels.map((f) => f.count), 1);

  return (
    <div className="flex gap-3 items-end">
      {funnels.map((f) => (
        <button
          key={f.key}
          onClick={() => onTabChange(f.key)}
          className={cn(
            'flex-1 rounded-xl border p-3 transition-all text-left hover:shadow-md',
            activeTab === f.key
              ? 'border-primary/50 bg-primary/5 shadow-sm'
              : 'border-border bg-card hover:border-primary/30',
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">{f.icon} {f.label}</span>
            <span className="text-lg font-bold">{f.count.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', f.color)}
              style={{ width: `${Math.max((f.count / maxCount) * 100, 4)}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

function StageSubFilter({
  stages,
  contacts,
  activeStage,
  onStageChange,
}: {
  stages: Stage[];
  contacts: PipelineContact[];
  activeStage: string | null;
  onStageChange: (stage: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onStageChange(null)}
        className={cn(
          'text-xs px-2.5 py-1 rounded-full border transition-colors',
          !activeStage
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
        )}
      >
        Todos
      </button>
      {stages.map((s) => {
        const count = contacts.filter((contact) => contact.pipeline_stage === s.key).length;
        return (
          <button
            key={s.key}
            onClick={() => onStageChange(activeStage === s.key ? null : s.key)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5',
              activeStage === s.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', s.color)} />
            {s.label}
            {count > 0 && <span className="opacity-70">({count})</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function ContactsPipelineControls({
  isMobile,
  isAgentMode,
  searchField,
  setSearchField,
  search,
  setSearch,
  typeCounts,
  pipelineTab,
  setPipelineTab,
  captacionCount,
  compradoresCount,
  cerradosCount,
  redCount,
  pipelineStages,
  pipelineContacts,
  stageFilter,
  setStageFilter,
}: ContactsPipelineControlsProps) {
  return (
    <>
      {!isMobile && (
        <MiniFunnel typeCounts={typeCounts} activeTab={pipelineTab} onTabChange={(tab) => setPipelineTab(tab as typeof pipelineTab)} />
      )}

      <div className="flex flex-wrap gap-2 md:gap-3">
        {!isMobile && !isAgentMode && (
          <Select value={searchField} onValueChange={(value) => setSearchField(value as typeof searchField)}>
            <SelectTrigger className="w-[130px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="phone">Teléfono</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="city">Ciudad</SelectItem>
              <SelectItem value="id_number">DNI/NIE</SelectItem>
              <SelectItem value="tags">Etiqueta</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar persona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!isMobile && (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <Tabs value={pipelineTab} onValueChange={(value) => setPipelineTab(value as typeof pipelineTab)}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="captacion">🏠 Captación ({captacionCount})</TabsTrigger>
              <TabsTrigger value="compradores">🛒 Compradores ({compradoresCount})</TabsTrigger>
              <TabsTrigger value="cerrados">✅ Cerrados ({cerradosCount})</TabsTrigger>
              <TabsTrigger value="red">🤝 Círculo de influencia ({redCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {!isMobile && (
        <StageSubFilter
          stages={pipelineStages}
          contacts={pipelineContacts}
          activeStage={stageFilter}
          onStageChange={setStageFilter}
        />
      )}
    </>
  );
}
