import { useMemo, useState } from 'react';
import { ExternalLink, Plus, Rss, User, X } from 'lucide-react';

import PhoneLink from '@/components/PhoneLink';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type PropertyStakeholdersPanelProps = {
  property: any;
  propertyOwners: any[];
  agentProfile: any;
  propertyVisits: any[];
  propertyOffers: any[];
  propertyMatches: any[];
  isAdmin: boolean;
  onNavigateContact: (contactId: string) => void;
  onRefreshOwnersOffers: () => void;
  onSaveField: (updates: Record<string, any>) => Promise<void>;
};

const PropertyStakeholdersPanel = ({
  property,
  propertyOwners,
  agentProfile,
  propertyVisits,
  propertyOffers,
  propertyMatches,
  isAdmin,
  onNavigateContact,
  onRefreshOwnersOffers,
  onSaveField,
}: PropertyStakeholdersPanelProps) => {
  const { toast } = useToast();
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [ownerSearchOpen, setOwnerSearchOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [agentSearchOpen, setAgentSearchOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [allProfiles, setAllProfiles] = useState<any[]>([]);

  const interestedBuyers = useMemo(() => {
    const buyerMap = new Map<string, { contact: any; hasVisit: boolean; hasOffer: boolean; offerAmount?: number; offerStatus?: string }>();

    propertyVisits.forEach((visit) => {
      if (!visit.contacts) return;
      const contactId = visit.contact_id;
      const existing = buyerMap.get(contactId);
      if (existing) {
        existing.hasVisit = true;
      } else {
        buyerMap.set(contactId, {
          contact: { id: contactId, full_name: visit.contacts.full_name },
          hasVisit: true,
          hasOffer: false,
        });
      }
    });

    propertyOffers.forEach((offer) => {
      if (!offer.contacts) return;
      const contactId = offer.contact_id;
      const existing = buyerMap.get(contactId);
      if (existing) {
        existing.hasOffer = true;
        existing.offerAmount = offer.amount;
        existing.offerStatus = offer.status;
      } else {
        buyerMap.set(contactId, {
          contact: offer.contacts,
          hasVisit: false,
          hasOffer: true,
          offerAmount: offer.amount,
          offerStatus: offer.status,
        });
      }
    });

    propertyMatches.forEach((match) => {
      const contactId = match.demands?.contact_id;
      const contactName = match.demands?.contacts?.full_name;
      if (!contactId || !contactName || buyerMap.has(contactId)) return;
      buyerMap.set(contactId, {
        contact: { id: contactId, full_name: contactName },
        hasVisit: false,
        hasOffer: false,
      });
    });

    return Array.from(buyerMap.values());
  }, [propertyMatches, propertyOffers, propertyVisits]);

  const handleOwnerSearch = async (value: string) => {
    setOwnerSearch(value);
    if (value.length < 2) {
      setAllContacts([]);
      return;
    }

    const { data } = await supabase
      .from('contacts')
      .select('id, full_name, contact_type, phone')
      .or(`full_name.ilike.%${value}%,phone.ilike.%${value}%,phone2.ilike.%${value}%`)
      .limit(10);

    setAllContacts(data || []);
  };

  const handleAddOwner = async (contact: any) => {
    const { error } = await supabase.from('property_owners').insert({
      property_id: property.id,
      contact_id: contact.id,
      role: 'propietario',
    } as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    if (propertyOwners.length === 0) {
      await onSaveField({ owner_id: contact.id });
    }

    toast({ title: 'Propietario añadido ✅' });
    setOwnerSearchOpen(false);
    setOwnerSearch('');
    setAllContacts([]);
    onRefreshOwnersOffers();
  };

  const handleRemoveOwner = async (ownerId: string) => {
    await supabase.from('property_owners').delete().eq('id', ownerId);
    onRefreshOwnersOffers();
    toast({ title: 'Propietario eliminado' });
  };

  const handleAgentSearch = async (value: string) => {
    setAgentSearch(value);
    if (value.length < 2) {
      setAllProfiles([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, phone, avatar_url')
      .ilike('full_name', `%${value}%`)
      .limit(10);

    setAllProfiles(data || []);
  };

  const handleAssignAgent = async (profile: any) => {
    await onSaveField({ agent_id: profile.user_id });
    setAgentSearchOpen(false);
    setAgentSearch('');
    setAllProfiles([]);
    onRefreshOwnersOffers();
  };

  return (
    <>
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Personas vinculadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">🏠 Propietarios</p>
              <Button size="sm" variant="outline" onClick={() => setOwnerSearchOpen(true)} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Añadir
              </Button>
            </div>

            {property?.xml_id && (
              property?.source_url ? (
                <a
                  href={property.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-accent/50 transition-colors group cursor-pointer"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Rss className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Feed automático XML</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">Ref. feed: {property.xml_id}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Rss className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Feed automático XML</p>
                    <p className="text-xs text-muted-foreground font-mono">Ref. feed: {property.xml_id}</p>
                  </div>
                </div>
              )
            )}

            {propertyOwners.length > 0 ? (
              <div className="space-y-2">
                {propertyOwners.map((owner) => (
                  <div
                    key={owner.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => owner.contact?.id && onNavigateContact(owner.contact.id)}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{owner.contact?.full_name}</p>
                        {property?.owner_id === owner.contact_id && (
                          <Badge variant="default" className="text-[10px] h-4 px-1.5">
                            Principal
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {owner.contact?.phone && (
                          <PhoneLink
                            phone={owner.contact.phone}
                            contactId={owner.contact.id}
                            contactName={owner.contact.full_name}
                          />
                        )}
                        {owner.contact?.email && <span>✉️ {owner.contact.email}</span>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0 capitalize">
                      {owner.role}
                    </Badge>
                    {owner.ownership_pct && (
                      <span className="text-xs text-muted-foreground">{owner.ownership_pct}%</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRemoveOwner(owner.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground flex-1">Sin propietario asignado</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">🧑‍💼 Asesor captador</p>
            {agentProfile ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  {agentProfile.avatar_url ? (
                    <img src={agentProfile.avatar_url} alt={agentProfile.full_name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{agentProfile.full_name}</p>
                  {agentProfile.phone && <p className="text-xs text-muted-foreground">{agentProfile.phone}</p>}
                </div>
                {isAdmin && (
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setAgentSearchOpen(true)}>
                    Cambiar
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground flex-1">Sin asesor asignado</p>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setAgentSearchOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Asignar
                  </Button>
                )}
              </div>
            )}
          </div>

          {interestedBuyers.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="buyers" className="border-none">
                <AccordionTrigger className="py-1 hover:no-underline">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    🛒 Compradores interesados ({interestedBuyers.length})
                  </p>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1.5 pt-1">
                    {interestedBuyers.map(({ contact, hasVisit, hasOffer, offerAmount, offerStatus }) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => onNavigateContact(contact.id)}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-sm flex-1 truncate">{contact.full_name}</p>
                        <div className="flex gap-1 shrink-0">
                          {hasVisit && <Badge variant="outline" className="text-[10px]">Visito</Badge>}
                          {hasOffer && (
                            <Badge variant={offerStatus === 'aceptada' ? 'default' : 'secondary'} className="text-[10px]">
                              Oferta {offerAmount ? `${Number(offerAmount).toLocaleString('es-ES')} €` : ''}
                            </Badge>
                          )}
                          {!hasVisit && !hasOffer && <Badge variant="secondary" className="text-[10px]">Match</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={ownerSearchOpen}
        onOpenChange={(open) => {
          setOwnerSearchOpen(open);
          setOwnerSearch('');
          setAllContacts([]);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir propietario</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar por nombre o telefono..."
            value={ownerSearch}
            onChange={(event) => void handleOwnerSearch(event.target.value)}
            autoFocus
          />
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {allContacts.map((contact) => {
              const alreadyAdded = propertyOwners.some((owner) => owner.contact_id === contact.id);
              return (
                <button
                  key={contact.id}
                  className={`w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors flex items-center gap-3 ${alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={alreadyAdded}
                  onClick={() => void handleAddOwner(contact)}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{contact.full_name}</p>
                    {contact.phone && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
                  </div>
                  {alreadyAdded ? (
                    <Badge variant="secondary" className="text-xs">Ya añadido</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">{contact.contact_type}</Badge>
                  )}
                </button>
              );
            })}
            {ownerSearch.length >= 2 && allContacts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No se encontraron contactos</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={agentSearchOpen}
        onOpenChange={(open) => {
          setAgentSearchOpen(open);
          setAgentSearch('');
          setAllProfiles([]);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar asesor captador</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar asesor por nombre..."
            value={agentSearch}
            onChange={(event) => void handleAgentSearch(event.target.value)}
            autoFocus
          />
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {allProfiles.map((profile) => (
              <button
                key={profile.user_id}
                className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors flex items-center gap-3"
                onClick={() => void handleAssignAgent(profile)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{profile.full_name}</p>
                  {profile.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
                </div>
              </button>
            ))}
            {agentSearch.length >= 2 && allProfiles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No se encontraron asesores</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PropertyStakeholdersPanel;
