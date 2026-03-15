import { Button } from '@/components/ui/button';
import { CalendarPlus } from 'lucide-react';
import { openGoogleCalendar } from '@/lib/google-calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AddToGoogleCalendarButtonProps {
  visitDate: string;
  propertyTitle?: string;
  contactName?: string;
  propertyAddress?: string;
  notes?: string;
  /** 'icon' = compact icon-only button, 'sm' = small button with text */
  size?: 'sm' | 'icon';
}

const AddToGoogleCalendarButton = ({
  visitDate,
  propertyTitle,
  contactName,
  propertyAddress,
  notes,
  size = 'icon',
}: AddToGoogleCalendarButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const description = [
      contactName ? `Cliente: ${contactName}` : '',
      propertyAddress ? `Dirección: ${propertyAddress}` : '',
      notes || '',
    ].filter(Boolean).join('\n');

    openGoogleCalendar({
      title: `Visita: ${propertyTitle || 'Propiedad'}`,
      startDate: new Date(visitDate),
      durationMinutes: 60,
      location: propertyAddress,
      description: description || undefined,
    });
  };

  if (size === 'sm') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-1.5 text-xs shrink-0 text-primary border-primary/30 hover:bg-primary/10 hover:border-primary/50"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Google Cal
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 shrink-0"
          onClick={handleClick}
        >
          <CalendarPlus className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Añadir a Google Calendar</TooltipContent>
    </Tooltip>
  );
};

export default AddToGoogleCalendarButton;
