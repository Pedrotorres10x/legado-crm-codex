import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  CheckCircle,
  DollarSign,
  Eye,
  FileText,
  Flame,
  Home,
  Mail,
  MapPin,
  MousePointerClick,
  Phone,
  Tag,
  User,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import PhoneLink from '@/components/PhoneLink';

interface ContactOverviewCardsProps {
  contact: any;
  visits: any[];
  offers: any[];
  interactions: any[];
  callReady: boolean;
  onDial: (phone: string) => void;
  onLogged: () => void;
  canManagePrivacy: boolean;
  onRegisterConsent: () => void;
  onToggleOptOut: (checked: boolean) => void;
}

const ContactOverviewCards = ({
  contact,
  visits,
  offers,
  interactions,
  callReady,
  onDial,
  onLogged,
  canManagePrivacy,
  onRegisterConsent,
  onToggleOptOut,
}: ContactOverviewCardsProps) => {
  const calls = interactions.filter((interaction) => interaction.interaction_type === 'llamada');
  const opens = interactions.filter((interaction) => interaction.subject?.includes('Brevo:') && interaction.subject?.includes('Abrió')).length;
  const clicks = interactions.filter((interaction) => interaction.subject?.includes('Brevo:') && interaction.subject?.includes('Clic')).length;
  const engagementTotal = opens + clicks;
  const engagementLevel = engagementTotal >= 5 ? 'hot' : engagementTotal >= 3 ? 'warm' : 'cold';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Información de contacto</p>
              <p className="font-medium">{contact.full_name}</p>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            {contact.phone ? (
              <div className="flex items-center gap-2">
                <PhoneLink phone={contact.phone} contactId={contact.id} contactName={contact.full_name} onLogged={onLogged} />
                <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 text-xs" disabled={!callReady} onClick={() => onDial(contact.phone)}>
                  <Phone className="h-3 w-3" />
                  VoIP
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm italic text-muted-foreground"><Phone className="h-4 w-4" />Sin teléfono</p>
            )}
            {contact.phone2 && (
              <div className="flex items-center gap-2">
                <PhoneLink phone={contact.phone2} contactId={contact.id} contactName={contact.full_name} onLogged={onLogged} />
                <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 text-xs" disabled={!callReady} onClick={() => onDial(contact.phone2)}>
                  <Phone className="h-3 w-3" />
                  VoIP
                </Button>
              </div>
            )}
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm transition-colors hover:text-primary">
                <Mail className="h-4 w-4 text-muted-foreground" />{contact.email}
              </a>
            ) : (
              <p className="flex items-center gap-2 text-sm italic text-muted-foreground"><Mail className="h-4 w-4" />Sin email</p>
            )}
            {contact.city || contact.address ? (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{[contact.address, contact.city].filter(Boolean).join(', ')}</span>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm italic text-muted-foreground"><MapPin className="h-4 w-4" />Sin dirección</p>
            )}
            {contact.id_number && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{contact.id_number}</span>
                {contact.nationality && <Badge variant="secondary" className="ml-1 text-xs">{contact.nationality}</Badge>}
              </div>
            )}
            {contact.birth_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(contact.birth_date), 'dd MMM yyyy', { locale: es })}</span>
              </div>
            )}
            {contact.purchase_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Home className="h-4 w-4" />
                <span>Compra: {format(new Date(contact.purchase_date), 'dd MMM yyyy', { locale: es })}</span>
              </div>
            )}
            {contact.sale_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Venta: {format(new Date(contact.sale_date), 'dd MMM yyyy', { locale: es })}</span>
              </div>
            )}
          </div>
          {contact.tags?.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {contact.tags.map((tag: string) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{visits.length}</p>
              <p className="text-xs text-muted-foreground">Visitas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{visits.filter((visit) => visit.confirmation_status === 'confirmado').length}</p>
              <p className="text-xs text-muted-foreground">Confirmadas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{offers.length}</p>
              <p className="text-xs text-muted-foreground">Ofertas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{interactions.length}</p>
              <p className="text-xs text-muted-foreground">Interacciones</p>
            </div>
          </div>

          {calls.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {calls.length} llamada{calls.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-muted-foreground">
                  Última hace {(() => {
                    const daysSince = Math.floor((Date.now() - new Date(calls[0].interaction_date).getTime()) / 86400000);
                    return daysSince === 0 ? 'hoy' : `${daysSince} día${daysSince !== 1 ? 's' : ''}`;
                  })()}
                </span>
              </div>
            </>
          )}

          {engagementTotal > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1 text-xs font-medium">
                    <Mail className="h-3.5 w-3.5 text-primary" />Email Engagement
                  </p>
                  <Badge
                    variant={engagementLevel === 'hot' ? 'default' : 'secondary'}
                    className={engagementLevel === 'hot' ? 'border-0 bg-destructive text-destructive-foreground' : engagementLevel === 'warm' ? 'border-0 bg-primary text-primary-foreground' : ''}
                  >
                    {engagementLevel === 'hot' && <Flame className="mr-1 h-3 w-3" />}
                    {engagementLevel === 'hot' ? '🔥 Muy activo' : engagementLevel === 'warm' ? '⚡ Activo' : 'Bajo'}
                  </Badge>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{opens}</span>
                    <span className="text-xs text-muted-foreground">aperturas</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{clicks}</span>
                    <span className="text-xs text-muted-foreground">clics</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full transition-all ${engagementLevel === 'hot' ? 'bg-destructive' : engagementLevel === 'warm' ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                    style={{ width: `${Math.min(engagementTotal * 10, 100)}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {(contact.listing_price || contact.source_url || contact.source_ref) && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="flex items-center gap-2 text-sm font-medium">📊 Datos del anuncio</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {contact.listing_price && (
                  <div>
                    <span className="text-xs text-muted-foreground">Precio publicado</span>
                    <p className="font-semibold">{Number(contact.listing_price).toLocaleString('es-ES')} €</p>
                  </div>
                )}
                {contact.source_ref && (
                  <div>
                    <span className="text-xs text-muted-foreground">Ref. portal</span>
                    <p className="font-mono text-xs">{contact.source_ref}</p>
                  </div>
                )}
              </div>
              {contact.source_url && (
                <a href={contact.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-primary hover:underline">
                  🔗 Ver anuncio original
                </a>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium">Notas</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{contact.notes || 'Sin notas — edita el contacto para añadir información.'}</p>
            <Separator />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Creado: {format(new Date(contact.created_at), 'dd MMM yyyy', { locale: es })}</p>
              <p>Actualizado: {format(new Date(contact.updated_at), 'dd MMM yyyy', { locale: es })}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {contact.gdpr_consent ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                Protección de datos
              </p>
              <Badge variant="outline" className={contact.gdpr_consent ? 'border-emerald-300 text-emerald-600' : 'text-muted-foreground'}>
                {contact.gdpr_legal_basis === 'explicit_consent'
                  ? 'Consentimiento explícito'
                  : contact.gdpr_legal_basis === 'contractual'
                    ? 'Base contractual'
                    : 'Interés legítimo'}
              </Badge>
            </div>
            {contact.gdpr_consent && contact.gdpr_consent_at && (
              <p className="text-xs text-muted-foreground">
                Consentimiento registrado: {format(new Date(contact.gdpr_consent_at), 'dd MMM yyyy HH:mm', { locale: es })}
                {contact.gdpr_consent_ip && ` · IP: ${contact.gdpr_consent_ip}`}
              </p>
            )}
            {!contact.gdpr_consent && canManagePrivacy && (
              <Button size="sm" variant="outline" className="text-xs" onClick={onRegisterConsent}>
                <CheckCircle className="mr-1 h-3.5 w-3.5" />Registrar consentimiento explícito
              </Button>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">No recibir comunicaciones</p>
                <p className="text-xs text-muted-foreground">Excluir de cruces, compradores y envíos automáticos</p>
              </div>
              <Switch checked={contact.opt_out || false} onCheckedChange={onToggleOptOut} />
            </div>
            {contact.opt_out && <Badge variant="destructive" className="text-xs">🔇 Opt-out activo — no recibirá comunicaciones</Badge>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContactOverviewCards;
