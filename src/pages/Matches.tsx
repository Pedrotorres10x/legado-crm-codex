import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Handshake, Zap, Sparkles, Loader2, MessageCircle, Mail, Plus, Calendar, Euro, CheckCircle, Clock, Copy, Search, ChevronLeft, ChevronRight, Megaphone, Target, LayoutDashboard } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ViewToggle from '@/components/ViewToggle';
import { useToast } from '@/hooks/use-toast';
import { useMatchesActions } from '@/hooks/useMatchesActions';
import { buildTopReasons, extractMatchDiscardReason, extractOfferLossReason } from '@/lib/commercial-loss-reasons';
import { VISIT_RESULT_OPTIONS } from '@/lib/horus-model';

import { useAuth } from '@/contexts/AuthContext';
import AgentFilter from '@/components/AgentFilter';
import { lazy, Suspense } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ClassificationCampaign from '@/components/ClassificationCampaign';
import AISectionGuide from '@/components/ai/AISectionGuide';
import { useWorkspacePersona } from '@/hooks/useWorkspacePersona';
import {
  MatchAiScoringDialog,
  MatchDiscardDialog,
  MatchOfferDialog,
  MatchOfferResolutionDialog,
  MatchVisitConfirmationDialog,
  MatchVisitDialog,
} from '@/components/matches/MatchesDialogs';
const CampaignDashboard = lazy(() => import('@/components/CampaignDashboard'));
const DemandEnrichCampaign = lazy(() => import('@/components/DemandEnrichCampaign'));

const statusLabels: Record<string, string> = { pendiente: 'Pendiente', enviado: 'Enviado', interesado: 'Interesado', descartado: 'Descartado' };
const statusColors: Record<string, string> = { pendiente: 'bg-warning', enviado: 'bg-info', interesado: 'bg-success', descartado: 'bg-muted' };

const visitResults = [
  { value: 'seguimiento', label: 'Seguimiento', color: 'bg-sky-600' },
  { value: 'segunda_visita', label: 'Segunda visita', color: 'bg-indigo-600' },
  { value: 'oferta', label: 'Oferta', color: 'bg-emerald-600' },
  { value: 'reserva', label: 'Reserva', color: 'bg-green-700' },
  { value: 'sin_interes', label: 'Sin interés', color: 'bg-muted' },
  { value: 'cancelada', label: 'Cancelada', color: 'bg-destructive' },
  { value: 'no_show', label: 'No Show', color: 'bg-warning' },
  { value: 'realizada', label: 'Realizada', color: 'bg-emerald-500' },
];

const offerStatuses = [
  { value: 'presentada', label: 'Presentada' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'contraoferta', label: 'Contraoferta' },
  { value: 'retirada', label: 'Retirada' },
  { value: 'expirada', label: 'Expirada' },
];

type MatchStatus = Database['public']['Tables']['matches']['Row']['status'];
type MatchUpdate = Database['public']['Tables']['matches']['Update'];
type MatchProperty = Pick<
  Database['public']['Tables']['properties']['Row'],
  'title' | 'city' | 'province' | 'price' | 'bedrooms' | 'surface_area' | 'property_type' | 'operation'
>;
type MatchDemandContact = Pick<
  Database['public']['Tables']['contacts']['Row'],
  'id' | 'full_name' | 'phone' | 'email' | 'agent_id'
>;
type MatchDemand = Pick<
  Database['public']['Tables']['demands']['Row'],
  'id' | 'contact_id' | 'agent_id' | 'is_active' | 'auto_match' | 'operation' | 'property_type' | 'property_types' | 'cities' | 'zones' | 'min_price' | 'max_price' | 'min_bedrooms'
> & {
  contacts: MatchDemandContact | null;
};
type MatchRow = Pick<
  Database['public']['Tables']['matches']['Row'],
  'id' | 'agent_id' | 'demand_id' | 'property_id' | 'compatibility' | 'status' | 'notes'
> & {
  demands: MatchDemand | null;
  properties: MatchProperty | null;
};
type VisitRow = Pick<
  Database['public']['Tables']['visits']['Row'],
  'id' | 'agent_id' | 'visit_date' | 'result' | 'confirmation_status' | 'confirmation_token'
> & {
  properties: Pick<Database['public']['Tables']['properties']['Row'], 'title'> | null;
  contacts: Pick<Database['public']['Tables']['contacts']['Row'], 'full_name' | 'phone' | 'email'> | null;
};
type OfferRow = Pick<
  Database['public']['Tables']['offers']['Row'],
  'id' | 'agent_id' | 'status' | 'notes' | 'amount'
> & {
  properties: Pick<Database['public']['Tables']['properties']['Row'], 'title'> | null;
  contacts: Pick<Database['public']['Tables']['contacts']['Row'], 'full_name'> | null;
};
type SimpleProperty = Pick<Database['public']['Tables']['properties']['Row'], 'id' | 'title'>;
type SimpleContact = Pick<Database['public']['Tables']['contacts']['Row'], 'id' | 'full_name' | 'phone' | 'email'>;
type AiScoringResult = {
  score?: number;
  error?: string;
  [key: string]: unknown;
};
type MatchGroup = {
  id: string;
  contactId: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  demandId: string | null;
  demand: MatchDemand | null;
  matches: MatchRow[];
};

const Matches = () => {
  const { toast } = useToast();
  const { user, canViewAll } = useAuth();
  const { isAgentMode } = useWorkspacePersona(canViewAll);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [demandsList, setDemandsList] = useState<MatchDemand[]>([]);
  const [matchesCount, setMatchesCount] = useState(0);
  const [matchesPage, setMatchesPage] = useState(0);
  const MATCHES_PER_PAGE = 50;
  const [running, setRunning] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchText, setSearchText] = useState('');
  const [matchDiscardDialog, setMatchDiscardDialog] = useState<{ id: string; notes?: string | null } | null>(null);
  const [matchDiscardReason, setMatchDiscardReason] = useState('');

  // Visits & Offers state
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [properties, setProperties] = useState<SimpleProperty[]>([]);
  const [contactsList, setContactsList] = useState<SimpleContact[]>([]);
  const fetchMatches = useCallback(async () => {
    const { data, count } = await supabase
      .from('matches')
      .select('id, agent_id, demand_id, property_id, compatibility, status, notes, demands(id, contact_id, agent_id, is_active, auto_match, operation, property_type, property_types, cities, zones, min_price, max_price, min_bedrooms, contacts(id, full_name, phone, email, agent_id)), properties(title, city, province, price, bedrooms, surface_area, property_type, operation)', { count: 'exact' })
      .order('compatibility', { ascending: false });
    setMatches((data as MatchRow[] | null) || []);
    setMatchesCount(count || 0);
  }, []);

  const fetchDemands = useCallback(async () => {
    const { data } = await supabase
      .from('demands')
      .select('id, contact_id, agent_id, is_active, auto_match, operation, property_type, property_types, cities, zones, min_price, max_price, min_bedrooms, contacts(id, full_name, phone, email, agent_id)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setDemandsList((data as MatchDemand[] | null) || []);
  }, []);

  const fetchSalesData = useCallback(async () => {
    const [v, o, p, c] = await Promise.all([
      supabase.from('visits').select('*, properties(title), contacts(full_name, phone, email)').order('visit_date', { ascending: false }),
      supabase.from('offers').select('*, properties(title), contacts(full_name)').order('created_at', { ascending: false }),
      supabase.from('properties').select('id, title').eq('status', 'disponible'),
      supabase.from('contacts').select('id, full_name, phone, email'),
    ]);
    setVisits((v.data as VisitRow[] | null) || []);
    setOffers((o.data as OfferRow[] | null) || []);
    setProperties((p.data as SimpleProperty[] | null) || []);
    setContactsList((c.data as SimpleContact[] | null) || []);
  }, []);

  useEffect(() => {
    void fetchMatches();
    void fetchDemands();
    void fetchSalesData();
  }, [fetchDemands, fetchMatches, fetchSalesData]);

  useEffect(() => {
    void matchesPage;
    void fetchMatches();
  }, [fetchMatches, matchesPage]);

  const {
    visitDialog,
    setVisitDialog,
    offerDialog,
    setOfferDialog,
    offerResolutionDialog,
    setOfferResolutionDialog,
    offerLossReason,
    setOfferLossReason,
    sendDialog,
    setSendDialog,
    formLoading,
    visitForm,
    setVisitForm,
    offerForm,
    setOfferForm,
    addVisit,
    updateVisitResult,
    sendVisitWhatsApp,
    copyLink,
    addOffer,
    updateOfferStatus,
    requestOfferStatusChange,
  } = useMatchesActions({
    userId: user?.id,
    toast,
    onRefresh: fetchSalesData,
  });

  // ─── Matches logic ───
  const runCrossing = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-full-crossing');
      if (error) throw error;
      toast({
        title: 'Cruce completado',
        description: `${data.matched} coincidencias nuevas · ${data.skipped} ya existían`,
      });
      setMatchesPage(0);
      void fetchMatches();
      void fetchDemands();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo ejecutar el cruce',
        variant: 'destructive',
      });
    }
    setRunning(false);
  };

  const buildMessage = (match: MatchRow) => {
    const property = match.properties;
    const contact = match.demands?.contacts?.full_name || 'Cliente';
    const price = property?.price ? `${Number(property.price).toLocaleString('es-ES')} €` : '';
    const lines = [
      `Hola ${contact}! 👋`,
      `Te escribo porque tenemos una propiedad que puede interesarte:`,
      '',
      `🏠 *${property?.title || 'Propiedad'}*`,
      property?.city ? `📍 ${property.city}` : '',
      price ? `💰 ${price}` : '',
      property?.bedrooms ? `🛏️ ${property.bedrooms} habitaciones` : '',
      property?.surface_area ? `📐 ${Number(property.surface_area)} m²` : '',
      '',
      `¿Te gustaría recibir más información o concertar una visita?`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const sendMatchWhatsApp = async (match: MatchRow) => {
    const contactId = match.demands?.contacts?.id || match.demands?.contact_id;
    if (!contactId) { toast({ title: 'Sin contacto', description: 'No se pudo identificar el contacto', variant: 'destructive' }); return; }
    const msg = buildMessage(match);
    try {
      const { data, error } = await supabase.functions.invoke('multichannel-send', {
        body: { channel: 'whatsapp', contact_id: contactId, text: msg, source: 'cruces', campaign: 'cruces' },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Error enviando WhatsApp');
      toast({ title: '✅ WhatsApp enviado', description: `Mensaje enviado a ${match.demands?.contacts?.full_name || 'contacto'}` });
    } catch (error) {
      toast({
        title: 'Error WhatsApp',
        description: error instanceof Error ? error.message : 'No se pudo enviar el WhatsApp',
        variant: 'destructive',
      });
    }
    await updateMatchStatus(match.id, 'enviado');
  };

  const sendMatchEmail = async (match: MatchRow) => {
    const email = match.demands?.contacts?.email;
    if (!email) { toast({ title: 'Sin email', description: 'El contacto no tiene email registrado', variant: 'destructive' }); return; }
    const subject = encodeURIComponent(`Propiedad que puede interesarte: ${match.properties?.title || ''}`);
    const body = encodeURIComponent(buildMessage(match));
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    await updateMatchStatus(match.id, 'enviado');
  };

  const requestMatchStatusChange = (match: MatchRow, status: string) => {
    if (status === 'descartado') {
      setMatchDiscardDialog({ id: match.id, notes: match.notes || null });
      setMatchDiscardReason('');
      return;
    }

    void updateMatchStatus(match.id, status);
  };

  const updateMatchStatus = async (id: string, status: MatchStatus | string, discardReason?: string) => {
    const payload: MatchUpdate = { status: status as MatchStatus };

    if (status === 'descartado' && matchDiscardDialog?.id === id) {
      const cleanLines = (matchDiscardDialog.notes || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith('Motivo de descarte:'));

      if (discardReason) {
        cleanLines.push(`Motivo de descarte: ${discardReason}`);
      }

      payload.notes = cleanLines.join('\n');
    }

    await supabase.from('matches').update(payload).eq('id', id);
    setMatchDiscardDialog(null);
    setMatchDiscardReason('');
    await fetchMatches();
  };

  const [aiScoringId, setAiScoringId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiScoringResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runAIScoring = async (match: MatchRow) => {
    setAiScoringId(match.id);
    setAiLoading(true);
    setAiResult(null);
    try {
      const [dRes, pRes] = await Promise.all([
        supabase.from('demands').select('*').eq('id', match.demand_id).single(),
        supabase.from('properties').select('*').eq('id', match.property_id).single(),
      ]);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-scoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ demand: dRes.data, property: pRes.data }),
      });
      const data = (await resp.json()) as AiScoringResult;
      if (data.error) { toast({ title: 'Error IA', description: data.error, variant: 'destructive' }); setAiScoringId(null); }
      else {
        setAiResult(data);
        if (data.score) {
          await supabase.from('matches').update({ compatibility: data.score }).eq('id', match.id);
          await fetchMatches();
        }
      }
    } catch { toast({ title: 'Error', description: 'No se pudo conectar con IA', variant: 'destructive' }); setAiScoringId(null); }
    setAiLoading(false);
  };

  const confirmBadge = (status: string) => {
    if (status === 'confirmado') return <Badge className="bg-emerald-600 text-white border-0"><CheckCircle className="h-3 w-3 mr-1" />Confirmado</Badge>;
    return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
  };

  const resultBadge = (result: string | null) => {
    if (!result) return <span className="text-xs text-muted-foreground">—</span>;
    const r = visitResults.find(vr => vr.value === result);
    return r ? <Badge className={`${r.color} text-white border-0`}>{r.label}</Badge> : <Badge variant="outline">{result}</Badge>;
  };

  const filteredVisits = showAll ? visits : visits.filter(v => v.agent_id === user?.id);
  const filteredOffers = showAll ? offers : offers.filter(o => o.agent_id === user?.id);
  const baseMatches = showAll ? matches : matches.filter(m => m.agent_id === user?.id);
  const pendingVisitConfirmations = filteredVisits.filter(v => v.confirmation_status === 'pendiente').length;
  const visitsWithoutResult = filteredVisits.filter(v => !v.result).length;
  const pendingOffers = filteredOffers.filter(o => ['presentada', 'pendiente'].includes(o.status)).length;
  const activeNegotiations = filteredOffers.filter(o => ['presentada', 'pendiente', 'contraoferta'].includes(o.status)).length;
  const topMatchLossReasons = buildTopReasons(
    baseMatches
      .filter((match) => match.status === 'descartado')
      .map((match) => extractMatchDiscardReason(match.notes))
  );
  const topOfferLossReasons = buildTopReasons(
    filteredOffers
      .filter((offer) => ['rechazada', 'retirada', 'expirada'].includes(offer.status))
      .map((offer) => extractOfferLossReason(offer.notes))
  );

  const demandCardsBase = showAll
    ? demandsList
    : demandsList.filter((demand) => demand.contacts?.id === user?.id || demand.agent_id === user?.id || demand.contacts?.agent_id === user?.id);

  const filteredMatches = (() => {
    if (!searchText || searchText.length < 2) return baseMatches;
    const q = searchText.toLowerCase();
    return baseMatches.filter(m => {
      const propTitle = (m.properties?.title || '').toLowerCase();
      const propCity = (m.properties?.city || '').toLowerCase();
      const contactName = (m.demands?.contacts?.full_name || '').toLowerCase();
      return propTitle.includes(q) || propCity.includes(q) || contactName.includes(q);
    });
  })();

  const groupedMatches = useMemo(() => {
    const groupedMatchMap = new Map<string, MatchRow[]>();

    for (const match of filteredMatches) {
      const demandId = match.demand_id || match.demands?.id || null;
      const contactId = match.demands?.contact_id || match.demands?.contacts?.id || null;
      const key = demandId || contactId || match.id;
      const existing = groupedMatchMap.get(key) || [];
      existing.push(match);
      groupedMatchMap.set(key, existing);
    }

    const filteredDemandCards = (() => {
      if (!searchText || searchText.length < 2) return demandCardsBase;
      const q = searchText.toLowerCase();
      return demandCardsBase.filter((demand) => {
        const contactName = (demand.contacts?.full_name || '').toLowerCase();
        const contactEmail = (demand.contacts?.email || '').toLowerCase();
        const cities = Array.isArray(demand.cities) ? demand.cities.join(' ').toLowerCase() : '';
        const zones = Array.isArray(demand.zones) ? demand.zones.join(' ').toLowerCase() : '';
        return contactName.includes(q) || contactEmail.includes(q) || cities.includes(q) || zones.includes(q);
      });
    })();

    const groups = new Map<string, MatchGroup>();

    for (const match of filteredMatches) {
      const contactId = match.demands?.contact_id || match.demands?.contacts?.id || null;
      const demandId = match.demand_id || match.demands?.id || null;
      const key = demandId || contactId || match.id;
      const existingMatches = [...(groupedMatchMap.get(key) || [])].sort((a, b) => (b.compatibility || 0) - (a.compatibility || 0));

      groups.set(key, {
        id: key,
        contactId,
        contactName: match.demands?.contacts?.full_name || 'Contacto',
        contactPhone: match.demands?.contacts?.phone || null,
        contactEmail: match.demands?.contacts?.email || null,
        demandId,
        demand: match.demands || null,
        matches: existingMatches,
      });
    }

    for (const demand of filteredDemandCards) {
      const contactId = demand.contact_id || demand.contacts?.id || null;
      const demandId = demand.id || null;
      const key = demandId || contactId || `demand-${demand.id}`;
      if (groups.has(key)) {
        const existing = groups.get(key)!;
        existing.demand = existing.demand || demand;
        existing.contactId = existing.contactId || contactId;
        existing.contactName = existing.contactName || demand.contacts?.full_name || 'Contacto';
        existing.contactPhone = existing.contactPhone || demand.contacts?.phone || null;
        existing.contactEmail = existing.contactEmail || demand.contacts?.email || null;
        continue;
      }
      groups.set(key, {
        id: key,
        contactId,
        contactName: demand.contacts?.full_name || 'Contacto',
        contactPhone: demand.contacts?.phone || null,
        contactEmail: demand.contacts?.email || null,
        demandId,
        demand,
        matches: [...(groupedMatchMap.get(key) || [])].sort((a, b) => (b.compatibility || 0) - (a.compatibility || 0)),
      });
    }

    return Array.from(groups.values())
      .sort((a, b) => {
        const aScore = a.matches[0]?.compatibility || 0;
        const bScore = b.matches[0]?.compatibility || 0;
        if (bScore !== aScore) return bScore - aScore;
        return a.contactName.localeCompare(b.contactName, 'es');
      });
  }, [filteredMatches, demandCardsBase, searchText]);

  const showBackofficeTabs = canViewAll && !isAgentMode;
  const defaultTab = showBackofficeTabs ? 'dashboard' : 'matches';

  return (
    <div className="space-y-4 md:space-y-6">
      <AISectionGuide
        title="Compradores y cruces: aqui conviertes interes en oferta"
        context="Aqui trabajas compradores contra producto: visitas, seguimiento, oferta, contraoferta y descarte."
        doNow={`Ahora mismo tienes ${visitsWithoutResult} visita${visitsWithoutResult === 1 ? '' : 's'} sin resultado, ${activeNegotiations} negociacion${activeNegotiations === 1 ? '' : 'es'} viva${activeNegotiations === 1 ? '' : 's'} y ${pendingOffers} oferta${pendingOffers === 1 ? '' : 's'} pendiente${pendingOffers === 1 ? '' : 's'}. Empieza por ahi.`}
        dontForget="Una visita sin resultado no ensena nada. Una oferta sin contexto tampoco. Aqui se ve si negocias de verdad o solo ensenas."
        risk="Si no registras bien visitas y ofertas, el CRM no puede decirte por que no cierras y perderas arras por seguimiento flojo."
        actions={[
          { label: 'Que hago primero aqui', description: 'Revisa visitas pendientes, ofertas presentadas y contactos que ya deberian estar en segunda visita u oferta.' },
          { label: 'Que mira direccion aqui', description: 'Si conviertes visitas en oferta, si negocias bien y si llevas producto a arras.' },
          { label: 'Que error evitar', description: 'Hacer visitas y no marcar si hubo seguimiento, segunda visita, oferta o descarte real.' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Compradores y cruces</h1>
          <p className="text-sm text-muted-foreground">
            {showBackofficeTabs
              ? 'Clasificación, enriquecimiento y cruces'
              : 'Visitas, ofertas, seguimiento y cruces para mover compradores y cerrar.'}
          </p>
        </div>
        <AgentFilter showAll={showAll} onToggle={setShowAll} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Buscar por propiedad, contacto, ciudad..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
      </div>

      <Tabs defaultValue={defaultTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="dashboard" className="text-xs md:text-sm"><LayoutDashboard className="h-4 w-4 mr-1" />Actividad comercial</TabsTrigger>
            {showBackofficeTabs && (
              <TabsTrigger value="classify" className="text-xs md:text-sm"><Megaphone className="h-4 w-4 mr-1" />Clasificación</TabsTrigger>
            )}
            {showBackofficeTabs && (
              <TabsTrigger value="enrich" className="text-xs md:text-sm"><Target className="h-4 w-4 mr-1" />Enriquecimiento</TabsTrigger>
            )}
            <TabsTrigger value="matches" className="text-xs md:text-sm"><Handshake className="h-4 w-4 mr-1" />Cruces y envíos</TabsTrigger>
          </TabsList>
        </div>

        {/* ─── RESUMEN / KPIs TAB ─── */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Calendar className="h-4 w-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">Visitas por confirmar</p>
                </div>
                <p className="text-3xl font-semibold mt-2">{pendingVisitConfirmations}</p>
                <p className="text-xs text-muted-foreground mt-1">Clientes aún sin confirmar asistencia.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <Clock className="h-4 w-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">Visitas sin feedback</p>
                </div>
                <p className="text-3xl font-semibold mt-2">{visitsWithoutResult}</p>
                <p className="text-xs text-muted-foreground mt-1">Visitas realizadas o pasadas pendientes de resultado.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Euro className="h-4 w-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">Ofertas pendientes</p>
                </div>
                <p className="text-3xl font-semibold mt-2">{pendingOffers}</p>
                <p className="text-xs text-muted-foreground mt-1">Ofertas registradas esperando movimiento.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <Handshake className="h-4 w-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">Negociación activa</p>
                </div>
                <p className="text-3xl font-semibold mt-2">{activeNegotiations}</p>
                <p className="text-xs text-muted-foreground mt-1">Ofertas vivas entre pendiente y contraoferta.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">Palancas comerciales</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Desde aquí controlas agenda de visitas, confirmaciones y presión de oferta sin salir del bloque comercial.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setVisitDialog(true)}>
                    <Calendar className="h-4 w-4 mr-2" />Programar visita
                  </Button>
                  <Button variant="outline" onClick={() => setOfferDialog(true)}>
                    <Euro className="h-4 w-4 mr-2" />Registrar oferta
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-sm font-semibold">Visitas más urgentes</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Marca siempre el resultado real de la visita. Si no queda apuntado, luego no puedes leer bien tu conversión ni defender bien tu Horus.
                </p>
                <div className="mt-3 space-y-2">
                  {filteredVisits.slice(0, 4).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay visitas registradas todavía.</p>
                  ) : (
                    filteredVisits.slice(0, 4).map((visit) => (
                      <div key={visit.id} className="rounded-xl border border-border/50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{visit.properties?.title || 'Visita'}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {visit.contacts?.full_name || 'Sin contacto'} · {format(new Date(visit.visit_date), "dd MMM yyyy HH:mm", { locale: es })}
                            </p>
                          </div>
                          {confirmBadge(visit.confirmation_status)}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            Resultado: {visit.result ? visitResults.find((item) => item.value === visit.result)?.label || visit.result : 'Pendiente'}
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={visit.result || ''}
                              onValueChange={(value) => void updateVisitResult(visit.id, value)}
                            >
                              <SelectTrigger className="h-8 w-[160px]">
                                <SelectValue placeholder="Marcar resultado" />
                              </SelectTrigger>
                              <SelectContent>
                                {VISIT_RESULT_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!visit.result ? (
                              <span className="text-[11px] text-amber-700">
                                Sin resultado, esta visita pesa menos en la lectura comercial.
                              </span>
                            ) : null}
                            {visit.confirmation_status === 'pendiente' ? (
                              <Button size="sm" variant="ghost" className="text-green-600" onClick={() => sendVisitWhatsApp(visit)}>
                                <MessageCircle className="h-3.5 w-3.5 mr-1" />Confirmar
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-sm font-semibold">Ofertas en juego</p>
                <div className="mt-3 space-y-2">
                  {filteredOffers.slice(0, 4).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay ofertas registradas todavía.</p>
                  ) : (
                    filteredOffers.slice(0, 4).map((offer) => (
                      <div key={offer.id} className="rounded-xl border border-border/50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{offer.properties?.title || 'Oferta'}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {offer.contacts?.full_name || 'Sin comprador'} · {Number(offer.amount || 0).toLocaleString('es-ES')} €
                            </p>
                            {extractOfferLossReason(offer.notes) && ['rechazada', 'retirada', 'expirada'].includes(offer.status) ? (
                              <p className="text-xs text-rose-700 mt-1">
                                Motivo: {extractOfferLossReason(offer.notes)}
                              </p>
                            ) : null}
                          </div>
                          <Badge variant={offer.status === 'aceptada' ? 'default' : offer.status === 'rechazada' ? 'destructive' : 'outline'}>
                            {offerStatuses.find((item) => item.value === offer.status)?.label || offer.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Select value={offer.status} onValueChange={(value) => requestOfferStatusChange(offer, value)}>
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {offerStatuses.map((status) => (
                                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Motivos top de descarte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topMatchLossReasons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay descartes con motivo registrado.</p>
                ) : (
                  topMatchLossReasons.map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2">
                      <p className="text-sm">{reason}</p>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Motivos top de pérdida en oferta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topOfferLossReasons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay ofertas caídas con motivo registrado.</p>
                ) : (
                  topOfferLossReasons.map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2">
                      <p className="text-sm">{reason}</p>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Cargando...</div>}>
            <CampaignDashboard />
          </Suspense>
        </TabsContent>

        {/* ─── CLASIFICACIÓN TAB ─── */}
        <TabsContent value="classify">
          <ClassificationCampaign />
        </TabsContent>

        {/* ─── ENRIQUECIMIENTO TAB ─── */}
        <TabsContent value="enrich">
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Cargando...</div>}>
            <DemandEnrichCampaign />
          </Suspense>
        </TabsContent>

        {/* ─── CRUCES TAB ─── */}
        <TabsContent value="matches" className="space-y-4">
          <div className="flex justify-end gap-2">
            <ViewToggle view={viewMode} onViewChange={setViewMode} />
            <Button size="sm" onClick={runCrossing} disabled={running}>
              <Zap className="h-4 w-4 mr-1 md:mr-2" /><span className="hidden md:inline">{running ? 'Procesando...' : 'Ejecutar Cruce'}</span><span className="md:hidden">{running ? '...' : 'Cruce'}</span>
            </Button>
          </div>

          {filteredMatches.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Handshake className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay cruces. Ejecuta el cruce automático para encontrar coincidencias.</p>
            </CardContent></Card>
          ) : (
            viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {groupedMatches.map(group => (
                <Card key={group.id} className="border-0 shadow-[var(--shadow-card)]">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-semibold">{group.contactName}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.contactPhone || group.contactEmail || 'Sin teléfono ni email'}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {group.matches.length > 0 ? `Top ${group.matches[0]?.compatibility || 0}%` : 'Sin cruces'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-border/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cruces</p>
                        <p className="mt-1 text-2xl font-semibold">{group.matches.length}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pendientes</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {group.matches.filter((match) => match.status === 'pendiente').length}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Enviados</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {group.matches.filter((match) => match.status === 'enviado').length}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-muted/40 p-4">
                      {group.matches.length > 0 ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mejor cruce</p>
                              <p className="mt-1 text-sm font-medium">{group.matches[0]?.properties?.title || 'Propiedad'}</p>
                              <p className="text-xs text-muted-foreground">
                                {group.matches[0]?.properties?.city || 'Sin ciudad'}
                                {group.matches[0]?.properties?.province ? `, ${group.matches[0].properties.province}` : ''}
                              </p>
                            </div>
                            <Badge className={`${statusColors[group.matches[0]?.status || 'pendiente']} text-primary-foreground border-0`}>
                              {statusLabels[group.matches[0]?.status || 'pendiente']}
                            </Badge>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            {group.matches[0]?.properties?.price ? (
                              <p className="font-semibold">{Number(group.matches[0].properties.price).toLocaleString('es-ES')} €</p>
                            ) : null}
                            {group.matches[0]?.properties?.bedrooms ? (
                              <p className="text-muted-foreground">{group.matches[0].properties.bedrooms} hab.</p>
                            ) : null}
                            {group.matches[0]?.properties?.surface_area ? (
                              <p className="text-muted-foreground">{Number(group.matches[0].properties.surface_area)} m²</p>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado del cruce</p>
                          <p className="mt-1 text-sm font-medium">Sin coincidencias por ahora</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            La demanda está activa, pero de momento no hay inmuebles compatibles en base de datos.
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {Array.from(new Set([
                          ...group.matches.map((match) => match.properties?.city).filter(Boolean),
                          ...(Array.isArray(group.demand?.cities) ? group.demand.cities : []),
                        ])).slice(0, 2).join(' · ') || 'Sin ciudad'}
                      </Badge>
                      <Badge variant="secondary">
                        {Array.from(new Set([
                          ...group.matches.map((match) => match.properties?.property_type).filter(Boolean),
                          ...(Array.isArray(group.demand?.property_types) ? group.demand.property_types : []),
                          ...(group.demand?.property_type ? [group.demand.property_type] : []),
                        ])).slice(0, 2).join(' · ') || 'Sin tipología'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {group.contactId ? (
                        <Button size="sm" onClick={() => { window.location.href = `/contacts/${group.contactId}`; }}>
                          Abrir contacto
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => group.matches[0] && runAIScoring(group.matches[0])}
                        disabled={!group.matches[0] || (aiLoading && aiScoringId === group.matches[0]?.id)}
                      >
                        {aiLoading && aiScoringId === group.matches[0]?.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                        IA mejor cruce
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>%</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Propiedad</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatches.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-bold text-primary">{m.compatibility}%</TableCell>
                      <TableCell className="font-medium">{m.demands?.contacts?.full_name || 'Contacto'}</TableCell>
                      <TableCell>{m.properties?.title || 'Propiedad'}</TableCell>
                      <TableCell>{m.properties?.city || '—'}</TableCell>
                      <TableCell className="font-semibold">{m.properties?.price ? `${Number(m.properties.price).toLocaleString('es-ES')} €` : '—'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={`${statusColors[m.status]} text-primary-foreground border-0`}>{statusLabels[m.status]}</Badge>
                          {m.status === 'descartado' && extractMatchDiscardReason(m.notes) ? (
                            <p className="max-w-[180px] text-xs text-rose-700">{extractMatchDiscardReason(m.notes)}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => runAIScoring(m)} disabled={aiLoading && aiScoringId === m.id}>
                            {aiLoading && aiScoringId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          </Button>
                          {m.status === 'pendiente' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => sendMatchWhatsApp(m)} className="text-green-600"><MessageCircle className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => sendMatchEmail(m)}><Mail className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => requestMatchStatusChange(m, 'descartado')} className="text-destructive">✕</Button>
                            </>
                          )}
                          {m.status === 'enviado' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => sendMatchWhatsApp(m)} className="text-green-600"><MessageCircle className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => requestMatchStatusChange(m, 'interesado')}>✓</Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            )
          )}

          {/* Pagination */}
          {matchesCount > MATCHES_PER_PAGE && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {matchesPage * MATCHES_PER_PAGE + 1}–{Math.min((matchesPage + 1) * MATCHES_PER_PAGE, matchesCount)} de {matchesCount} cruces
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={matchesPage === 0} onClick={() => setMatchesPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={(matchesPage + 1) * MATCHES_PER_PAGE >= matchesCount} onClick={() => setMatchesPage(p => p + 1)}>
                  Siguiente<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>


      </Tabs>

      <MatchVisitDialog
        open={visitDialog}
        onOpenChange={setVisitDialog}
        properties={properties}
        contacts={contactsList}
        value={visitForm}
        onChange={setVisitForm}
        onSubmit={addVisit}
        loading={formLoading}
      />

      <MatchVisitConfirmationDialog
        visit={sendDialog}
        onOpenChange={() => setSendDialog(null)}
        onSendWhatsApp={sendVisitWhatsApp}
        onCopyLink={copyLink}
      />

      <MatchOfferDialog
        open={offerDialog}
        onOpenChange={setOfferDialog}
        properties={properties}
        contacts={contactsList}
        value={offerForm}
        onChange={setOfferForm}
        onSubmit={addOffer}
        loading={formLoading}
      />

      <MatchAiScoringDialog
        open={!!aiScoringId && !!aiResult}
        onOpenChange={(open) => {
          if (!open) {
            setAiScoringId(null);
            setAiResult(null);
          }
        }}
        result={aiResult}
      />

      <MatchOfferResolutionDialog
        open={!!offerResolutionDialog}
        onOpenChange={(open) => {
          if (!open) {
            setOfferResolutionDialog(null);
            setOfferLossReason('');
          }
        }}
        nextStatus={offerResolutionDialog?.nextStatus || null}
        lossReason={offerLossReason}
        onLossReasonChange={setOfferLossReason}
        onConfirm={() => {
          if (!offerResolutionDialog) return;
          void updateOfferStatus(offerResolutionDialog.offerId, offerResolutionDialog.nextStatus, offerLossReason.trim());
        }}
        loading={formLoading}
      />

      <MatchDiscardDialog
        open={!!matchDiscardDialog}
        onOpenChange={(open) => {
          if (!open) {
            setMatchDiscardDialog(null);
            setMatchDiscardReason('');
          }
        }}
        reason={matchDiscardReason}
        onReasonChange={setMatchDiscardReason}
        onConfirm={() => {
          if (!matchDiscardDialog) return;
          void updateMatchStatus(matchDiscardDialog.id, 'descartado', matchDiscardReason.trim());
        }}
      />
    </div>
  );
};

export default Matches;
