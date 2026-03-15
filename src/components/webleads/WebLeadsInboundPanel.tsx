import { AlertCircle, ArrowUpRight, Clock, Globe, Hash, Mail, PhoneCall, Users, XCircle } from 'lucide-react';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

import FbLeadUploadDialog from '@/components/FbLeadUploadDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type LeadFilter = 'all' | 'needs_follow_up' | 'missing_property' | 'with_offer' | 'with_visit' | 'with_open_task' | 'discarded';
type LeadSourceFilter = 'all' | 'web' | 'portal' | 'fb';

type ChannelFunnelItem = {
  id: string;
  label: string;
  total: number;
  withTasks: number;
  withVisits: number;
  withOffers: number;
  needsFollowUp: number;
  discarded: number;
  topLossReason: { label: string; count: number } | null;
  taskRate: number;
  visitRate: number;
  offerRate: number;
};

type LinkedProperty = {
  id: string;
  title: string;
  reference?: string | null;
};

type LeadRow = {
  id: string;
  full_name: string;
  status: string;
  lead_source: string;
  portal_name?: string | null;
  pipeline_stage?: string | null;
  needs_follow_up: boolean;
  visit_count: number;
  offer_count: number;
  is_discarded?: boolean;
  loss_reason?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at: string;
  open_task_count: number;
  linked_property?: LinkedProperty | null;
};

const STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo',
  en_seguimiento: 'En seguimiento',
  activo: 'Activo',
  cerrado: 'Cerrado',
};

const STAGE_LABEL: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  visita: 'Visita',
  oferta: 'Oferta',
  negociacion: 'Negociación',
  cerrado: 'Cerrado',
};

type WebLeadsInboundPanelProps = {
  totalLeads: number;
  webLeadsCount: number;
  portalLeadsCount: number;
  fbLeadsCount: number;
  convRate: number;
  leadsWithoutFollowUp: number;
  leadsWithOpenTasks: number;
  leadsWithVisits: number;
  leadsWithOffers: number;
  leadsWithoutProperty: number;
  discardedLeads: number;
  topLossReasons: Array<[string, number]>;
  channelFunnel: ChannelFunnelItem[];
  leadsLoading: boolean;
  filteredLeadsCount: number;
  visibleLeads: LeadRow[];
  leadFilter: LeadFilter;
  setLeadFilter: (value: LeadFilter) => void;
  leadSourceFilter: LeadSourceFilter;
  setLeadSourceFilter: (value: LeadSourceFilter) => void;
  onDiscardLead: (leadId: string, reason: string) => Promise<void>;
};

const LOSS_REASON_OPTIONS = [
  { value: 'precio_fuera_de_mercado', label: 'Precio fuera de mercado' },
  { value: 'sin_interes_real', label: 'Sin interés real' },
  { value: 'zona_o_producto_no_encaja', label: 'Zona o producto no encaja' },
  { value: 'duplicado_o_contacto_invalido', label: 'Duplicado o contacto inválido' },
  { value: 'ya_trabajado_por_otro', label: 'Ya trabajado por otro' },
] as const;

export function WebLeadsInboundPanel({
  totalLeads,
  webLeadsCount,
  portalLeadsCount,
  fbLeadsCount,
  convRate,
  leadsWithoutFollowUp,
  leadsWithOpenTasks,
  leadsWithVisits,
  leadsWithOffers,
  leadsWithoutProperty,
  discardedLeads,
  topLossReasons,
  channelFunnel,
  leadsLoading,
  filteredLeadsCount,
  visibleLeads,
  leadFilter,
  setLeadFilter,
  leadSourceFilter,
  setLeadSourceFilter,
  onDiscardLead,
}: WebLeadsInboundPanelProps) {
  const [discardLeadId, setDiscardLeadId] = useState<string | null>(null);
  const [discardReason, setDiscardReason] = useState<string>(LOSS_REASON_OPTIONS[0].value);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Sin seguimiento', value: leadsWithoutFollowUp, tone: 'text-destructive' },
          { label: 'Con tarea abierta', value: leadsWithOpenTasks, tone: 'text-primary' },
          { label: 'Con visita', value: leadsWithVisits, tone: 'text-primary' },
          { label: 'Con oferta', value: leadsWithOffers, tone: 'text-primary' },
          { label: 'Sin propiedad', value: leadsWithoutProperty, tone: 'text-destructive' },
          { label: 'Descartados', value: discardedLeads, tone: 'text-muted-foreground' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-3 pb-3 px-3">
              <div className={`text-xl font-bold ${item.tone}`}>{item.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {leadsWithoutFollowUp > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-foreground">
                Hay {leadsWithoutFollowUp} lead{leadsWithoutFollowUp > 1 ? 's' : ''} sin seguimiento
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Crea una tarea desde cada lead para no perder entradas web sin trabajar.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/operations?kind=lead">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  Ir a operaciones
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/tasks">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  Abrir planificación
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {channelFunnel.map((channel) => (
          <Card key={channel.id}>
            <CardContent className="pt-3 pb-3 px-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{channel.label}</div>
                <Badge variant="outline" className="text-[10px]">{channel.total} leads</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-md bg-muted/40 py-2">
                  <div className="text-sm font-bold text-foreground">{channel.withTasks}</div>
                  <div className="text-[10px] text-muted-foreground">tareas</div>
                </div>
                <div className="rounded-md bg-muted/40 py-2">
                  <div className="text-sm font-bold text-foreground">{channel.withVisits}</div>
                  <div className="text-[10px] text-muted-foreground">visitas</div>
                </div>
                <div className="rounded-md bg-muted/40 py-2">
                  <div className="text-sm font-bold text-foreground">{channel.withOffers}</div>
                  <div className="text-[10px] text-muted-foreground">ofertas</div>
                </div>
                <div className="rounded-md bg-muted/40 py-2">
                  <div className="text-sm font-bold text-destructive">{channel.needsFollowUp}</div>
                  <div className="text-[10px] text-muted-foreground">sin seguir</div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                <span>{channel.discarded} descartado{channel.discarded === 1 ? '' : 's'}</span>
                <span>{channel.topLossReason ? `${channel.topLossReason.label} · ${channel.topLossReason.count}` : 'sin motivo dominante'}</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Lead → tarea</span>
                    <span>{channel.taskRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary/80" style={{ width: `${channel.taskRate}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Lead → visita</span>
                    <span>{channel.visitRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${channel.visitRate}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Lead → oferta</span>
                    <span>{channel.offerRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary/60" style={{ width: `${channel.offerRate}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Leads recibidos · {totalLeads} en periodo ({webLeadsCount} web + {portalLeadsCount} portal + {fbLeadsCount} FB Ads) · conversión web {convRate}%
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all' as const, label: `Todos (${filteredLeadsCount})` },
                  { id: 'needs_follow_up' as const, label: `Sin seguimiento (${leadsWithoutFollowUp})` },
                  { id: 'missing_property' as const, label: `Sin propiedad (${leadsWithoutProperty})` },
                  { id: 'with_offer' as const, label: `Con oferta (${leadsWithOffers})` },
                  { id: 'with_visit' as const, label: `Con visita (${leadsWithVisits})` },
                  { id: 'with_open_task' as const, label: `Con tarea (${leadsWithOpenTasks})` },
                  { id: 'discarded' as const, label: `Descartados (${discardedLeads})` },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setLeadFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      leadFilter === filter.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all' as const, label: `Todos los canales (${filteredLeadsCount})` },
                  { id: 'web' as const, label: `Web (${webLeadsCount})` },
                  { id: 'portal' as const, label: `Portal (${portalLeadsCount})` },
                  { id: 'fb' as const, label: `FB Ads (${fbLeadsCount})` },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setLeadSourceFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      leadSourceFilter === filter.id
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {topLossReasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {topLossReasons.slice(0, 3).map(([reason, count]) => (
                    <Badge key={reason} variant="outline" className="text-[10px]">
                      {reason} · {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <FbLeadUploadDialog />
            {leadsWithoutProperty > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-destructive font-medium bg-destructive/10 px-2.5 py-1 rounded-full">
                <AlertCircle className="h-3.5 w-3.5" />
                {leadsWithoutProperty} sin propiedad vinculada
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {leadsLoading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Cargando…</div>
          ) : visibleLeads.length === 0 ? (
            <div className="flex flex-col items-center h-36 justify-center text-muted-foreground gap-2 p-6">
              <Globe className="h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">No hay leads para este filtro</p>
              <p className="text-xs opacity-60 text-center max-w-xs">
                Ajusta el filtro o espera nuevas entradas para ver más leads en esta bandeja.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleLeads.map((lead) => (
                <div
                  key={lead.id}
                  className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors ${!lead.linked_property || lead.needs_follow_up ? 'bg-destructive/5' : ''}`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${lead.linked_property ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                    <span className={`text-sm font-semibold ${lead.linked_property ? 'text-primary' : 'text-destructive'}`}>
                      {lead.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/contacts/${lead.id}`} className="font-semibold text-sm text-foreground hover:text-primary transition-colors">
                        {lead.full_name}
                      </Link>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                        {STATUS_LABEL[lead.status] ?? lead.status}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        lead.lead_source === 'fb'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                          : lead.lead_source === 'portal'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {lead.lead_source === 'fb' ? `📱 ${lead.portal_name || 'Facebook Ads'}` : lead.lead_source === 'portal' ? `🏠 ${lead.portal_name || 'Portal'}` : '🌐 Formulario web'}
                      </span>
                      {lead.pipeline_stage && lead.pipeline_stage !== 'nuevo' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {STAGE_LABEL[lead.pipeline_stage] ?? lead.pipeline_stage}
                        </span>
                      )}
                      {lead.is_discarded && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          Descartado
                        </span>
                      )}
                      {lead.needs_follow_up && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                          Sin seguimiento
                        </span>
                      )}
                      {lead.visit_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {lead.visit_count} visita{lead.visit_count > 1 ? 's' : ''}
                        </span>
                      )}
                      {lead.offer_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {lead.offer_count} oferta{lead.offer_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                      {lead.phone && <span className="flex items-center gap-1"><PhoneCall className="h-3 w-3" />{lead.phone}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(lead.created_at), 'd MMM yyyy', { locale: es })}
                      </span>
                      {lead.open_task_count > 0 && (
                        <span>{lead.open_task_count} tarea{lead.open_task_count > 1 ? 's' : ''} abierta{lead.open_task_count > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {lead.linked_property ? (
                      <Link
                        to={`/properties/${lead.linked_property.id}`}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                      >
                        <Hash className="h-3 w-3" />
                        {lead.linked_property.reference && <span className="font-mono">{lead.linked_property.reference} · </span>}
                        {lead.linked_property.title}
                      </Link>
                    ) : (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-destructive font-medium">
                        <AlertCircle className="h-3 w-3" />
                        Sin propiedad vinculada
                      </span>
                    )}
                    {lead.loss_reason && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <XCircle className="h-3 w-3" />
                        Motivo de pérdida: {lead.loss_reason}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {!lead.is_discarded && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                        onClick={() => {
                          setDiscardLeadId(lead.id);
                          setDiscardReason(LOSS_REASON_OPTIONS[0].value);
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Descartar
                      </Button>
                    )}
                    {lead.needs_follow_up && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" asChild>
                        <Link to={`/operations?kind=lead`}>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Operaciones
                        </Link>
                      </Button>
                    )}
                    {lead.needs_follow_up && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" asChild>
                        <Link to={`/tasks?new=1&contact_id=${lead.id}`}>
                          <Clock className="h-3.5 w-3.5" />
                          Crear seguimiento
                        </Link>
                      </Button>
                    )}
                    <Link to={`/contacts/${lead.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                        <ArrowUpRight className="h-3.5 w-3.5" />Ver
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(discardLeadId)} onOpenChange={(open) => !open && setDiscardLeadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar lead como descartado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Motivo de pérdida</Label>
              <Select value={discardReason} onValueChange={setDiscardReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardLeadId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!discardLeadId) return;
                await onDiscardLead(discardLeadId, discardReason);
                setDiscardLeadId(null);
              }}
            >
              Guardar motivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
