import { useParams } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Star, Lightbulb, MapPin, MessageCircle, ArrowRight, Award, Users, Home, Sparkles, ShieldCheck, Phone, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import backgroundImage from '@/assets/background-mediterranean-optimized.jpg';
import logoRk from '@/assets/logo-rk-legado.jpg';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AgentCardCertifications = lazy(() => import('@/components/agent-card/AgentCardCertifications'));

interface LinkConfig {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  variant: 'primary' | 'whatsapp';
}

interface SocialConfig {
  name: string;
  url: string;
  icon: string;
}

interface CompanyConfig {
  name: string;
  subtitle: string;
  description: string;
  tagline?: string;
  yearsExperience: number;
  propertiesSold: number;
  happyClients: number;
  address?: string;
  phone?: string;
  email?: string;
}

interface LinkInBioConfig {
  company: CompanyConfig;
  links: LinkConfig[];
  social: SocialConfig[];
}

interface AgentData {
  agent_id: string | null;
  name: string;
  slug: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  role: string;
  properties_count: number;
  link_in_bio_config: LinkInBioConfig | null;
}

/* ─── Tracking helpers ─── */
function getSessionId(): string {
  const key = 'linkinbio_sid';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

function getUtmParams(): Record<string, string | null> {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
  };
}

/* ─── UTM attribution helper ─── */
function appendAgentUtm(url: string, slug: string): string {
  try {
    const parsed = new URL(url);
    // Don't overwrite existing UTMs
    if (!parsed.searchParams.has('utm_source')) {
      parsed.searchParams.set('utm_source', 'linkinbio');
      parsed.searchParams.set('utm_medium', 'agent');
      parsed.searchParams.set('utm_content', slug);
      parsed.searchParams.set('utm_campaign', `linkinbio-${new Date().getFullYear()}`);
    }
    return parsed.toString();
  } catch {
    // Non-parseable URL (e.g. mailto:, tel:) — return as-is
    return url;
  }
}

const FALLBACK_COMPANY: CompanyConfig = {
  name: 'RK Legado',
  subtitle: 'by Realmark Inmobiliaria',
  tagline: 'Construyendo tu legado inmobiliario',
  description: 'Somos Legado Inmobiliaria. Vendemos con estrategia, no con prisas. Con más de 15 años en el sector inmobiliario en la provincia de Alicante. Y no prometemos: demostramos.',
  yearsExperience: 15,
  propertiesSold: 500,
  happyClients: 1200,
  address: 'Cl Esperanto 15, Benidorm (Alicante), 03503',
  phone: '965065921',
  email: 'pedro@pedrotorres10x.es',
};

/* ─── Isolated CSS for Mediterranean link-in-bio theme ─── */
const AGENT_CARD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

  .agent-card-root {
    --ac-primary: 25 84% 53%;
    --ac-primary-foreground: 0 0% 100%;
    --ac-foreground: 220 15% 20%;
    --ac-card: 0 0% 100%;
    --ac-border: 220 10% 85%;
    --ac-muted-foreground: 220 10% 45%;

    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    color: hsl(var(--ac-foreground));
  }

  .ac-link-button {
    width: 100%;
    padding: 1.25rem 1.5rem;
    border-radius: 1rem;
    font-weight: 500;
    transition: all 0.4s;
    display: flex;
    align-items: center;
    gap: 1rem;
    text-align: left;
    position: relative;
    overflow: hidden;
    text-decoration: none;
  }
  .ac-link-button:hover { transform: scale(1.02); }
  .ac-link-button:active { transform: scale(0.98); }

  .ac-variant-primary {
    background: linear-gradient(to right, hsl(var(--ac-primary)), #f97316, hsl(var(--ac-primary)));
    color: white;
    border: 1px solid hsl(var(--ac-primary) / 0.3);
    box-shadow: 0 8px 32px -8px hsl(var(--ac-primary) / 0.5);
  }
  .ac-variant-primary:hover {
    border-color: hsl(var(--ac-primary) / 0.6);
    box-shadow: 0 16px 48px -8px hsl(var(--ac-primary) / 0.7);
  }

  .ac-variant-whatsapp {
    background: linear-gradient(to right, #25D366, #128C7E);
    color: white;
    border: 1px solid rgba(37,211,102,0.3);
    box-shadow: 0 8px 32px -8px rgba(37,211,102,0.5);
  }
  .ac-variant-whatsapp:hover {
    border-color: rgba(37,211,102,0.6);
    box-shadow: 0 16px 48px -8px rgba(37,211,102,0.7);
  }

  .ac-glass {
    background: hsl(var(--ac-card) / 0.9);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid hsl(var(--ac-border) / 0.5);
  }

  .ac-gradient-text {
    background: linear-gradient(to right, hsl(var(--ac-primary)), #fb923c, hsl(var(--ac-primary)));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .ac-btn-glow::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 1rem;
    opacity: 0;
    transition: opacity 0.5s;
    background: linear-gradient(135deg, hsl(var(--ac-primary) / 0.3), transparent);
  }
  .ac-btn-glow:hover::before { opacity: 1; }

  .ac-gradient-border::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 1rem;
    padding: 1px;
    background: linear-gradient(135deg, hsl(var(--ac-primary)), transparent 50%, hsl(var(--ac-primary) / 0.3));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  @keyframes ac-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .ac-shimmer {
    background: linear-gradient(90deg, transparent 0%, hsl(var(--ac-primary) / 0.1) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: ac-shimmer 3s ease-in-out infinite;
  }

  @keyframes ac-fade-in-up {
    0% { opacity: 0; transform: translateY(30px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .ac-fade-in-up { animation: ac-fade-in-up 0.8s ease-out forwards; }

  .ac-delay-100 { animation-delay: 100ms; }
  .ac-delay-200 { animation-delay: 200ms; }
  .ac-delay-300 { animation-delay: 300ms; }
  .ac-delay-400 { animation-delay: 400ms; }
  .ac-delay-500 { animation-delay: 500ms; }
  .ac-delay-600 { animation-delay: 600ms; }
  .ac-delay-700 { animation-delay: 700ms; }
  .ac-delay-800 { animation-delay: 800ms; }
  .ac-delay-900 { animation-delay: 900ms; }
`;

const iconMap: Record<string, typeof Star> = { Star, Lightbulb, MapPin, MessageCircle };

/* ─── Main Component ─── */
export default function AgentCard() {
  const { slug } = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const trackedPageview = useRef(false);
  const [isSelfVisit, setIsSelfVisit] = useState(false);
  const certificationsRef = useRef<HTMLDivElement>(null);
  const [showCertifications, setShowCertifications] = useState(false);

  // Detect if the logged-in user is the card owner
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id && agent?.agent_id && data.user.id === agent.agent_id) {
        setIsSelfVisit(true);
      }
    });
  }, [agent?.agent_id]);

  const trackEvent = useCallback((eventType: string, linkId?: string, linkUrl?: string) => {
    if (!slug || isSelfVisit) return;
    fetch(`${SUPABASE_URL}/functions/v1/track-linkinbio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_slug: slug,
        agent_id: agent?.agent_id || null,
        event_type: eventType,
        link_id: linkId || null,
        link_url: linkUrl || null,
        session_id: getSessionId(),
        referrer: document.referrer || null,
        ...getUtmParams(),
      }),
    }).catch(() => {});
  }, [slug, agent?.agent_id, isSelfVisit]);

  useEffect(() => {
    if (!slug) return;
    fetch(`${SUPABASE_URL}/functions/v1/public-agent-card?slug=${encodeURIComponent(slug)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setAgent(d); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (agent && !trackedPageview.current) {
      trackedPageview.current = true;
      trackEvent('pageview');
    }
  }, [agent, trackEvent]);

  useEffect(() => {
    if (showCertifications) return;

    const node = certificationsRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShowCertifications(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [showCertifications]);

  if (loading) return <LoadingSkeleton />;
  if (error || !agent) return <NotFoundState />;

  const config = agent.link_in_bio_config;
  const company = config?.company || FALLBACK_COMPANY;
  const configLinks = config?.links || [];

  const whatsappUrl = agent.whatsapp
    ? `https://wa.me/${agent.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Vi tu link in bio')}`
    : agent.phone
    ? `https://wa.me/${agent.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Vi tu link in bio')}`
    : null;

  const links: LinkConfig[] = [
    ...configLinks.map(l => ({ ...l, url: appendAgentUtm(l.url, agent.slug) })),
    ...(whatsappUrl ? [{
      id: 'whatsapp',
      title: 'Escríbeme por WhatsApp',
      description: 'Y lo vemos en 2 mensajes',
      url: whatsappUrl,
      icon: 'MessageCircle',
      variant: 'whatsapp' as const,
    }] : []),
  ];

      const companyAddress = company.address || FALLBACK_COMPANY.address;
      const companyPhone = agent.phone || company.phone || FALLBACK_COMPANY.phone;
      const companyEmail = agent.email || company.email || FALLBACK_COMPANY.email;

  return (
    <>
      <style>{AGENT_CARD_STYLES}</style>
      <div className="agent-card-root">
        {/* ─── Background: Mediterranean style ─── */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, hsla(210,20%,20%,0.35), hsla(210,15%,25%,0.3), hsla(210,20%,15%,0.45))' }} />
          {/* Logo watermark */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={logoRk} alt="" loading="lazy" decoding="async" style={{ width: '60vw', maxWidth: 500, minWidth: 250, height: '60vw', maxHeight: 500, minHeight: 250, objectFit: 'cover', borderRadius: '1.5rem', opacity: 0.12, filter: 'brightness(1.2) saturate(0.2)' }} />
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(transparent 40%, rgba(238,242,246,0.4) 100%)' }} />
        </div>

        {/* ─── Content ─── */}
        <div style={{ position: 'relative', zIndex: 10, padding: '2.5rem 1rem' }}>
          <div style={{ maxWidth: '28rem', margin: '0 auto' }}>

            {/* ─── Header ─── */}
            <header className="ac-fade-in-up" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              {/* Agent avatar */}
              {agent.avatar && (
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem' }}>
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    loading="eager"
                    decoding="async"
                    style={{ width: 100, height: 100, borderRadius: '1.25rem', objectFit: 'cover', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '3px solid rgba(255,255,255,0.6)' }}
                  />
                </div>
              )}
              {!agent.avatar && (
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem' }}>
                  <img
                    src={logoRk}
                    alt={company.name}
                    loading="lazy"
                    decoding="async"
                    style={{ width: 100, height: 100, borderRadius: '1.25rem', objectFit: 'cover', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '3px solid rgba(255,255,255,0.6)' }}
                  />
                </div>
              )}

              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '0.25rem', fontFamily: "'Space Grotesk', sans-serif" }}>
                <span className="ac-gradient-text">{agent.name || company.name}</span>
              </h1>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 15% 20% / 0.7)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '0.5rem', textShadow: '0 1px 3px rgba(255,255,255,0.4)' }}>
                {company.subtitle?.replace('by ', 'BY ') || 'BY REALMARK INMOBILIARIA'}
              </p>
              {(agent.bio || company.tagline) && (
                <p style={{ fontSize: '1.05rem', color: 'hsl(220 15% 20% / 0.85)', fontWeight: 400, maxWidth: '20rem', margin: '0 auto', textShadow: '0 1px 3px rgba(255,255,255,0.3)' }}>
                  {agent.bio || company.tagline}
                </p>
              )}
              <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <div style={{ height: 1, width: 48, background: 'linear-gradient(to right, transparent, hsl(25 84% 53% / 0.5))' }} />
                <div style={{ width: 8, height: 8, borderRadius: '9999px', background: 'hsl(25 84% 53%)' }} />
                <div style={{ height: 1, width: 48, background: 'linear-gradient(to left, transparent, hsl(25 84% 53% / 0.5))' }} />
              </div>
            </header>

            {/* ─── Link Buttons ─── */}
            <main style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {links.map((link, index) => {
                const Icon = iconMap[link.icon] || Star;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('click', link.id, link.url)}
                    className={`ac-link-button ac-btn-glow ac-gradient-border ac-fade-in-up ${link.variant === 'whatsapp' ? 'ac-variant-whatsapp' : 'ac-variant-primary'}`}
                    style={{ opacity: 0, animationDelay: `${(index + 1) * 100}ms` }}
                  >
                    <div style={{
                      flexShrink: 0, width: 56, height: 56, borderRadius: '0.75rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.2)', overflow: 'hidden',
                      transition: 'all 0.5s',
                    }}>
                      <Icon style={{ width: 24, height: 24, color: 'white' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 2, color: 'white' }}>{link.title}</p>
                      <p style={{ fontSize: '0.875rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'white' }}>{link.description}</p>
                    </div>
                    <ArrowRight style={{ width: 20, height: 20, flexShrink: 0, opacity: 0, color: 'white', transition: 'all 0.3s' }} />
                    <div className="ac-shimmer" style={{ position: 'absolute', inset: 0, opacity: 0, borderRadius: '1rem', transition: 'opacity 0.5s' }} />
                  </a>
                );
              })}
            </main>

            {/* ─── About Section ─── */}
            <section className="ac-fade-in-up ac-delay-600" style={{ marginTop: '3rem', paddingTop: '2.5rem', borderTop: '1px solid hsl(220 10% 85% / 0.5)', opacity: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Sparkles style={{ width: 20, height: 20, color: 'hsl(25, 84%, 53%)' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', fontFamily: "'Space Grotesk', sans-serif", textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>Quiénes Somos</h2>
                <Sparkles style={{ width: 20, height: 20, color: 'hsl(25, 84%, 53%)' }} />
              </div>

              {/* Description */}
              <div className="ac-glass" style={{ borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <p style={{ color: 'hsl(220 15% 20% / 0.8)', textAlign: 'center', lineHeight: 1.7 }}>{company.description}</p>
              </div>

              {/* Contact info */}
              <div className="ac-glass" style={{ borderRadius: '1rem', padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {companyAddress && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(companyAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(220 15% 20% / 0.8)', textDecoration: 'none', transition: 'color 0.3s' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: 'hsl(25 84% 53% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MapPin style={{ width: 16, height: 16, color: 'hsl(25, 84%, 53%)' }} />
                    </div>
                    <span style={{ fontSize: '0.875rem' }}>{companyAddress}</span>
                  </a>
                )}
                {companyPhone && (
                  <a
                    href={`tel:+34${companyPhone}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(220 15% 20% / 0.8)', textDecoration: 'none', transition: 'color 0.3s' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: 'hsl(25 84% 53% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Phone style={{ width: 16, height: 16, color: 'hsl(25, 84%, 53%)' }} />
                    </div>
                    <span style={{ fontSize: '0.875rem' }}>{companyPhone}</span>
                  </a>
                )}
                {companyEmail && (
                  <a
                    href={`mailto:${companyEmail}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(220 15% 20% / 0.8)', textDecoration: 'none', transition: 'color 0.3s' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: 'hsl(25 84% 53% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Mail style={{ width: 16, height: 16, color: 'hsl(25, 84%, 53%)' }} />
                    </div>
                    <span style={{ fontSize: '0.875rem' }}>{companyEmail}</span>
                  </a>
                )}
                {agent.facebook && (
                  <a
                    href={agent.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('click', 'facebook', agent.facebook!)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(220 15% 20% / 0.8)', textDecoration: 'none', transition: 'color 0.3s' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: 'hsl(25 84% 53% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg style={{ width: 16, height: 16, fill: 'hsl(25, 84%, 53%)' }} viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </div>
                    <span style={{ fontSize: '0.875rem' }}>Facebook</span>
                  </a>
                )}
                {agent.instagram && (
                  <a
                    href={agent.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('click', 'instagram', agent.instagram!)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(220 15% 20% / 0.8)', textDecoration: 'none', transition: 'color 0.3s' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: 'hsl(25 84% 53% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg style={{ width: 16, height: 16, fill: 'hsl(25, 84%, 53%)' }} viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    </div>
                    <span style={{ fontSize: '0.875rem' }}>Instagram</span>
                  </a>
                )}
                {agent.linkedin && (
                  <a
                    href={agent.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('click', 'linkedin', agent.linkedin!)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(220 15% 20% / 0.8)', textDecoration: 'none', transition: 'color 0.3s' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: 'hsl(25 84% 53% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg style={{ width: 16, height: 16, fill: 'hsl(25, 84%, 53%)' }} viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </div>
                    <span style={{ fontSize: '0.875rem' }}>LinkedIn</span>
                  </a>
                )}
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[
                  { Icon: Award, value: `${company.yearsExperience}+`, label: 'Años de Experiencia' },
                  { Icon: Home, value: `${company.propertiesSold}+`, label: 'Propiedades Vendidas' },
                  { Icon: Users, value: `${company.happyClients}+`, label: 'Clientes Satisfechos' },
                ].map((stat) => (
                  <div key={stat.label} className="ac-glass" style={{ borderRadius: '1rem', padding: '1rem', textAlign: 'center', transition: 'all 0.5s' }}>
                    <div style={{ width: 40, height: 40, margin: '0 auto 0.75rem', borderRadius: '0.75rem', background: 'hsl(25 84% 53% / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <stat.Icon style={{ width: 20, height: 20, color: 'hsl(25, 84%, 53%)' }} />
                    </div>
                    <p className="ac-gradient-text" style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{stat.value}</p>
                    <p style={{ fontSize: '0.75rem', color: 'hsl(220 15% 20% / 0.6)', lineHeight: 1.3 }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── Certifications ─── */}
            <div ref={certificationsRef}>
              {showCertifications ? (
                <Suspense fallback={<div style={{ height: 108, marginTop: '2.5rem' }} />}><AgentCardCertifications /></Suspense>
              ) : (
                <div className="ac-fade-in-up ac-delay-500" style={{ marginTop: '2.5rem', opacity: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <div style={{ height: 1, flex: 1, background: 'linear-gradient(to right, transparent, hsl(25 84% 53% / 0.3))' }} />
                    <ShieldCheck style={{ width: 16, height: 16, color: 'hsl(25, 84%, 53%)' }} />
                    <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'hsl(220 15% 20% / 0.8)', textTransform: 'uppercase', letterSpacing: '0.25em', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>Certificados</span>
                    <ShieldCheck style={{ width: 16, height: 16, color: 'hsl(25, 84%, 53%)' }} />
                    <div style={{ height: 1, flex: 1, background: 'linear-gradient(to left, transparent, hsl(25 84% 53% / 0.3))' }} />
                  </div>
                </div>
              )}
            </div>

            {/* ─── Footer ─── */}
            <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: 'hsl(220 15% 20% / 0.5)' }}>
                © {new Date().getFullYear()} {company.name}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'hsl(220 15% 20% / 0.35)', marginTop: '0.25rem' }}>
                {company.subtitle}
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: 'hsl(210 20% 95%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <Skeleton className="h-24 w-24 rounded-2xl" style={{ background: 'hsl(210 15% 88%)' }} />
      <Skeleton className="h-8 w-48" style={{ background: 'hsl(210 15% 88%)' }} />
      <Skeleton className="h-5 w-32" style={{ background: 'hsl(210 15% 88%)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '28rem', padding: '0 1rem', marginTop: '2rem' }}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" style={{ background: 'hsl(210 15% 88%)' }} />)}
      </div>
    </div>
  );
}

/* ─── Not Found ─── */
function NotFoundState() {
  return (
    <div style={{ minHeight: '100vh', background: 'hsl(210 20% 95%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'hsl(220 15% 20%)', marginBottom: '0.75rem', fontFamily: "'Space Grotesk', sans-serif" }}>
          Agente no encontrado
        </h1>
        <p style={{ color: 'hsl(220 10% 45%)', marginBottom: '2rem' }}>El enlace que has seguido no corresponde a ningún asesor activo.</p>
        <a href="https://legadocoleccion.es" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '1rem 2rem', borderRadius: '9999px',
          background: 'hsl(25, 84%, 53%)', color: 'white',
          fontWeight: 600, textDecoration: 'none', transition: 'all 0.3s',
        }}>
          Ir a Legado Colección <ArrowRight style={{ width: 20, height: 20 }} />
        </a>
      </div>
    </div>
  );
}
