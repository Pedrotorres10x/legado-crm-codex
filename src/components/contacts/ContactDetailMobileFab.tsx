import { hapticLight } from '@/lib/haptics';
import { ListTodo } from 'lucide-react';

type Props = {
  onClick: () => void;
};

export default function ContactDetailMobileFab({ onClick }: Props) {
  return (
    <button
      onClick={() => { hapticLight(); onClick(); }}
      className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      aria-label="Nueva tarea"
    >
      <ListTodo className="h-6 w-6" />
    </button>
  );
}
