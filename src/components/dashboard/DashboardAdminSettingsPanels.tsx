import { Check, Clock, Percent, Settings, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type KpiForm = {
  ventas_ano: string;
  captaciones_mes: string;
  citas_semana: string;
  toques_horus_dia: string;
};

type MatchForm = {
  send_hour: string;
  price_margin: string;
};

type DashboardAdminSettingsPanelsProps = {
  kpiTargets: {
    ventas_ano: number;
    captaciones_mes: number;
    citas_semana: number;
    toques_horus_dia: number;
  };
  kpiEditing: boolean;
  kpiForm: KpiForm;
  setKpiForm: (value: KpiForm) => void;
  setKpiEditing: (value: boolean) => void;
  onSaveKpis: () => void;
  matchConfig: {
    send_hour: string;
    price_margin: number;
  };
  matchEditing: boolean;
  matchForm: MatchForm;
  setMatchForm: (value: MatchForm) => void;
  setMatchEditing: (value: boolean) => void;
  onSaveMatchConfig: () => void;
};

export default function DashboardAdminSettingsPanels({
  kpiTargets,
  kpiEditing,
  kpiForm,
  setKpiForm,
  setKpiEditing,
  onSaveKpis,
  matchConfig,
  matchEditing,
  matchForm,
  setMatchForm,
  setMatchEditing,
  onSaveMatchConfig,
}: DashboardAdminSettingsPanelsProps) {
  return (
    <>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />Objetivos KPI del equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Estos objetivos marcan la cadencia comercial sana del equipo: actividad diaria, visitas de captación, exclusivas al mes y ritmo anual de arras.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ventas / año</label>
              {kpiEditing ? (
                <Input type="number" min={0} value={kpiForm.ventas_ano} onChange={(e) => setKpiForm({ ...kpiForm, ventas_ano: e.target.value })} />
              ) : (
                <p className="text-2xl font-bold">{kpiTargets.ventas_ano}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Captaciones / mes</label>
              {kpiEditing ? (
                <Input type="number" min={0} value={kpiForm.captaciones_mes} onChange={(e) => setKpiForm({ ...kpiForm, captaciones_mes: e.target.value })} />
              ) : (
                <p className="text-2xl font-bold">{kpiTargets.captaciones_mes}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Citas captación / semana</label>
              {kpiEditing ? (
                <Input type="number" min={0} value={kpiForm.citas_semana} onChange={(e) => setKpiForm({ ...kpiForm, citas_semana: e.target.value })} />
              ) : (
                <p className="text-2xl font-bold">{kpiTargets.citas_semana}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Toques Horus / día</label>
              {kpiEditing ? (
                <Input type="number" min={0} value={kpiForm.toques_horus_dia} onChange={(e) => setKpiForm({ ...kpiForm, toques_horus_dia: e.target.value })} />
              ) : (
                <p className="text-2xl font-bold">{kpiTargets.toques_horus_dia}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {kpiEditing ? (
              <>
                <Button onClick={onSaveKpis}>
                  <Check className="mr-1 h-4 w-4" />Guardar
                </Button>
                <Button variant="ghost" onClick={() => setKpiEditing(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setKpiForm({
                    ventas_ano: kpiTargets.ventas_ano.toString(),
                    captaciones_mes: kpiTargets.captaciones_mes.toString(),
                    citas_semana: kpiTargets.citas_semana.toString(),
                    toques_horus_dia: kpiTargets.toques_horus_dia.toString(),
                  });
                  setKpiEditing(true);
                }}
              >
                <Settings className="mr-1.5 h-4 w-4" />Editar objetivos
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />Configuración de envío diario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Hora de envío automático y margen de tolerancia de precio para cruces.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-4 w-4" />Hora de envío
              </label>
              {matchEditing ? (
                <Input type="time" value={matchForm.send_hour} onChange={(e) => setMatchForm({ ...matchForm, send_hour: e.target.value })} />
              ) : (
                <p className="text-2xl font-bold">{matchConfig.send_hour}h</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-sm font-medium">
                <Percent className="h-4 w-4" />Margen de precio (±%)
              </label>
              {matchEditing ? (
                <Input type="number" min={1} max={100} value={matchForm.price_margin} onChange={(e) => setMatchForm({ ...matchForm, price_margin: e.target.value })} />
              ) : (
                <p className="text-2xl font-bold">±{matchConfig.price_margin}%</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {matchEditing ? (
              <>
                <Button onClick={onSaveMatchConfig}>
                  <Check className="mr-1 h-4 w-4" />Guardar
                </Button>
                <Button variant="ghost" onClick={() => setMatchEditing(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setMatchForm({ send_hour: matchConfig.send_hour, price_margin: matchConfig.price_margin.toString() });
                  setMatchEditing(true);
                }}
              >
                <Settings className="mr-1.5 h-4 w-4" />Editar configuración
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
