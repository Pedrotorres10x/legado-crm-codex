import { Home } from 'lucide-react';

import PropertyCommission from '@/components/PropertyCommission';
import * as AccordionUI from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PropertyBusinessPanelProps = {
  propertyId: string;
  propertyTitle?: string | null;
  propertyPrice?: number | null;
  propertyAgentId?: string | null;
  propertyOwnerId?: string | null;
  propertyCity?: string | null;
};

const PropertyBusinessPanel = ({
  propertyId,
  propertyTitle,
  propertyPrice,
  propertyAgentId,
  propertyOwnerId,
  propertyCity,
}: PropertyBusinessPanelProps) => {
  return (
    <AccordionUI.AccordionItem value="business" className="border-b-0">
      <AccordionUI.AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="min-w-0 text-left">
          <p className="text-base font-semibold flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            Negocio y publicacion
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Comision del asesor y configuracion comercial del inmueble.
          </p>
        </div>
      </AccordionUI.AccordionTrigger>
      <AccordionUI.AccordionContent className="px-6 pb-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-primary font-bold">💰</span>
              Comisiones del Asesor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PropertyCommission
              propertyId={propertyId}
              propertyTitle={propertyTitle}
              propertyPrice={propertyPrice}
              propertyAgentId={propertyAgentId}
              propertyOwnerId={propertyOwnerId}
              propertyCity={propertyCity}
            />
          </CardContent>
        </Card>
      </AccordionUI.AccordionContent>
    </AccordionUI.AccordionItem>
  );
};

export default PropertyBusinessPanel;
