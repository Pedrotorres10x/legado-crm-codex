import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Home, Loader2, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ContactRow = Database['public']['Tables']['contacts']['Row'];

type Props = {
  contact: ContactRow;
  isAdmin: boolean;
  deleting: boolean;
  onMarkCaptured: () => void;
  onClosePurchase: () => void;
  onCloseSale: () => void;
  onDeleteContact: () => void;
};

export default function ContactDetailStatusActions({
  contact,
  isAdmin,
  deleting,
  onMarkCaptured,
  onClosePurchase,
  onCloseSale,
  onDeleteContact,
}: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {contact.contact_type === 'prospecto' && (
        <Button variant="outline" size="sm" className="text-primary border-primary/30 hover:bg-primary/5" onClick={onMarkCaptured}>
          <CheckCircle className="h-4 w-4 mr-1" />Marcar como captado
        </Button>
      )}
      {contact.contact_type === 'comprador' && (
        <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950" onClick={onClosePurchase}>
          <Home className="h-4 w-4 mr-1" />Cerrar compra
        </Button>
      )}
      {contact.contact_type === 'propietario' && (
        <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950" onClick={onCloseSale}>
          <Home className="h-4 w-4 mr-1" />Cerrar venta
        </Button>
      )}
      {isAdmin && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" />Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminará permanentemente a <strong>{contact.full_name}</strong> y no se podrá recuperar.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDeleteContact} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
