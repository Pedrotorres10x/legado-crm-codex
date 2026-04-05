import certRaicv from '@/assets/cert-raicv-optimized.jpg';
import certCrs from '@/assets/cert-crs-optimized.png';
import certApi from '@/assets/cert-api-optimized.png';
import certMeta from '@/assets/cert-meta.png';
import { ShieldCheck } from 'lucide-react';

const certificates = [
  { src: certRaicv, alt: 'RAICV' },
  { src: certCrs, alt: 'CRS' },
  { src: certApi, alt: 'API' },
  { src: certMeta, alt: 'Meta' },
];

export default function AgentCardCertifications() {
  return (
    <section className="ac-fade-in-up ac-delay-500" style={{ marginTop: '2.5rem', opacity: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(to right, transparent, hsl(25 84% 53% / 0.3))' }} />
        <ShieldCheck style={{ width: 16, height: 16, color: 'hsl(25, 84%, 53%)' }} />
        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'hsl(220 15% 20% / 0.8)', textTransform: 'uppercase', letterSpacing: '0.25em', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
          Certificados
        </span>
        <ShieldCheck style={{ width: 16, height: 16, color: 'hsl(25, 84%, 53%)' }} />
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(to left, transparent, hsl(25 84% 53% / 0.3))' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
        {certificates.map((certificate) => (
          <img
            key={certificate.alt}
            src={certificate.src}
            alt={certificate.alt}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            style={{ height: 48, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))', transition: 'transform 0.5s' }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = '';
            }}
          />
        ))}
      </div>
    </section>
  );
}
