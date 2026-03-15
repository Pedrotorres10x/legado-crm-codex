import { Award, Info, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getHorusPointsRows, type HorusWeights } from '@/lib/horus-model';

interface HorusScoringGuideProps {
  weights: HorusWeights;
  target?: number;
  periodLabel?: string;
  points?: number;
  targetLabel?: string;
}

const HorusScoringGuide = ({
  weights,
  target = weights.monthly_bonus_target,
  periodLabel = 'Ultimos 3 meses',
  points,
  targetLabel = 'de promedio rolling en los ultimos 3 meses',
}: HorusScoringGuideProps) => {
  const rows = getHorusPointsRows(weights);
  const samplePath = [
    { label: '35 WhatsApps', points: 35 * weights.whatsapp },
    { label: '20 emails', points: 20 * weights.email },
    { label: '20 llamadas', points: 20 * weights.llamada },
    { label: '10 cafes', points: 10 * weights.cafe_comida },
    { label: '3 reuniones comida', points: 3 * weights.reunion },
    { label: '8 visitas de captacion', points: 8 * weights.visita_tasacion },
    { label: '2 captaciones en exclusiva', points: 2 * weights.captacion },
    { label: '0,8 arras firmadas de media', points: Math.round(0.8 * weights.facturacion) },
  ];
  const sampleTotal = samplePath.reduce((sum, item) => sum + item.points, 0);

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg font-display">
            <Sparkles className="h-5 w-5 text-warning" />
            Como ganas Puntos Horus
          </CardTitle>
          <Badge variant="outline">{periodLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <Award className="mt-0.5 h-5 w-5 text-warning" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Objetivo Horus</p>
              <p className="text-sm text-muted-foreground">
                Necesitas <span className="font-semibold text-foreground">{target} puntos</span> {targetLabel} para desbloquear el bonus Horus.
                {typeof points === 'number' && (
                  <> Ahora mismo llevas <span className="font-semibold text-foreground">{points}</span>.</>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <div key={row.key} className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                </div>
                <Badge className="shrink-0">{row.points} pt</Badge>
              </div>
              {row.activities && row.activities.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.activities.map((activity) => (
                    <Badge key={activity} variant="secondary" className="font-normal">
                      {activity}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Ejemplo de camino a 500</p>
          <p className="mt-1 text-sm text-muted-foreground">
            La calibración base del modelo es aproximadamente: <strong>4 toques al día</strong>, <strong>2 visitas de captación a la semana</strong>,
            <strong>2 captaciones en exclusiva al mes</strong> y un ritmo de <strong>10 arras al año</strong>. El ejemplo usa una mezcla orientativa
            de toques para que un agente sano quede cerca de <strong>500 puntos de promedio</strong> sin regalar el bonus por actividad vacía.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {samplePath.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm">
                <span>{item.label}</span>
                <span className="font-semibold">{item.points} pt</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-background px-3 py-3">
            <span className="text-sm font-medium">Total ejemplo</span>
            <span className="text-base font-bold text-primary">{sampleTotal} pt</span>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Modelo actual: <strong>WhatsApp &lt; Email &lt; Llamada &lt; Reunion cafe &lt; Reunion comida</strong>. Todos ellos son <strong>toques</strong>.
            La <strong>visita de captacion</strong> puntua como <strong>reunion comida</strong> y, aunque una captacion se trabaje en dos visitas, para Horus cuenta una sola por oportunidad.
            La <strong>visita comprador</strong> se valora aparte y pesa claramente menos que la captacion: con resultado comercial suma algo, sin resultado casi no empuja Horus.
            Y <strong>Facturacion</strong> significa <strong>arras firmadas</strong>, no ventas en notaria. El sistema esta pensado para premiar actividad comercial consistente,
            captacion y negocio originado, no para inflar microtoques sin traccion.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default HorusScoringGuide;
