import { BarChart3, TrendingUp } from 'lucide-react';
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PieDatum = {
  name: string;
  value: number;
  color: string;
};

type ComparisonDatum = {
  name: string;
  Procesados: number;
  Pendientes: number;
};

type CampaignChartsPanelProps = {
  classifyPieData: PieDatum[];
  enrichPieData: PieDatum[];
  comparisonData: ComparisonDatum[];
  successColor: string;
  mutedColor: string;
};

export function CampaignChartsPanel({
  classifyPieData,
  enrichPieData,
  comparisonData,
  successColor,
  mutedColor,
}: CampaignChartsPanelProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Clasificación — Distribución
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classifyPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={classifyPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} strokeWidth={2}>
                    {classifyPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, '']} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Enriquecimiento — Distribución
            </CardTitle>
          </CardHeader>
          <CardContent>
            {enrichPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={enrichPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} strokeWidth={2}>
                    {enrichPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, '']} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Progreso comparado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={comparisonData} layout="vertical" barGap={2}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Procesados" fill={successColor} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Pendientes" fill={mutedColor} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
