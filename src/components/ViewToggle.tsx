import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ViewToggleProps {
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
}

const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => {
  return (
    <div className="flex rounded-lg border border-input overflow-hidden">
      <Button
        variant={view === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className="rounded-none"
        title="Vista lista"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={view === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('grid')}
        className="rounded-none"
        title="Vista cuadrícula"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ViewToggle;
