import { Badge } from '@/components/ui/badge';
import type { HealthInfo } from '@/hooks/useHealthColors';

const badgeStyles = {
  green: 'bg-emerald-500 text-white border-0',
  yellow: 'bg-amber-400 text-black border-0',
  orange: 'bg-orange-500 text-white border-0',
  red: 'bg-red-500 text-white border-0',
} as const;

const ContactHealthBadge = ({ info, className = '' }: { info?: HealthInfo; className?: string }) => {
  if (!info) return null;

  return (
    <Badge className={`${badgeStyles[info.color]} ${className}`.trim()} title={info.reason}>
      {info.label}
    </Badge>
  );
};

export default ContactHealthBadge;
