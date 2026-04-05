import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OperationsItem } from '@/hooks/useOperationsFeed';

type Agent = {
  user_id: string;
  full_name: string;
};

type OperationsCenterHeaderProps = {
  canViewAll: boolean;
  selectedAgentId: string;
  setSelectedAgentId: (value: string) => void;
  agents: Agent[];
  issueFilter: 'all' | OperationsItem['kind'];
  setIssueFilter: (value: 'all' | OperationsItem['kind']) => void;
};

export default function OperationsCenterHeader({
  canViewAll,
  selectedAgentId,
  setSelectedAgentId,
  agents,
  issueFilter,
  setIssueFilter,
}: OperationsCenterHeaderProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-1 text-sm font-medium tracking-wide text-muted-foreground">Trabajo vivo del dia</p>
        <h1 className="text-3xl font-display font-bold tracking-tight">Centro de operaciones</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Aqui deberias poder abrir el siguiente asunto importante sin tener que adivinar.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {canViewAll ? (
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Todos los agentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los agentes</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.user_id} value={agent.user_id}>
                  {agent.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={issueFilter} onValueChange={(value) => setIssueFilter(value as 'all' | OperationsItem['kind'])}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Todos los asuntos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
            <SelectItem value="closing">Cierre</SelectItem>
            <SelectItem value="signature">Firma</SelectItem>
            <SelectItem value="deed">Escritura</SelectItem>
            <SelectItem value="postsale">Postventa</SelectItem>
            <SelectItem value="stock">Stock</SelectItem>
            <SelectItem value="visit">Visitas</SelectItem>
            <SelectItem value="offer">Ofertas</SelectItem>
            <SelectItem value="lead">Leads inbound</SelectItem>
            <SelectItem value="task">Tareas vencidas</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
