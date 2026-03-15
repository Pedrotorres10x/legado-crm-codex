import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PriceSparklineProps {
  propertyId: string;
  currentPrice: number | null;
  className?: string;
}

const PriceSparkline = ({ propertyId, currentPrice, className = '' }: PriceSparklineProps) => {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('price_history')
        .select('old_price, new_price, changed_at')
        .eq('property_id', propertyId)
        .order('changed_at', { ascending: true })
        .limit(20);

      if (!data || data.length === 0) return;

      // Build price series: start with first old_price, then each new_price
      const series: number[] = [];
      if (data[0].old_price) series.push(Number(data[0].old_price));
      data.forEach(d => { if (d.new_price) series.push(Number(d.new_price)); });
      // Add current price if different from last
      if (currentPrice && (series.length === 0 || series[series.length - 1] !== currentPrice)) {
        series.push(currentPrice);
      }
      if (series.length >= 2) setPoints(series);
    };
    fetch();
  }, [propertyId, currentPrice]);

  if (points.length < 2) return null;

  const width = 60;
  const height = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * width,
    y: height - ((p - min) / range) * (height - 2) - 1,
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  // Trend: compare last to first
  const trend = points[points.length - 1] > points[0] ? 'up' : points[points.length - 1] < points[0] ? 'down' : 'flat';
  const strokeColor = trend === 'up' ? 'hsl(var(--destructive))' : trend === 'down' ? 'hsl(var(--success, 142 71% 45%))' : 'hsl(var(--muted-foreground))';

  return (
    <svg width={width} height={height} className={`inline-block ${className}`} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2" fill={strokeColor} />
    </svg>
  );
};

export default PriceSparkline;
