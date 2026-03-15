import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link2, Plus, Trash2, GripVertical, Save, ExternalLink, Instagram, Facebook, Linkedin, Eye, BarChart3, MousePointerClick, Users, Globe } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BioLink {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  variant: string;
  visible?: boolean;
}

interface SocialLink {
  name: string;
  url: string;
  icon: string;
}

interface CompanyInfo {
  name: string;
  subtitle: string;
  tagline: string;
  description: string;
  yearsExperience: number;
  propertiesSold: number;
  happyClients: number;
  address: string;
  phone: string;
  email: string;
}

interface BioConfig {
  company: CompanyInfo;
  links: BioLink[];
  social: SocialLink[];
}

const defaultConfig: BioConfig = {
  company: { name: '', subtitle: '', tagline: '', description: '', yearsExperience: 0, propertiesSold: 0, happyClients: 0, address: '', phone: '', email: '' },
  links: [],
  social: [],
};

const socialIcons: Record<string, typeof Instagram> = { Instagram, Facebook, Linkedin };

/* ─── Analytics sub-component ─── */
interface BioEvent {
  id: string;
  event_type: string;
  agent_slug: string;
  link_id: string | null;
  link_url: string | null;
  created_at: string;
  device: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

const BioAnalytics = () => {
  const [events, setEvents] = useState<BioEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data } = await supabase
        .from('linkinbio_events')
        .select('id, event_type, agent_slug, link_id, link_url, created_at, device, country, city, referrer, utm_source, utm_medium, utm_campaign')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);
      setEvents((data as BioEvent[]) || []);
      setLoading(false);
    })();
  }, [days]);

  const stats = useMemo(() => {
    const pageviews = events.filter(e => e.event_type === 'pageview').length;
    const clicks = events.filter(e => e.event_type === 'click').length;
    const sessions = new Set(events.map(e => (e as any).session_id)).size;

    // Top links
    const linkCounts: Record<string, number> = {};
    events.filter(e => e.event_type === 'click' && e.link_id).forEach(e => {
      linkCounts[e.link_id!] = (linkCounts[e.link_id!] || 0) + 1;
    });
    const topLinks = Object.entries(linkCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Top sources
    const srcCounts: Record<string, number> = {};
    events.filter(e => e.utm_source).forEach(e => {
      srcCounts[e.utm_source!] = (srcCounts[e.utm_source!] || 0) + 1;
    });
    const topSources = Object.entries(srcCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Top cities
    const cityCounts: Record<string, number> = {};
    events.filter(e => e.city).forEach(e => {
      cityCounts[e.city!] = (cityCounts[e.city!] || 0) + 1;
    });
    const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Devices
    const deviceCounts: Record<string, number> = {};
    events.filter(e => e.device).forEach(e => {
      deviceCounts[e.device!] = (deviceCounts[e.device!] || 0) + 1;
    });

    return { pageviews, clicks, sessions, topLinks, topSources, topCities, deviceCounts };
  }, [events]);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando estadísticas...</div>;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2 justify-end">
        {[7, 30, 90].map(d => (
          <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>
            {d}d
          </Button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Eye className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{stats.pageviews}</p><p className="text-xs text-muted-foreground">Visitas</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10"><MousePointerClick className="h-5 w-5 text-success" /></div>
            <div><p className="text-2xl font-bold">{stats.clicks}</p><p className="text-xs text-muted-foreground">Clics en enlaces</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10"><Users className="h-5 w-5 text-accent" /></div>
            <div><p className="text-2xl font-bold">{stats.sessions}</p><p className="text-xs text-muted-foreground">Sesiones únicas</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Detail cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Top links */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><MousePointerClick className="h-4 w-4" />Top enlaces</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.topLinks.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            {stats.topLinks.map(([id, count]) => (
              <div key={id} className="flex justify-between text-sm">
                <span className="truncate text-muted-foreground">{id}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top sources */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Globe className="h-4 w-4" />Fuentes UTM</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.topSources.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            {stats.topSources.map(([src, count]) => (
              <div key={src} className="flex justify-between text-sm">
                <span className="truncate text-muted-foreground">{src}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top cities */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Globe className="h-4 w-4" />Ciudades</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.topCities.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            {stats.topCities.map(([city, count]) => (
              <div key={city} className="flex justify-between text-sm">
                <span className="truncate text-muted-foreground">{city}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ─── Main component ─── */
const AdminLinkInBio = () => {
  const [config, setConfig] = useState<BioConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'link_in_bio_config')
        .maybeSingle();
      if (data?.value) {
        const v = data.value as any;
        setConfig({
          company: { ...defaultConfig.company, ...v.company },
          links: (v.links || []).map((l: any) => ({ ...l, visible: l.visible !== false })),
          social: v.social || [],
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('sync-linkinbio', {
        body: config,
      });
      if (error) throw error;
      toast.success('Link in Bio actualizado y sincronizado');
    } catch {
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const updateCompany = (field: keyof CompanyInfo, value: string | number) => {
    setConfig(c => ({ ...c, company: { ...c.company, [field]: value } }));
  };

  const updateLink = (idx: number, field: keyof BioLink, value: string | boolean) => {
    setConfig(c => ({
      ...c,
      links: c.links.map((l, i) => i === idx ? { ...l, [field]: value } : l),
    }));
  };

  const addLink = () => {
    setConfig(c => ({
      ...c,
      links: [...c.links, { id: `link-${Date.now()}`, title: '', description: '', url: '', icon: 'Link2', variant: 'primary', visible: true }],
    }));
  };

  const removeLink = (idx: number) => {
    setConfig(c => ({ ...c, links: c.links.filter((_, i) => i !== idx) }));
  };

  const updateSocial = (idx: number, field: keyof SocialLink, value: string) => {
    setConfig(c => ({
      ...c,
      social: c.social.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  const addSocial = () => {
    setConfig(c => ({
      ...c,
      social: [...c.social, { name: '', url: '', icon: 'Instagram' }],
    }));
  };

  const removeSocial = (idx: number) => {
    setConfig(c => ({ ...c, social: c.social.filter((_, i) => i !== idx) }));
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Cargando configuración...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" />Gestión Link in Bio</h2>
          <p className="text-sm text-muted-foreground">Edita enlaces, textos y redes sociales. Los cambios se sincronizan al satélite automáticamente.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://linkinbiolegado.lovable.app" target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-1.5" />Ver Bio
            </a>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" />{saving ? 'Guardando...' : 'Guardar y sincronizar'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config"><Link2 className="h-3.5 w-3.5 mr-1" />Configuración</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="h-3.5 w-3.5 mr-1" />Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-4">
          {/* Company info */}
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">Información de empresa</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={config.company.name} onChange={e => updateCompany('name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Subtítulo</Label>
                <Input value={config.company.subtitle} onChange={e => updateCompany('subtitle', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tagline</Label>
                <Input value={config.company.tagline} onChange={e => updateCompany('tagline', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descripción</Label>
                <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                  value={config.company.description} onChange={e => updateCompany('description', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={config.company.phone} onChange={e => updateCompany('phone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={config.company.email} onChange={e => updateCompany('email', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Dirección</Label>
                <Input value={config.company.address} onChange={e => updateCompany('address', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Años experiencia</Label>
                <Input type="number" value={config.company.yearsExperience} onChange={e => updateCompany('yearsExperience', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Propiedades vendidas</Label>
                <Input type="number" value={config.company.propertiesSold} onChange={e => updateCompany('propertiesSold', Number(e.target.value))} />
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Enlaces</CardTitle>
              <Button size="sm" variant="outline" onClick={addLink}><Plus className="h-4 w-4 mr-1" />Añadir enlace</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.links.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No hay enlaces configurados</p>}
              {config.links.map((link, idx) => (
                <div key={link.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Enlace {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">Visible</Label>
                        <Switch checked={link.visible !== false} onCheckedChange={v => updateLink(idx, 'visible', v)} />
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeLink(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Título</Label>
                      <Input value={link.title} onChange={e => updateLink(idx, 'title', e.target.value)} placeholder="Texto del botón" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Descripción</Label>
                      <Input value={link.description} onChange={e => updateLink(idx, 'description', e.target.value)} placeholder="Subtexto" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">URL</Label>
                      <div className="flex gap-2">
                        <Input className="flex-1" value={link.url} onChange={e => updateLink(idx, 'url', e.target.value)} placeholder="https://..." />
                        {link.url && (
                          <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" asChild>
                            <a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Social */}
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Redes sociales</CardTitle>
              <Button size="sm" variant="outline" onClick={addSocial}><Plus className="h-4 w-4 mr-1" />Añadir red</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.social.map((s, idx) => {
                const Icon = socialIcons[s.icon] || Link2;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <Input className="w-32" value={s.name} onChange={e => updateSocial(idx, 'name', e.target.value)} placeholder="Nombre" />
                    <Input className="flex-1" value={s.url} onChange={e => updateSocial(idx, 'url', e.target.value)} placeholder="URL" />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeSocial(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Bottom save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />{saving ? 'Guardando...' : 'Guardar y sincronizar'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <BioAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLinkInBio;
