import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ChangeRequestButton from '@/components/ChangeRequestButton';
import ContactHealthBadge from '@/components/ContactHealthBadge';
import { hapticLight } from '@/lib/haptics';
import type { Database } from '@/integrations/supabase/types';
import { ArrowLeft, Building, CalendarClock, ChevronDown, Loader2, Mail, MapPin, MessageCircle, MessageSquare, Pencil, Phone, Plus, Receipt, Trash2, User } from 'lucide-react';

type ContactRow = Database['public']['Tables']['contacts']['Row'];

type PrimaryAction = {
  label: string;
  description: string;
  onClick: () => void;
};

type Props = {
  contact: ContactRow;
  contactHealthInfo: unknown;
  typeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  isMobile: boolean;
  isAdmin: boolean;
  isCoordinadora: boolean;
  deleteOpen: boolean;
  deleting: boolean;
  ownedPropertiesCount: number;
  primaryAction: PrimaryAction;
  topBlockers: string[];
  onBack: () => void;
  onOpenWhatsApp: () => void;
  onOpenInteraction: () => void;
  onOpenEdit: () => void;
  onOpenDeleteChange: (open: boolean) => void;
  onDeleteContact: () => void;
  onOpenTask: () => void;
  onOpenFaktura: () => void;
  onOpenPropertiesTab: () => void;
  onNeedsMortgageChange: (checked: boolean) => void;
  onFetchSummary: () => void;
  summaryLoading: boolean;
};

export default function ContactDetailHero({
  contact,
  contactHealthInfo,
  typeLabels,
  statusLabels,
  isMobile,
  isAdmin,
  isCoordinadora,
  deleteOpen,
  deleting,
  ownedPropertiesCount,
  primaryAction,
  topBlockers,
  onBack,
  onOpenWhatsApp,
  onOpenInteraction,
  onOpenEdit,
  onOpenDeleteChange,
  onDeleteContact,
  onOpenTask,
  onOpenFaktura,
  onOpenPropertiesTab,
  onNeedsMortgageChange,
  onFetchSummary,
  summaryLoading,
}: Props) {
  if (isMobile) {
    return (
      <div className="rounded-3xl bg-card border border-border/60 overflow-hidden shadow-sm animate-fade-in-up -mx-0">
        <div className="px-5 pt-5 pb-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-[18px] leading-tight truncate">{contact.full_name}</h2>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabels[contact.contact_type] || contact.contact_type}</Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{statusLabels[contact.status] || contact.status}</Badge>
              <ContactHealthBadge info={contactHealthInfo} className="text-[10px] px-1.5 py-0" />
            </div>
          </div>
        </div>

        {(contact.phone || contact.email || contact.city) && (
          <div className="px-5 pb-3 space-y-1.5">
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.city && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{contact.city}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-px bg-border/40 border-t border-border/40">
          {contact.phone && (
            <button
              onClick={() => { hapticLight(); onOpenWhatsApp(); }}
              className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare className="h-[18px] w-[18px] text-emerald-600" />
              </div>
              <span className="text-[11px] font-medium text-foreground">WhatsApp</span>
            </button>
          )}
          {ownedPropertiesCount > 0 ? (
            <button
              onClick={() => { hapticLight(); onOpenPropertiesTab(); }}
              className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Building className="h-[18px] w-[18px] text-primary" />
              </div>
              <span className="text-[11px] font-medium text-foreground">Inmuebles ({ownedPropertiesCount})</span>
            </button>
          ) : (
            <button
              onClick={() => { hapticLight(); onOpenInteraction(); }}
              className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-[18px] w-[18px] text-primary" />
              </div>
              <span className="text-[11px] font-medium text-foreground">Interacción</span>
            </button>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 bg-muted/30">
          <Button size="sm" variant="outline" className="flex-1 text-xs h-9" onClick={() => { hapticLight(); onOpenInteraction(); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />Interacción
          </Button>
          {(isAdmin || isCoordinadora) && (
            <Button size="sm" variant="outline" className="flex-1 text-xs h-9" onClick={() => { hapticLight(); onOpenEdit(); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" />Editar
            </Button>
          )}
          {isAdmin && (
            <AlertDialog open={deleteOpen} onOpenChange={onOpenDeleteChange}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs h-9 text-destructive hover:text-destructive" onClick={() => hapticLight()}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
                  <AlertDialogDescription>Se eliminará permanentemente a <strong>{contact.full_name}</strong> y no se podrá recuperar.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteContact} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <ChangeRequestButton entityType="contact" entityId={contact.id} entityLabel={contact.full_name} size="sm" className="flex-1 text-xs h-9" />
          <Button size="sm" variant="outline" className="flex-1 text-xs h-9" onClick={() => { hapticLight(); onOpenTask(); }}>
            <CalendarClock className="h-3.5 w-3.5 mr-1" />Tarea
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs h-9" onClick={() => { hapticLight(); onOpenFaktura(); }}>
            <Receipt className="h-3.5 w-3.5 mr-1" />Faktura
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <Card className="border-border/60 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-bold tracking-tight">{contact.full_name}</h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{typeLabels[contact.contact_type] || contact.contact_type}</Badge>
                    <Badge variant="secondary">{statusLabels[contact.status] || contact.status}</Badge>
                    <ContactHealthBadge info={contactHealthInfo} />
                    {contact.pipeline_stage && contact.pipeline_stage.toLowerCase() !== (statusLabels[contact.status] || contact.status).toLowerCase() && <Badge className="bg-primary text-primary-foreground border-0">{contact.pipeline_stage}</Badge>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                {contact.phone && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm">
                    <Phone className="h-3.5 w-3.5" />
                    {contact.phone}
                  </span>
                )}
                {contact.email && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm">
                    <Mail className="h-3.5 w-3.5" />
                    {contact.email}
                  </span>
                )}
                {contact.city && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    {contact.city}
                  </span>
                )}
              </div>
            </div>

            {(contact.contact_type === 'comprador' || contact.contact_type === 'ambos') && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <Checkbox
                  id="needs_mortgage"
                  checked={contact.needs_mortgage || false}
                  onCheckedChange={(checked) => onNeedsMortgageChange(Boolean(checked))}
                />
                <label htmlFor="needs_mortgage" className="text-sm text-muted-foreground cursor-pointer select-none">Necesita hipoteca</label>
                {contact.needs_mortgage && <Badge variant="outline" className="text-warning border-warning">Hipoteca</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_45%),linear-gradient(135deg,rgba(99,102,241,0.05),rgba(255,255,255,0.98))] shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                Ahora mismo
              </div>
              <div>
                <h2 className="max-w-[26rem] text-[1.35rem] font-display font-semibold tracking-tight text-foreground">Que haria ahora con este contacto</h2>
                <p className="mt-1.5 max-w-[34rem] text-sm leading-6 text-muted-foreground">{primaryAction.description}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-background/85 p-5 shadow-sm">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Siguiente accion</p>
                  <p className="text-base font-semibold text-foreground">{primaryAction.label}</p>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {topBlockers.length > 0 ? (
                    topBlockers.map((blocker) => (
                      <p key={blocker} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{blocker}</span>
                      </p>
                    ))
                  ) : (
                    <p>La ficha esta bien orientada. Ahora toca empujar la siguiente accion comercial.</p>
                  )}
                </div>
                <Button className="min-w-[220px]" onClick={primaryAction.onClick}>{primaryAction.label}</Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {contact.phone && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenWhatsApp}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Acciones
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={onOpenInteraction}>
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar interacción
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenTask}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Crear tarea
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenFaktura}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Generar Faktura
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onFetchSummary} disabled={summaryLoading}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Resumen IA
                  </DropdownMenuItem>
                  {(isAdmin || isCoordinadora) && (
                    <DropdownMenuItem onClick={onOpenEdit}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar contacto
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <ChangeRequestButton entityType="contact" entityId={contact.id} entityLabel={contact.full_name} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
