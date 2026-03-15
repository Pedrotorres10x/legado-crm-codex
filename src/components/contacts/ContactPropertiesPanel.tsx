import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Home, Key } from 'lucide-react';
import { getCoverImage } from '@/lib/get-cover-image';

type PropertyLike = {
  id: string;
  title?: string | null;
  address?: string | null;
  price?: number | null;
  status?: string | null;
  images?: string[] | null;
  image_order?: string[] | null;
  arras_status?: string | null;
  arras_amount?: number | null;
};

type VisitLike = {
  properties?: PropertyLike | null;
};

type OfferLike = {
  properties?: PropertyLike | null;
};

type Props = {
  contactType?: string;
  ownedProperties: PropertyLike[];
  arrasBuyerProperties: PropertyLike[];
  visits: VisitLike[];
  offers: OfferLike[];
  onOpenProperty: (propertyId: string) => void;
};

export default function ContactPropertiesPanel({
  contactType,
  ownedProperties,
  arrasBuyerProperties,
  visits,
  offers,
  onOpenProperty,
}: Props) {
  const showOwnedProperties =
    contactType === 'propietario' ||
    contactType === 'ambos' ||
    contactType === 'vendedor_cerrado' ||
    ownedProperties.length > 0;

  const showBuyerProperties =
    contactType === 'comprador' ||
    contactType === 'ambos' ||
    contactType === 'comprador_cerrado';

  const arrasIds = new Set(arrasBuyerProperties.map((property) => property.id));
  const interestMap = new Map<string, { property: PropertyLike; hasVisit: boolean; hasOffer: boolean }>();

  visits.forEach((visit) => {
    if (!visit.properties?.id || arrasIds.has(visit.properties.id)) return;
    const existing = interestMap.get(visit.properties.id);
    if (existing) {
      existing.hasVisit = true;
    } else {
      interestMap.set(visit.properties.id, { property: visit.properties, hasVisit: true, hasOffer: false });
    }
  });

  offers.forEach((offer) => {
    if (!offer.properties?.id || arrasIds.has(offer.properties.id)) return;
    const existing = interestMap.get(offer.properties.id);
    if (existing) {
      existing.hasOffer = true;
    } else {
      interestMap.set(offer.properties.id, { property: offer.properties, hasVisit: false, hasOffer: true });
    }
  });

  const interestProperties = Array.from(interestMap.values());

  return (
    <div className="space-y-4">
      {showOwnedProperties && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            Sus propiedades
          </h3>
          {ownedProperties.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                No tiene propiedades asignadas como propietario.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ownedProperties.map((property) => (
                <Card
                  key={property.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onOpenProperty(property.id)}
                >
                  <CardContent className="p-4 space-y-2">
                    {getCoverImage(property.images, property.image_order, property.id) && (
                      <img
                        src={getCoverImage(property.images, property.image_order, property.id)!}
                        alt={property.title || 'Propiedad'}
                        className="h-28 w-full object-cover rounded-md"
                      />
                    )}
                    <p className="font-semibold text-sm truncate">{property.title}</p>
                    {property.address && <p className="text-xs text-muted-foreground truncate">{property.address}</p>}
                    <div className="flex items-center justify-between">
                      {property.price && <span className="font-semibold text-sm">{Number(property.price).toLocaleString('es-ES')} €</span>}
                      <Badge variant="outline" className="text-xs">{property.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {showBuyerProperties && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Propiedad que va a comprar
            </h3>
            {arrasBuyerProperties.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  <p>No tiene propiedad vinculada como comprador.</p>
                  <p className="text-xs mt-1">Para vincular, ve al inmueble → Firma de Arras → selecciona este contacto como comprador.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {arrasBuyerProperties.map((property) => (
                  <Card
                    key={property.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-primary/20"
                    onClick={() => onOpenProperty(property.id)}
                  >
                    <CardContent className="p-4 space-y-2">
                      {getCoverImage(property.images, property.image_order, property.id) && (
                        <img
                          src={getCoverImage(property.images, property.image_order, property.id)!}
                          alt={property.title || 'Propiedad'}
                          className="h-28 w-full object-cover rounded-md"
                        />
                      )}
                      <p className="font-semibold text-sm truncate">{property.title}</p>
                      {property.address && <p className="text-xs text-muted-foreground truncate">{property.address}</p>}
                      <div className="flex items-center justify-between">
                        {property.price && <span className="font-semibold text-sm">{Number(property.price).toLocaleString('es-ES')} €</span>}
                        <Badge variant="outline" className="text-xs">{property.status}</Badge>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="default" className="text-xs">Comprador</Badge>
                        {property.arras_status && property.arras_status !== 'sin_arras' && (
                          <Badge variant="secondary" className="text-xs">
                            Arras: {property.arras_status === 'firmado' ? '✅ Firmado' : property.arras_status === 'pendiente' ? '⏳ Pendiente' : property.arras_status}
                          </Badge>
                        )}
                        {property.arras_amount && property.arras_amount > 0 && (
                          <Badge variant="outline" className="text-xs">{Number(property.arras_amount).toLocaleString('es-ES')} €</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Propiedades de interés
            </h3>
            {interestProperties.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  No hay propiedades de interés (sin visitas ni ofertas).
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {interestProperties.map(({ property, hasVisit, hasOffer }) => (
                  <Card
                    key={property.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onOpenProperty(property.id)}
                  >
                    <CardContent className="p-4 space-y-2">
                      {getCoverImage(property.images, property.image_order, property.id) && (
                        <img
                          src={getCoverImage(property.images, property.image_order, property.id)!}
                          alt={property.title || 'Propiedad'}
                          className="h-28 w-full object-cover rounded-md"
                        />
                      )}
                      <p className="font-semibold text-sm truncate">{property.title}</p>
                      {property.address && <p className="text-xs text-muted-foreground truncate">{property.address}</p>}
                      <div className="flex items-center justify-between">
                        {property.price && <span className="font-semibold text-sm">{Number(property.price).toLocaleString('es-ES')} €</span>}
                        <Badge variant="outline" className="text-xs">{property.status}</Badge>
                      </div>
                      <div className="flex gap-1">
                        {hasVisit && <Badge variant="secondary" className="text-xs">Visitada</Badge>}
                        {hasOffer && <Badge className="text-xs">Oferta</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
