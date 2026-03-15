import { AlertTriangle, Banknote, Clock, HelpCircle, Mail, MapPin, MessageSquare, Power, PowerOff, Send, Shuffle, Snowflake, Target, TrendingUp, UserCheck, UserX, Users, Megaphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';

type ClassifyStats = {
  pending_send: number;
  sent_pending: number;
  comprador: number;
  prospecto: number;
  inactivo: number;
  needs_review: number;
};

type EnrichStats = {
  missing_budget: number;
  missing_zone: number;
  pending_response: number;
  enriched: number;
  no_response: number;
  nevera: number;
};

type CrucesStats = {
  enabled: boolean;
  lastRun: string | null;
  emailsSent: number;
  emailsFailed: number;
  whatsappSent: number;
  matchesCreated: number;
  contactsProcessed: number;
  durationMs: number | null;
  errors: string[];
};

type CampaignSummaryCardsProps = {
  isLoading: boolean;
  classifyStats?: ClassifyStats;
  enrichStats?: EnrichStats;
  crucesStats?: CrucesStats;
  classifyProgress: number;
  enrichProgress: number;
  isEnabled: (key: string) => boolean;
  togglingKey: string | null;
  onToggle: (key: string, newValue: boolean) => void;
};

export function CampaignSummaryCards({
  isLoading,
  classifyStats,
  enrichStats,
  crucesStats,
  classifyProgress,
  enrichProgress,
  isEnabled,
  togglingKey,
  onToggle,
}: CampaignSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className={!isEnabled('campaign_classify_enabled') ? 'opacity-60' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Clasificación</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isEnabled('campaign_classify_enabled')}
                onCheckedChange={(v) => onToggle('campaign_classify_enabled', v)}
                disabled={togglingKey === 'campaign_classify_enabled'}
              />
              <Badge variant={classifyProgress >= 50 ? 'default' : 'secondary'}>
                {isLoading ? '...' : `${classifyProgress}%`}
              </Badge>
            </div>
          </div>
          <CardDescription>Contactos sin clasificar → comprador / prospecto / inactivo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={classifyProgress} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <UserCheck className="h-4 w-4 mx-auto mb-0.5 text-primary" />
              <p className="text-lg font-bold">{isLoading ? '—' : classifyStats?.comprador}</p>
              <p className="text-[11px] text-muted-foreground">Compradores</p>
            </div>
            <div>
              <Users className="h-4 w-4 mx-auto mb-0.5 text-amber-500" />
              <p className="text-lg font-bold">{isLoading ? '—' : classifyStats?.prospecto}</p>
              <p className="text-[11px] text-muted-foreground">Prospectos</p>
            </div>
            <div>
              <UserX className="h-4 w-4 mx-auto mb-0.5 text-destructive" />
              <p className="text-lg font-bold">{isLoading ? '—' : classifyStats?.inactivo}</p>
              <p className="text-[11px] text-muted-foreground">Inactivos</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground justify-center flex-wrap">
            <span className="flex items-center gap-1"><Send className="h-3 w-3" />{classifyStats?.sent_pending || 0} esperando</span>
            <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" />{classifyStats?.needs_review || 0} revisión</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{classifyStats?.pending_send || 0} por enviar</span>
          </div>
        </CardContent>
      </Card>

      <Card className={!isEnabled('campaign_enrich_enabled') ? 'opacity-60' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Enriquecimiento</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isEnabled('campaign_enrich_enabled')}
                onCheckedChange={(v) => onToggle('campaign_enrich_enabled', v)}
                disabled={togglingKey === 'campaign_enrich_enabled'}
              />
              <Badge variant={enrichProgress >= 50 ? 'default' : 'secondary'}>
                {isLoading ? '...' : `${enrichProgress}%`}
              </Badge>
            </div>
          </div>
          <CardDescription>Demandas incompletas → presupuesto y zona</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={enrichProgress} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <TrendingUp className="h-4 w-4 mx-auto mb-0.5 text-primary" />
              <p className="text-lg font-bold">{isLoading ? '—' : enrichStats?.enriched}</p>
              <p className="text-[11px] text-muted-foreground">Enriquecidas</p>
            </div>
            <div>
              <Banknote className="h-4 w-4 mx-auto mb-0.5 text-amber-500" />
              <p className="text-lg font-bold">{isLoading ? '—' : enrichStats?.missing_budget}</p>
              <p className="text-[11px] text-muted-foreground">Sin presupuesto</p>
            </div>
            <div>
              <MapPin className="h-4 w-4 mx-auto mb-0.5 text-blue-500" />
              <p className="text-lg font-bold">{isLoading ? '—' : enrichStats?.missing_zone}</p>
              <p className="text-[11px] text-muted-foreground">Sin zona</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground justify-center flex-wrap">
            <span className="flex items-center gap-1"><Send className="h-3 w-3" />{enrichStats?.pending_response || 0} esperando</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{enrichStats?.no_response || 0} sin respuesta</span>
            <span className="flex items-center gap-1"><Snowflake className="h-3 w-3" />{enrichStats?.nevera || 0} nevera</span>
          </div>
        </CardContent>
      </Card>

      <Card className={!isEnabled('match_sender_enabled') ? 'opacity-60' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shuffle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Cruces</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isEnabled('match_sender_enabled')}
                onCheckedChange={(v) => onToggle('match_sender_enabled', v)}
                disabled={togglingKey === 'match_sender_enabled'}
              />
              {isEnabled('match_sender_enabled') ? (
                <Badge variant="default" className="gap-1"><Power className="h-3 w-3" /> Activo</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><PowerOff className="h-3 w-3" /> Apagado</Badge>
              )}
            </div>
          </div>
          <CardDescription>
            {crucesStats?.lastRun
              ? `Última ejecución: ${formatDistanceToNow(new Date(crucesStats.lastRun), { addSuffix: true, locale: es })}`
              : 'Sin ejecuciones recientes'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <MessageSquare className="h-4 w-4 mx-auto mb-0.5 text-green-500" />
              <p className="text-lg font-bold">{isLoading ? '—' : crucesStats?.whatsappSent}</p>
              <p className="text-[11px] text-muted-foreground">WhatsApp</p>
            </div>
            <div>
              <Mail className="h-4 w-4 mx-auto mb-0.5 text-primary" />
              <p className="text-lg font-bold">{isLoading ? '—' : crucesStats?.emailsSent}</p>
              <p className="text-[11px] text-muted-foreground">Emails OK</p>
            </div>
            <div>
              <AlertTriangle className="h-4 w-4 mx-auto mb-0.5 text-destructive" />
              <p className="text-lg font-bold">{isLoading ? '—' : crucesStats?.emailsFailed}</p>
              <p className="text-[11px] text-muted-foreground">Errores</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground justify-center flex-wrap">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{crucesStats?.contactsProcessed || 0} contactos</span>
            <span className="flex items-center gap-1"><Shuffle className="h-3 w-3" />{crucesStats?.matchesCreated || 0} matches</span>
            {crucesStats?.durationMs != null && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(crucesStats.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
          {crucesStats?.errors && crucesStats.errors.length > 0 && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2 max-h-16 overflow-y-auto">
              {crucesStats.errors.slice(0, 3).map((e, i) => (
                <p key={i} className="truncate">{e}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
