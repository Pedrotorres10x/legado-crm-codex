import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Clock, HelpCircle, Mail, MessageSquare, Percent, Send, UserCheck, Zap } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type CampaignEngagement = {
  source: string;
  label: string;
  outbound_total: number;
  outbound_email: number;
  outbound_whatsapp: number;
  inbound_total: number;
  inbound_email: number;
  inbound_whatsapp: number;
  classified: number;
  revision: number;
  errors: number;
  response_rate: number;
  first_sent: string | null;
  last_sent: string | null;
};

type CampaignEngagementPanelProps = {
  engagementStats?: CampaignEngagement[];
  infoColor: string;
  successColor: string;
  accentColor: string;
  dangerColor: string;
};

export function CampaignEngagementPanel({
  engagementStats,
  infoColor,
  successColor,
  accentColor,
  dangerColor,
}: CampaignEngagementPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4" /> Estadísticas de comunicación por campaña
        </CardTitle>
        <CardDescription>Mensajes enviados, respuestas recibidas, tasa de respuesta y desglose por canal</CardDescription>
      </CardHeader>
      <CardContent>
        {engagementStats && engagementStats.length > 0 ? (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={engagementStats.map((e) => ({
                  name: e.label,
                  Enviados: e.outbound_total,
                  Respuestas: e.inbound_total,
                  Clasificados: e.classified,
                  Errores: e.errors,
                }))}
                layout="vertical"
                barGap={2}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Enviados" fill={infoColor} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Respuestas" fill={successColor} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Clasificados" fill={accentColor} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Errores" fill={dangerColor} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {engagementStats.map((eng) => (
                <div key={eng.source} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{eng.label}</h4>
                    <Badge variant={eng.response_rate >= 30 ? 'default' : eng.response_rate >= 10 ? 'secondary' : 'outline'}>
                      {eng.response_rate}% respuesta
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <ArrowUpRight className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
                      <p className="text-lg font-bold">{eng.outbound_total}</p>
                      <p className="text-[10px] text-muted-foreground">Enviados</p>
                    </div>
                    <div>
                      <ArrowDownLeft className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
                      <p className="text-lg font-bold">{eng.inbound_total}</p>
                      <p className="text-[10px] text-muted-foreground">Respuestas</p>
                    </div>
                    <div>
                      <UserCheck className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
                      <p className="text-lg font-bold">{eng.classified}</p>
                      <p className="text-[10px] text-muted-foreground">Clasificados</p>
                    </div>
                    <div>
                      <Percent className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
                      <p className="text-lg font-bold">{eng.response_rate}%</p>
                      <p className="text-[10px] text-muted-foreground">Tasa resp.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-foreground text-[11px]">Canales (envío)</p>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{eng.outbound_email} email</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{eng.outbound_whatsapp} WhatsApp</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-foreground text-[11px]">Canales (respuesta)</p>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{eng.inbound_email} email</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{eng.inbound_whatsapp} WhatsApp</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 text-[11px] text-muted-foreground flex-wrap border-t pt-2">
                    {eng.revision > 0 && (
                      <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" />{eng.revision} revisión manual</span>
                    )}
                    {eng.errors > 0 && (
                      <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />{eng.errors} errores</span>
                    )}
                    {eng.first_sent && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Inicio: {format(new Date(eng.first_sent), 'dd/MM/yy')}</span>
                    )}
                    {eng.last_sent && (
                      <span className="flex items-center gap-1"><Send className="h-3 w-3" />Último: {formatDistanceToNow(new Date(eng.last_sent), { addSuffix: true, locale: es })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">Sin datos de comunicación</div>
        )}
      </CardContent>
    </Card>
  );
}
