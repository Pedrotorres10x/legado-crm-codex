import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import {
  User, Mail, Phone, Shield, Building2, Target, Euro, TrendingUp,
  Calendar, Handshake, Eye, Award, Flame, CheckCircle, Edit, Save,
  BarChart3, Clock, MapPin, CreditCard, Loader2,
  Globe, MessageCircle, Linkedin, Instagram, ExternalLink, Copy, Camera,
  Facebook, Share2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { COMMISSION_TIERS, getAgentTier, getNextTierLabel, fmt, calcProgressiveAgentAmount } from '@/lib/commissions';
import { useProfileData } from '@/hooks/useProfileData';
import { useHorusScoringConfig } from '@/hooks/useHorusScoringConfig';
import HorusScoringGuide from '@/components/performance/HorusScoringGuide';
import { useAgentHorusStatus } from '@/hooks/useAgentHorusStatus';
import { CRM_PUBLIC_APP_URL } from '@/lib/publicUrls';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const Profile = () => {
  const { user, isAdmin, isCoordinadora, canViewAll } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(false);

  const {
    profile,
    editForm,
    setEditForm,
    saving,
    loading,
    uploadingAvatar,
    stats,
    kpis,
    kpiTargets,
    commissions,
    semesterLabel,
    loadAll,
    handleSave,
    handleAvatarUpload,
  } = useProfileData({
    userId: user?.id,
    toast,
  });
  const { weights: horusWeights, loading: horusConfigLoading } = useHorusScoringConfig();
  const horusStatus = useAgentHorusStatus(user?.id);
  const profileData = profile as ProfileRow | null;
  const publicSlug = profileData?.public_slug;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const tier = getAgentTier(commissions.originatedAccumulated);
  const nextTierLabel = getNextTierLabel(tier.next);
  const roleLabel = isAdmin
    ? 'Admin + equipo'
    : isCoordinadora
      ? 'Coordinación + equipo'
      : 'Equipo';
  const roleVariant = canViewAll ? 'default' : 'secondary';
  const profilePersona = canViewAll && searchParams.get('persona') === 'admin' ? 'admin' : 'agent';

  return (
    <div className="space-y-6">
      {canViewAll && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Lectura separada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Puedes abrir esta ficha como agente o como admin. Es la misma persona, pero no la misma lectura.
              </p>
            </div>
            <Tabs
              value={profilePersona}
              onValueChange={(value) => setSearchParams(value === 'admin' ? { persona: 'admin' } : {})}
            >
              <TabsList>
                <TabsTrigger value="agent" className="gap-1.5">
                  <User className="h-4 w-4" />Ficha agente
                </TabsTrigger>
                <TabsTrigger value="admin" className="gap-1.5">
                  <Shield className="h-4 w-4" />Ficha admin
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Header Card */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/10" />
         <CardContent className="relative pt-0 -mt-12 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg text-2xl">
                {profileData?.avatar_url && <AvatarImage src={profileData.avatar_url} alt={profile?.full_name} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploadingAvatar ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user?.id) return;
                    handleAvatarUpload(file);
                  }}
                />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold font-display">{profile?.full_name || 'Sin nombre'}</h1>
                <Badge variant={roleVariant} className="gap-1">
                  <Shield className="h-3 w-3" />{roleLabel}
                </Badge>
                {canViewAll && (
                  <Badge variant="outline" className="gap-1">
                    {profilePersona === 'admin' ? 'Vista admin' : 'Vista agente'}
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <Award className="h-3 w-3" />{tier.label} ({tier.pct}%)
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{profileData?.email || user?.email}</span>
                {profile?.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{profile.phone}</span>}
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Desde {format(new Date(profile?.created_at || Date.now()), "MMMM yyyy", { locale: es })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {profilePersona === 'admin' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-primary" />Ficha admin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Esta lectura es la de dirección. Aquí no vienes a gestionar tu agenda como asesor, sino a mirar oficina, equipo, cuellos, stock, KPI y cierre.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Button variant="outline" className="justify-start" onClick={() => navigate('/admin')}>
                  <Shield className="mr-2 h-4 w-4" />Panel admin
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => navigate('/admin/team?tab=tracking')}>
                  <BarChart3 className="mr-2 h-4 w-4" />Seguimiento equipo
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => navigate('/admin?tab=kpis')}>
                  <Target className="mr-2 h-4 w-4" />KPI y objetivos
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => navigate('/admin?tab=commissions')}>
                  <Euro className="mr-2 h-4 w-4" />Comisiones oficina
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />Cómo vas como admin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Oficina hoy</p>
                  <p className="mt-2 text-lg font-semibold">Tu producción = oficina</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ahora mismo eres el único agente, así que tu actividad también marca la lectura global del negocio.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Producción visible</p>
                  <p className="mt-2 text-lg font-semibold">{stats.captaciones} captaciones</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stats.offers} ofertas, {stats.visits} visitas y {stats.available} inmuebles disponibles.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Lectura correcta</p>
                  <p className="mt-2 text-lg font-semibold">Separar sombreros</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Como agente miras foco, autonomía y ejecución. Como admin miras cuellos, equilibrio y prioridad de oficina.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Siguiente panel</p>
                  <p className="mt-2 text-lg font-semibold">Dashboard admin</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ahí es donde debes leerte como dirección: motor comercial, legal, cierre, stock e inbound.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
      <div className="space-y-6">
      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal" className="gap-1.5"><User className="h-4 w-4" />Datos personales</TabsTrigger>
          <TabsTrigger value="commissions" className="gap-1.5"><Euro className="h-4 w-4" />Comisiones</TabsTrigger>
        </TabsList>

        {/* PERSONAL DATA TAB */}
        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-primary" />Información personal
              </CardTitle>
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <Button size="sm" onClick={async () => {
                      const saved = await handleSave();
                      if (saved) setEditing(false);
                    }} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" />{saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
                    <Edit className="h-4 w-4" />Editar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nombre</Label>
                  {editing ? (
                    <Input value={(editForm.full_name || '').split(' ').slice(0, 1).join(' ')} onChange={e => { const last = (editForm.full_name || '').split(' ').slice(1).join(' '); setEditForm(f => ({ ...f, full_name: `${e.target.value} ${last}`.trim() })); }} placeholder="Nombre" />
                  ) : (
                    <p className="text-sm font-medium">{(profile?.full_name || '—').split(' ').slice(0, 1).join(' ')}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Apellidos</Label>
                  {editing ? (
                    <Input value={(editForm.full_name || '').split(' ').slice(1).join(' ')} onChange={e => { const first = (editForm.full_name || '').split(' ')[0] || ''; setEditForm(f => ({ ...f, full_name: `${first} ${e.target.value}`.trim() })); }} placeholder="Apellidos" />
                  ) : (
                    <p className="text-sm font-medium">{(profile?.full_name || '').split(' ').slice(1).join(' ') || '—'}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email de contacto</Label>
                  {editing ? (
                    <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
                  ) : (
                    <p className="text-sm font-medium">{profileData?.email || user?.email || '—'}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Teléfono</Label>
                  {editing ? (
                    <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                  ) : (
                    <p className="text-sm font-medium">{profile?.phone || '—'}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">DNI / NIE</Label>
                  {editing ? (
                    <Input value={editForm.id_number} onChange={e => setEditForm(f => ({ ...f, id_number: e.target.value }))} placeholder="12345678A" />
                  ) : (
                    <p className="text-sm font-medium">{profileData?.id_number || '—'}</p>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Dirección</Label>
                  {editing ? (
                    <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder="Calle, número, ciudad..." />
                  ) : (
                    <p className="text-sm font-medium">{profileData?.address || '—'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-primary" />Información profesional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Rol</p>
                  <Badge variant={roleVariant} className="gap-1">
                    <Shield className="h-3 w-3" />{roleLabel}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tramo de comisiones</p>
                  <Badge variant="outline" className="gap-1">
                    <Award className="h-3 w-3" />{tier.label} ({tier.pct}%)
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Miembro desde</p>
                  <p className="text-sm font-medium">{format(new Date(profile?.created_at || Date.now()), "d 'de' MMMM yyyy", { locale: es })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email de acceso</p>
                  <p className="text-sm font-medium">{user?.email || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta Virtual */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-5 w-5 text-primary" />Tarjeta virtual pública
              </CardTitle>
              {publicSlug && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                    const url = `https://legadocoleccion.es/agente/${publicSlug}`;
                    navigator.clipboard.writeText(url);
                    toast({ title: 'Enlace web copiado', description: 'URL directa para enviar a clientes' });
                  }}>
                    <Copy className="h-4 w-4" />Web
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                          const ogUrl = `${CRM_PUBLIC_APP_URL}/og/agent/${publicSlug}`;
                          navigator.clipboard.writeText(ogUrl);
                          toast({ title: 'Enlace redes copiado ✓', description: 'Pégalo en LinkedIn, WhatsApp o Facebook — verás preview con tu foto y bio' });
                        }}>
                          <Share2 className="h-4 w-4" />Redes
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Genera preview con foto y bio en redes sociales</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tu tarjeta virtual se genera automáticamente con tus datos. Compártela con clientes como presentación profesional.
              </p>
              {publicSlug && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-mono truncate">Legado Colección · /agente/{publicSlug}</span>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><MessageCircle className="h-3 w-3" />WhatsApp</Label>
                  {editing ? (
                    <Input value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="+34612345678" />
                  ) : (
                    <p className="text-sm font-medium">{profileData?.whatsapp || profileData?.phone || '—'}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Linkedin className="h-3 w-3" />LinkedIn</Label>
                  {editing ? (
                    <Input value={editForm.linkedin_url} onChange={e => setEditForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                  ) : (
                    <p className="text-sm font-medium truncate">{profileData?.linkedin_url || '—'}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Instagram className="h-3 w-3" />Instagram</Label>
                  {editing ? (
                    <Input value={editForm.instagram_url} onChange={e => setEditForm(f => ({ ...f, instagram_url: e.target.value }))} placeholder="https://instagram.com/..." />
                  ) : (
                    <p className="text-sm font-medium truncate">{profileData?.instagram_url || '—'}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Facebook className="h-3 w-3" />Facebook</Label>
                  {editing ? (
                    <Input value={editForm.facebook_url} onChange={e => setEditForm(f => ({ ...f, facebook_url: e.target.value }))} placeholder="https://facebook.com/..." />
                  ) : (
                    <p className="text-sm font-medium truncate">{profileData?.facebook_url || '—'}</p>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Bio / Descripción</Label>
                  {editing ? (
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editForm.bio}
                      onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                      placeholder="Breve descripción profesional para tu tarjeta pública..."
                    />
                  ) : (
                    <p className="text-sm font-medium">{profileData?.bio || '—'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMMISSIONS TAB */}
        <TabsContent value="commissions" className="space-y-6">
          <Card className="border border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Simulador real de comisión</p>
                <p className="text-sm text-muted-foreground">
                  La simulación con números reales se hace dentro de cada inmueble, para usar precio, reparto y asesores de esa operación.
                </p>
              </div>
              <Button onClick={() => navigate('/properties')} className="shrink-0">
                Abrir simulador
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="hover-lift">
              <CardContent className="p-5 text-center">
                <Euro className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-primary">{fmt(commissions.month)}</p>
                <p className="text-xs text-muted-foreground mt-1">Comisiones este mes</p>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardContent className="p-5 text-center">
                <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-primary">{fmt(commissions.semester)}</p>
                <p className="text-xs text-muted-foreground mt-1">Acumulado {semesterLabel}</p>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardContent className="p-5 text-center">
                <Award className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{tier.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{tier.pct}% sobre comisión agencia</p>
                {tier.next && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Te faltan {fmt(tier.remaining)} de comisión de agencia originada para pasar a {nextTierLabel}
                  </p>
                )}
                {!tier.next && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ya estás en el tramo más alto del semestre.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Euro className="h-5 w-5 text-primary" />Cómo se reparte tu comisión
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold">Qué premia este sistema</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aquí no solo importa cobrar operaciones. El modelo está diseñado para premiar que <span className="font-medium text-foreground">traigas negocio</span>,
                  mantengas actividad comercial y cierres bien. Por eso:
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg bg-background px-3 py-2">
                    <span className="font-semibold">Campo</span>
                    <p className="text-muted-foreground mt-1">Cobra por trabajar la operación.</p>
                  </div>
                  <div className="rounded-lg bg-background px-3 py-2">
                    <span className="font-semibold">Origen</span>
                    <p className="text-muted-foreground mt-1">Es lo que te hace subir de tramo.</p>
                  </div>
                  <div className="rounded-lg bg-background px-3 py-2">
                    <span className="font-semibold">Horus</span>
                    <p className="text-muted-foreground mt-1">Premia disciplina comercial en promedio rolling.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">Siguiente corte de comisiones</p>
                <p className="mt-1 text-sm text-emerald-700">
                  {tier.next
                    ? `Te faltan ${fmt(tier.remaining)} de comisión de agencia originada para pasar a ${nextTierLabel}.`
                    : 'Ya has alcanzado el tramo más alto del semestre con tu comisión de agencia originada.'}
                </p>
                <p className="mt-2 text-xs text-emerald-700/90">
                  Solo suman operaciones originadas por ti. Las operaciones que trabajas pero no originas te pagan, pero no te suben tramo.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-sm font-semibold">1. Comisión de agencia</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sobre la comisión total de la agencia se aplica tu tramo progresivo del semestre.
                  </p>
                  <p className="mt-3 text-sm font-medium">
                    Tramo actual: <span className="text-primary">{tier.label} ({tier.pct}%)</span>
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-sm font-semibold">2. Reparto de la operación</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                      <span>Captación / Listing</span>
                      <span className="font-semibold">60%</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                      <span>Comprador / Buying</span>
                      <span className="font-semibold">40%</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-sm font-semibold">3. Reparto dentro de cada lado</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                      <span>Trabajo de campo</span>
                      <span className="font-semibold">70%</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                      <span>Origen del contacto</span>
                      <span className="font-semibold">30%</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                En una operación compartida, primero se divide `60/40` entre captación y comprador, y luego cada parte se reparte `70/30` entre campo y origen. Si tú haces todo, te llevas el 100% de tu parte. Para subir de tramo, solo cuenta la comisión de agencia de operaciones que hayas originado tú.
              </p>
            </CardContent>
          </Card>

          {!horusConfigLoading && (
            <HorusScoringGuide
              weights={horusWeights}
              target={horusWeights.monthly_bonus_target}
              periodLabel={horusStatus.periodLabel || 'Promedio ultimos 3 meses'}
              points={horusStatus.points}
              targetLabel="de promedio rolling para cobrar el bonus Horus"
            />
          )}

          {/* Tier progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />Progreso de tramo — {semesterLabel}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Solo cuentan las comisiones de agencia de operaciones donde tú has originado el prospecto (captación o comprador). Las comisiones por trabajo de campo en operaciones de oficina o de otros agentes no suman para subir de tramo.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {COMMISSION_TIERS.map(t => {
                const acc = commissions.originatedAccumulated;
                const visualLimit = t.limit ?? t.from + 15000;
                const inTier = acc >= t.from;
                const tierAmount = Math.max(0, Math.min(acc, visualLimit) - t.from);
                const tierMax = visualLimit - t.from;
                const pct = (tierAmount / tierMax) * 100;
                return (
                  <div key={t.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={`font-medium ${inTier ? '' : 'text-muted-foreground'}`}>{t.label}</span>
                      <span className="text-muted-foreground">{fmt(tierAmount)} / {fmt(tierMax)}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                <span>Operaciones cerradas este semestre</span>
                <span>{commissions.count}</span>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            La simulación y gestión de comisiones vive en el detalle de cada inmueble.
          </p>
        </TabsContent>
      </Tabs>
      </div>
      )}
    </div>
  );
};

export default Profile;
