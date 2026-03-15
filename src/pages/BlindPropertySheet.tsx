import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, BedDouble, Bath, Maximize, Building, MapPin, Zap, CheckCircle, Video, Globe } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface BlindProperty {
  id: string;
  title: string;
  description: string | null;
  property_type: string;
  operation: string;
  price: number | null;
  surface_area: number | null;
  built_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  city: string | null;
  province: string | null;
  floor: string | null;
  floor_number: string | null;
  energy_cert: string | null;
  has_elevator: boolean | null;
  has_garage: boolean | null;
  has_pool: boolean | null;
  has_terrace: boolean | null;
  has_garden: boolean | null;
  features: string[] | null;
  images: string[] | null;
  videos: string[] | null;
  virtual_tour_url: string | null;
  status: string;
}

const typeLabels: Record<string, string> = {
  piso: 'Piso', casa: 'Casa', chalet: 'Chalet', atico: 'Ático', duplex: 'Dúplex',
  estudio: 'Estudio', local: 'Local', oficina: 'Oficina', garaje: 'Garaje',
  trastero: 'Trastero', terreno: 'Terreno', edificio: 'Edificio', nave: 'Nave',
  finca: 'Finca rústica', otro: 'Otro',
};

const opLabels: Record<string, string> = { venta: 'Venta', alquiler: 'Alquiler' };

export default function BlindPropertySheet() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<BlindProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImg, setSelectedImg] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/public-properties?id=${id}`);
        const json = await res.json();
        if (!res.ok || !json.property) {
          setError('Inmueble no encontrado');
          return;
        }
        setProperty(json.property);
      } catch {
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );

  if (error || !property) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-500 text-lg">{error || 'No encontrado'}</p>
    </div>
  );

  const fmt = (n: number) => n.toLocaleString('es-ES');
  const boolFeatures = [
    property.has_elevator && 'Ascensor',
    property.has_garage && 'Garaje',
    property.has_pool && 'Piscina',
    property.has_terrace && 'Terraza',
    property.has_garden && 'Jardín',
  ].filter(Boolean) as string[];
  const allFeatures = [...boolFeatures, ...(property.features || [])];

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      {/* Header band */}
      <header className="bg-gray-50 border-b border-gray-200 print:bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {opLabels[property.operation] || property.operation} · {typeLabels[property.property_type] || property.property_type}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5 leading-tight">
                {property.title || `${typeLabels[property.property_type] || property.property_type} en ${property.city || 'España'}`}
              </h1>
              {(property.city || property.province) && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[property.city, property.province].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            {property.price != null && (
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
                {fmt(property.price)} €
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Gallery */}
        {property.images && property.images.length > 0 && (
          <section>
            <div className="rounded-xl overflow-hidden bg-gray-100 aspect-[16/9] relative">
              <img
                src={property.images[selectedImg]}
                alt=""
                className="w-full h-full object-cover"
              />
              {property.images.length > 1 && (
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full print:hidden">
                  {selectedImg + 1} / {property.images.length}
                </div>
              )}
            </div>
            {property.images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1 print:flex-wrap print:gap-1">
                {property.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImg(i)}
                    className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-colors ${i === selectedImg ? 'border-gray-900' : 'border-transparent hover:border-gray-300'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Key stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {property.surface_area != null && (
            <StatCard icon={<Maximize className="h-5 w-5" />} label="Superficie" value={`${fmt(property.surface_area)} m²`} />
          )}
          {property.built_area != null && (
            <StatCard icon={<Building className="h-5 w-5" />} label="Construida" value={`${fmt(property.built_area)} m²`} />
          )}
          {property.bedrooms != null && (
            <StatCard icon={<BedDouble className="h-5 w-5" />} label="Dormitorios" value={String(property.bedrooms)} />
          )}
          {property.bathrooms != null && (
            <StatCard icon={<Bath className="h-5 w-5" />} label="Baños" value={String(property.bathrooms)} />
          )}
        </section>

        {/* Description */}
        {property.description && (
          <section>
            <h2 className="text-lg font-bold mb-2">Descripción</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{property.description}</p>
          </section>
        )}

        {/* Features */}
        {allFeatures.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3">Características</h2>
            <div className="flex flex-wrap gap-2">
              {allFeatures.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  {f}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Extra details */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {property.floor && <Detail label="Planta" value={property.floor} />}
          {property.floor_number && <Detail label="Nº planta" value={property.floor_number} />}
          {property.energy_cert && (
            <div className="flex items-center gap-2 py-1.5 border-b border-gray-100">
              <Zap className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-gray-500">Certificado energético</span>
              <span className="ml-auto font-semibold uppercase">{property.energy_cert}</span>
            </div>
          )}
        </section>

        {/* Virtual Tour */}
        {property.virtual_tour_url && (
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              Tour Virtual
            </h2>
            <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video">
              <iframe
                src={property.virtual_tour_url}
                className="w-full h-full border-0"
                allowFullScreen
                title="Tour virtual"
              />
            </div>
          </section>
        )}

        {/* Videos */}
        {property.videos && property.videos.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-600" />
              Vídeos ({property.videos.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {property.videos.map((v, i) => (
                <div key={i} className="rounded-xl overflow-hidden bg-gray-100">
                  {v.match(/youtube\.com|youtu\.be|vimeo\.com/) ? (
                    <iframe
                      src={v.replace('watch?v=', 'embed/')}
                      className="w-full aspect-video border-0"
                      allowFullScreen
                      title={`Vídeo ${i + 1}`}
                    />
                  ) : (
                    <video src={v} controls className="w-full rounded-xl" />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        {/* Print footer */}
        <footer className="hidden print:block pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
          Ficha generada el {new Date().toLocaleDateString('es-ES')}
        </footer>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <div className="flex justify-center text-gray-400 mb-1">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
