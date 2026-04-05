import { Bot } from 'lucide-react';
import AIPropertyCreator from '@/components/AIPropertyCreator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type PropertiesAiCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
};

export default function PropertiesAiCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: PropertiesAiCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Crear inmueble con IA
          </DialogTitle>
        </DialogHeader>
        <AIPropertyCreator
          onCreated={(id) => {
            onOpenChange(false);
            onCreated(id);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
