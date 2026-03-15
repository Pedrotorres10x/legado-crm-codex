import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { HealthInfo } from '@/hooks/useHealthColors';
import HealthDot from '@/components/HealthDot';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PipelineKanbanProps {
  contacts: any[];
  stages: { key: string; label: string; color: string }[];
  onUpdate: () => void;
  healthColors?: Record<string, HealthInfo>;
  stageDurations?: Record<string, number>; // max days per stage before warning
}

// Default max days before a contact is considered stagnant in each stage
const DEFAULT_THRESHOLDS: Record<string, number> = {
  'nuevo': 3,
  'prospecto': 3,
  'contactado': 7,
  'en_seguimiento': 14,
  'cualificado': 7,
  'activo': 14,
  'visita': 7,
  'visita_programada': 7,
  'visita_tasacion': 10,
  'visitando': 10,
  'negociando': 7,
  'oferta': 5,
  'captado': 7,
  'en_venta': 14,
  'arras': 10,
  'escritura': 14,
};

const getDaysInStage = (contact: any): number | null => {
  if (!contact.updated_at) return null;
  return differenceInDays(new Date(), new Date(contact.updated_at));
};

const PipelineKanban = ({ contacts, stages, onUpdate, healthColors, stageDurations }: PipelineKanbanProps) => {
  const { toast } = useToast();

  const moveContact = async (contactId: string, newStage: string) => {
    const { error } = await supabase.from('contacts').update({ pipeline_stage: newStage as any }).eq('id', contactId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    // Notify ERP of pipeline stage change
    const contact = contacts.find((c: any) => c.id === contactId);
    if (contact) {
      import('@/lib/erp-sync').then(({ notifyERP }) => {
        notifyERP('contact_updated', {
          contact_id: contactId,
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
          contact_type: contact.contact_type,
          city: contact.city,
          pipeline_stage: newStage,
          tags: contact.tags,
        });
      });
    }
    onUpdate();
  };

  const thresholds = { ...DEFAULT_THRESHOLDS, ...stageDurations };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map(stage => {
        const stageContacts = contacts.filter(c => (c as any).pipeline_stage === stage.key);
        const stagnantCount = stageContacts.filter(c => {
          const days = getDaysInStage(c);
          const threshold = thresholds[stage.key] ?? 14;
          return days !== null && days > threshold;
        }).length;

        return (
          <div key={stage.key} className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
              <span className="text-sm font-semibold">{stage.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">{stageContacts.length}</Badge>
              {stagnantCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />{stagnantCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {stagnantCount} contacto{stagnantCount > 1 ? 's' : ''} estancado{stagnantCount > 1 ? 's' : ''} en esta etapa
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div
              className="space-y-2 min-h-[200px] rounded-xl bg-muted/30 p-2 border border-dashed border-border"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const contactId = e.dataTransfer.getData('contactId');
                if (contactId) moveContact(contactId, stage.key);
              }}
            >
              {stageContacts.map(c => {
                const daysInStage = getDaysInStage(c);
                const threshold = thresholds[stage.key] ?? 14;
                const isStagnant = daysInStage !== null && daysInStage > threshold;
                const isWarning = daysInStage !== null && daysInStage > threshold * 0.7 && !isStagnant;

                return (
                  <Card
                    key={c.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('contactId', c.id)}
                    className={cn(
                      'cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow',
                      isStagnant && 'border-destructive/40 bg-destructive/5',
                      isWarning && 'border-warning/40'
                    )}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <HealthDot info={healthColors?.[c.id]} />
                        <p className="font-medium text-sm flex-1 truncate">{c.full_name}</p>
                        {daysInStage !== null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                                isStagnant
                                  ? 'bg-destructive/15 text-destructive'
                                  : isWarning
                                    ? 'bg-warning/15 text-warning'
                                    : 'bg-muted text-muted-foreground'
                              )}>
                                {daysInStage}d
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {daysInStage} día{daysInStage !== 1 ? 's' : ''} en esta etapa
                              {isStagnant ? ' · ⚠️ Supera el umbral' : isWarning ? ' · Cerca del límite' : ''}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {c.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />{c.email}
                        </span>
                      )}
                      {c.city && <span className="text-xs text-muted-foreground">{c.city}</span>}
                      {/* Stage navigation buttons */}
                      <div className="flex gap-1 pt-1">
                        {stages.map((s, i) => {
                          const currentIdx = stages.findIndex(st => st.key === stage.key);
                          if (Math.abs(i - currentIdx) !== 1) return null;
                          return (
                            <button
                              key={s.key}
                              onClick={() => moveContact(c.id, s.key)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-accent hover:bg-accent/80 transition-colors"
                            >
                              {i < currentIdx ? '← ' : ''}{s.label}{i > currentIdx ? ' →' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineKanban;
