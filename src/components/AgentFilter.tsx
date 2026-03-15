import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Users, User } from 'lucide-react';

interface AgentFilterProps {
  showAll: boolean;
  onToggle: (showAll: boolean) => void;
}

const AgentFilter = ({ showAll, onToggle }: AgentFilterProps) => {
  const { isAdmin } = useAuth();

  // Only show toggle for admins or when there are multiple agents
  return (
    <div className="flex rounded-lg border border-input overflow-hidden">
      <Button
        variant={!showAll ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggle(false)}
        className="rounded-none gap-1.5"
      >
        <User className="h-3.5 w-3.5" />
        Mis datos
      </Button>
      <Button
        variant={showAll ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggle(true)}
        className="rounded-none gap-1.5"
      >
        <Users className="h-3.5 w-3.5" />
        Equipo
      </Button>
    </div>
  );
};

export default AgentFilter;
