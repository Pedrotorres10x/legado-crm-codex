import { Mail, Share2, Trash2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type PropertyOwnerActionsPanelProps = {
  property: any;
  propertyId: string;
  isAdmin: boolean;
  compact?: boolean;
  onRefreshProperty: () => Promise<void> | void;
  onDeleteSuccess: () => void;
};

const PropertyOwnerActionsPanel = ({
  property,
  propertyId,
  isAdmin,
  compact = false,
  onRefreshProperty,
  onDeleteSuccess,
}: PropertyOwnerActionsPanelProps) => {
  const { toast } = useToast();

  const handleCopyPortalLink = async () => {
    let portalToken = (property as any).portal_token;
    if (!portalToken) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      portalToken = '';
      for (let i = 0; i < 32; i += 1) portalToken += chars.charAt(Math.floor(Math.random() * chars.length));
      await supabase.from('properties').update({ portal_token: portalToken } as any).eq('id', propertyId);
      await onRefreshProperty();
    }

    const url = `${window.location.origin}/portal/${portalToken}`;
    await navigator.clipboard.writeText(url);
    toast({ title: 'Enlace del portal copiado', description: 'Envíalo al propietario por WhatsApp o email' });
  };

  const handleSendOwnerReport = async () => {
    toast({ title: 'Enviando informe...', description: 'Generando y enviando por email' });
    try {
      const { data, error } = await supabase.functions.invoke('owner-weekly-report', {
        body: { property_id: property.id },
      });
      if (error) throw error;

      if (data?.sent > 0) {
        toast({ title: '✅ Informe enviado', description: 'Email enviado al propietario' });
      } else {
        toast({
          title: '⚠️ No enviado',
          description: data?.message || 'El propietario no tiene email configurado',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteProperty = async () => {
    await supabase.from('properties').delete().eq('id', propertyId);
    toast({ title: 'Inmueble eliminado' });
    onDeleteSuccess();
  };

  if (compact) {
    return (
      <>
        {!property.xml_id && (
          <Button variant="outline" size="sm" onClick={handleCopyPortalLink}>
            <Share2 className="h-4 w-4 mr-1" />Portal Propietario
          </Button>
        )}
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1" />Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este inmueble?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará el inmueble y todos sus datos asociados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteProperty}>
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </>
    );
  }

  if (!property.owner_id) return null;

  return (
    <Card className="animate-fade-in-up">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Informe al propietario
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Envía resumen semanal de visitas, leads y posición en portales
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleSendOwnerReport}>
            <Mail className="h-3.5 w-3.5 mr-1" /> Enviar ahora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PropertyOwnerActionsPanel;
