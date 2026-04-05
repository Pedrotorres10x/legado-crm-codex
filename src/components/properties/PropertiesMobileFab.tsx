import { Plus } from 'lucide-react';

type PropertiesMobileFabProps = {
  isMobile: boolean;
  onOpenCreate: () => void;
};

export default function PropertiesMobileFab({
  isMobile,
  onOpenCreate,
}: PropertiesMobileFabProps) {
  if (!isMobile) return null;

  return (
    <button
      onClick={onOpenCreate}
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)' }}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
