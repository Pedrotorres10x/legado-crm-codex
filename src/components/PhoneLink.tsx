import { useState } from 'react';
import { Phone, PhoneOutgoing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import LogCallDialog from '@/components/LogCallDialog';

interface PhoneLinkProps {
  phone: string;
  contactId: string;
  contactName: string;
  onLogged?: () => void;
  /** Show only icon, no text */
  iconOnly?: boolean;
  className?: string;
}

const PhoneLink = ({ phone, contactId, contactName, onLogged, iconOnly = false, className = '' }: PhoneLinkProps) => {
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {!iconOnly && <span>{phone}</span>}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={e => { e.stopPropagation(); setLogOpen(true); }}
            >
              <PhoneOutgoing className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Registrar llamada</TooltipContent>
        </Tooltip>
      </span>

      <LogCallDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        contactId={contactId}
        contactName={contactName}
        phone={phone}
        onLogged={onLogged}
      />
    </>
  );
};

export default PhoneLink;
