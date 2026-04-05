import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getCoverImage } from '@/lib/get-cover-image';
import { ChevronDown, Copy, ExternalLink, EyeOff, Globe, Share2 } from 'lucide-react';

type PropertyLike = {
  id: string;
  title: string | null;
  city: string | null;
  province: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  status: string;
  images: string[] | null;
  image_order?: unknown;
};

type Props = {
  property: PropertyLike;
  propertyId: string;
  supabaseUrl: string;
  onToast: (title: string, description: string) => void;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function PropertyDetailWebCard({ property, propertyId, supabaseUrl, onToast }: Props) {
  const titleSlug = slugify(property.title || 'propiedad');
  const citySlug = slugify(property.city || property.province || '');
  const uuidSuffix = property.id.replace(/-/g, '').slice(-5);
  const propertySlug = citySlug ? `${titleSlug}-${citySlug}-${uuidSuffix}` : `${titleSlug}-${uuidSuffix}`;
  const webUrl = `https://legadocoleccion.es/propiedad/${propertySlug}`;
  const socialUrl = `https://legadocoleccion.es/s/${propertyId}`;
  const isPublished = ['disponible', 'reservado'].includes(property.status);
  const firstImage = getCoverImage(property.images, property.image_order as string[] | null | undefined, property.id);
  const summaryParts: string[] = [];

  if (property.bedrooms) summaryParts.push(`${property.bedrooms} hab.`);
  if (property.bathrooms) summaryParts.push(`${property.bathrooms} baños`);
  if (property.price) summaryParts.push(`${Number(property.price).toLocaleString('es-ES')} €`);

  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="inline-flex items-center gap-2.5 rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm hover:shadow-md transition-shadow max-w-sm">
        {firstImage && (
          <div className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-border/40">
            <img src={firstImage} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-foreground">Ficha web</span>
            {isPublished ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-success bg-success/10 px-1 py-0.5 rounded-full">
                <span className="h-1 w-1 rounded-full bg-success inline-block" />
                Live
              </span>
            ) : (
              <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded-full uppercase">Off</span>
            )}
          </div>
          {summaryParts.length > 0 && (
            <p className="text-[10px] text-muted-foreground truncate leading-tight">{summaryParts.join(' · ')}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/15 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors flex items-center gap-1 shrink-0">
              Acciones
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => window.open(webUrl, '_blank')}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              Ver en web
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              navigator.clipboard.writeText(webUrl);
              onToast('Enlace web copiado ✓', 'URL directa para enviar a clientes');
            }}>
              <Copy className="h-3.5 w-3.5 mr-2" />
              Copiar enlace web
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              navigator.clipboard.writeText(socialUrl);
              onToast('Enlace redes copiado ✓', 'Pégalo en LinkedIn, WhatsApp o Facebook — verás preview con foto y precio');
            }}>
              <Share2 className="h-3.5 w-3.5 mr-2" />
              Copiar enlace redes sociales
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/ficha-ciega/${propertyId}`, '_blank')}>
              <EyeOff className="h-3.5 w-3.5 mr-2" />
              Ficha ciega
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const blindUrl = `${supabaseUrl}/functions/v1/og-blind?id=${propertyId}`;
              navigator.clipboard.writeText(blindUrl);
              onToast('Enlace ficha ciega copiado ✓', 'Sin datos de la inmobiliaria — ideal para compartir con otras agencias');
            }}>
              <Share2 className="h-3.5 w-3.5 mr-2" />
              Copiar enlace ficha ciega (redes)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
