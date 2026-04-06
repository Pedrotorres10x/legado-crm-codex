import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock, LayoutGrid, List, Loader2, Mail, Phone, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PhoneLink from '@/components/PhoneLink';
import HealthDot from '@/components/HealthDot';
import ContactHealthBadge from '@/components/ContactHealthBadge';
import { CONTACTS_PAGE_SIZE } from '@/hooks/useContactsPipeline';
import { getRelationshipTier, isInfluenceCircleContact } from '@/lib/agent-influence-circle';
import type { HealthInfo } from '@/hooks/useHealthColors';

type ContactListItem = {
  id: string;
  full_name: string;
  pipeline_stage: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  contact_type: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

interface ContactsListPanelProps {
  contacts: ContactListItem[];
  isMobile: boolean;
  pipelineStages: Array<{ key: string; label: string; color: string }>;
  healthColors: Record<string, HealthInfo | undefined>;
  onOpenVisits: (contactId: string) => void;
  onOpenSummary: (contactId: string) => void;
  summaryLoading: boolean;
  summaryOpen: string | null;
  onPhoneLogged: () => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalCount: number;
  typeLabels: Record<string, string>;
  showCircleMeta?: boolean;
  circleMeta?: Record<string, { tier: 'oro' | 'plata' | 'bronce'; validation: 'validado' | 'potencial' | 'sin_validar' }>;
}

const ContactsListPanel = ({
  contacts,
  isMobile,
  pipelineStages,
  healthColors,
  onOpenVisits,
  onOpenSummary,
  summaryLoading,
  summaryOpen,
  onPhoneLogged,
  currentPage,
  setCurrentPage,
  totalCount,
  typeLabels,
  showCircleMeta = false,
  circleMeta = {},
}: ContactsListPanelProps) => {
  const navigate = useNavigate();
  const tierStyles: Record<string, string> = {
    oro: 'bg-amber-500 text-white border-0',
    plata: 'bg-slate-400 text-white border-0',
    bronce: 'bg-orange-700 text-white border-0',
  };
  const validationStyles: Record<string, string> = {
    validado: 'bg-emerald-500 text-white border-0',
    potencial: 'bg-blue-500 text-white border-0',
    sin_validar: 'bg-muted text-muted-foreground border-border',
  };
  const tierLabels: Record<string, string> = { oro: 'Oro', plata: 'Plata', bronce: 'Bronce' };
  const validationLabels: Record<string, string> = {
    validado: 'Validado',
    potencial: 'Potencial',
    sin_validar: 'Sin validar',
  };

  if (contacts.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-muted/20">
        <CardContent className="py-16 text-center">
          <LayoutGrid className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Sin resultados</p>
          <p className="mt-1 text-sm text-muted-foreground/60">Prueba a cambiar los filtros o la búsqueda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {isMobile ? (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const stageInfo = pipelineStages.find((stage) => stage.key === contact.pipeline_stage);
            const circleInfo = circleMeta[contact.id];
            const belongsToCircle = isInfluenceCircleContact(contact);
            const listCircleTier = circleInfo?.tier ?? (belongsToCircle ? getRelationshipTier(contact) : null);
            return (
              <div
                key={contact.id}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3.5 shadow-sm"
              >
                <button
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 transition-transform active:scale-95"
                >
                  <span className="text-base font-bold text-primary">{contact.full_name.charAt(0).toUpperCase()}</span>
                </button>
                <button
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                  className="min-w-0 flex-1 text-left transition-opacity active:opacity-70"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{contact.full_name}</span>
                    <HealthDot info={healthColors[contact.id]} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {healthColors[contact.id] && <ContactHealthBadge info={healthColors[contact.id]} className="text-[10px] px-1.5 py-0" />}
                    {belongsToCircle && (
                      <Badge className="border-0 bg-primary text-primary-foreground px-1.5 py-0 text-[10px]">
                        Círculo de influencia
                      </Badge>
                    )}
                    {belongsToCircle && listCircleTier && (
                      <Badge className={tierStyles[listCircleTier]}>{tierLabels[listCircleTier]}</Badge>
                    )}
                    {stageInfo && (
                      <Badge className={`${stageInfo.color} border-0 px-1.5 py-0 text-[10px] text-white`}>
                        {stageInfo.label}
                      </Badge>
                    )}
                    {showCircleMeta && circleInfo && (
                      <>
                        <Badge className={tierStyles[circleInfo.tier]}>{tierLabels[circleInfo.tier]}</Badge>
                        <Badge className={validationStyles[circleInfo.validation]}>{validationLabels[circleInfo.validation]}</Badge>
                      </>
                    )}
                    {contact.city && <span className="text-[11px] text-muted-foreground">{contact.city}</span>}
                  </div>
                  {contact.phone && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </span>
                  )}
                </button>
                <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                  {contact.phone ? (
                    <PhoneLink phone={contact.phone} contactId={contact.id} contactName={contact.full_name} onLogged={onPhoneLogged} iconOnly />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40">
                      <Phone className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Salud</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Tipo</TableHead>
                {showCircleMeta && <TableHead>Circulo</TableHead>}
                {showCircleMeta && <TableHead>Validacion</TableHead>}
                <TableHead>Contacto</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const stageInfo = pipelineStages.find((stage) => stage.key === contact.pipeline_stage);
                const circleInfo = circleMeta[contact.id];
                const belongsToCircle = isInfluenceCircleContact(contact);
                const listCircleTier = circleInfo?.tier ?? (belongsToCircle ? getRelationshipTier(contact) : null);
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="cursor-pointer font-medium transition-colors hover:text-primary" onClick={() => navigate(`/contacts/${contact.id}`)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{contact.full_name}</span>
                        {belongsToCircle && (
                          <Badge className="border-0 bg-primary text-primary-foreground">Círculo de influencia</Badge>
                        )}
                        {belongsToCircle && listCircleTier && (
                          <Badge className={tierStyles[listCircleTier]}>{tierLabels[listCircleTier]}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><HealthDot info={healthColors[contact.id]} /></TableCell>
                    <TableCell>{healthColors[contact.id] ? <ContactHealthBadge info={healthColors[contact.id]} /> : '-'}</TableCell>
                    <TableCell>
                      {stageInfo && <Badge className={`${stageInfo.color} border-0 text-white`}>{stageInfo.label}</Badge>}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{typeLabels[contact.contact_type] || contact.contact_type}</span>
                    </TableCell>
                    {showCircleMeta && (
                      <TableCell>
                        {circleInfo ? <Badge className={tierStyles[circleInfo.tier]}>{tierLabels[circleInfo.tier]}</Badge> : '-'}
                      </TableCell>
                    )}
                    {showCircleMeta && (
                      <TableCell>
                        {circleInfo ? <Badge className={validationStyles[circleInfo.validation]}>{validationLabels[circleInfo.validation]}</Badge> : '-'}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {contact.phone && <PhoneLink phone={contact.phone} contactId={contact.id} contactName={contact.full_name} onLogged={onPhoneLogged} />}
                        {contact.phone2 && <PhoneLink phone={contact.phone2} contactId={contact.id} contactName={contact.full_name} onLogged={onPhoneLogged} />}
                        {contact.email && <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{contact.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell>{contact.city || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(contact.tags || []).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {contact.phone ? (
                          <PhoneLink phone={contact.phone} contactId={contact.id} contactName={contact.full_name} onLogged={onPhoneLogged} iconOnly />
                        ) : (
                          <Button variant="ghost" size="sm" disabled title="Sin teléfono">
                            <Phone className="h-3.5 w-3.5 opacity-30" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => onOpenVisits(contact.id)} title="Ver visitas">
                          <Calendar className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenSummary(contact.id)}
                          disabled={summaryLoading && summaryOpen === contact.id}
                          title="Resumen IA"
                        >
                          {summaryLoading && summaryOpen === contact.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalCount > CONTACTS_PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * CONTACTS_PAGE_SIZE + 1}–{Math.min(currentPage * CONTACTS_PAGE_SIZE, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(Math.ceil(totalCount / CONTACTS_PAGE_SIZE), 5) }, (_, index) => {
              const totalPages = Math.ceil(totalCount / CONTACTS_PAGE_SIZE);
              const page = totalPages <= 5 ? index + 1 : currentPage <= 3 ? index + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + index : currentPage - 2 + index;
              return (
                <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="icon" onClick={() => setCurrentPage(page)} className="h-9 w-9 text-xs">
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === Math.ceil(totalCount / CONTACTS_PAGE_SIZE)}
              onClick={() => setCurrentPage((page) => page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsListPanel;
