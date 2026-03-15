import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TrafficColor, HealthInfo } from '@/hooks/useHealthColors';

const dotStyles: Record<TrafficColor, string> = {
  green: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
  yellow: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]',
  orange: 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]',
  red: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
};

interface HealthDotProps {
  info: HealthInfo | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

const HealthDot = ({ info, size = 'sm', className = '' }: HealthDotProps) => {
  if (!info) return null;
  const sizeClass = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-block rounded-full ${sizeClass} ${dotStyles[info.color]} ${className}`} />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {info.reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default HealthDot;
