import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Home, Phone, Mail, MapPin, CheckCircle } from "lucide-react";

export default function Valoracion() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const agente = new URLSearchParams(window.location.search).get("agente") || "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const phone = form.get("phone") as string;
    const email = form.get("email") as string;
    const address = form.get("address") as string;
    const notes = form.get("notes") as string;

    try {
      // Create contact via public-lead edge function
      await supabase.functions.invoke("public-lead", {
        body: {
          full_name: name,
          phone,
          email: email || null,
          city: address,
          notes: `[Valoración Web] ${notes || ""}`.trim(),
          source_ref: "valoracion-landing",
          contact_type: "propietario",
          tags: ["Valoración", "Web"],
          agent_slug: agente || undefined,
        },
      });
      setSent(true);
    } catch {
      toast.error("Error al enviar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a2744] to-[#2c4a7c] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#1a2744] mb-2">¡Solicitud recibida!</h2>
          <p className="text-gray-600">
            Un asesor de Legado Colección se pondrá en contacto contigo en las
            próximas 24 horas para coordinar la valoración de tu inmueble.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a2744] to-[#2c4a7c] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-[#c9a96e] text-xs tracking-[3px] uppercase mb-2">
            Legado Colección
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Valoración Gratuita
          </h1>
          <p className="text-blue-200 text-sm leading-relaxed">
            Descubre el valor real de tu inmueble. Sin compromiso, sin coste.
            Nuestros asesores te visitarán y prepararán un informe personalizado.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Home className="w-4 h-4 text-[#1a2744]" /> Tu nombre *
              </label>
              <Input name="name" required placeholder="Ej: María García" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-[#1a2744]" /> Teléfono *
              </label>
              <Input name="phone" type="tel" required placeholder="+34 600 000 000" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#1a2744]" /> Email (opcional)
              </label>
              <Input name="email" type="email" placeholder="tu@email.com" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#1a2744]" /> Dirección del inmueble *
              </label>
              <Input name="address" required placeholder="Ej: Av. Mediterráneo 12, Benidorm" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1">
                Comentarios (opcional)
              </label>
              <Textarea
                name="notes"
                placeholder="Ej: Piso de 3 habitaciones, 90m², reformado..."
                rows={3}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#c9a96e] to-[#b8943d] hover:from-[#b8943d] hover:to-[#a6832c] text-white font-bold py-3 rounded-lg text-base"
            >
              {loading ? "Enviando..." : "Solicitar valoración gratuita"}
            </Button>

            <p className="text-xs text-gray-400 text-center">
              Tus datos están protegidos. Solo los usaremos para contactarte
              sobre la valoración. Puedes ejercer tus derechos GDPR en cualquier
              momento.
            </p>
          </form>
        </div>

        {/* Trust badges */}
        <div className="flex justify-center gap-6 mt-6 text-blue-200 text-xs">
          <span>✓ Sin compromiso</span>
          <span>✓ 100% gratuito</span>
          <span>✓ Respuesta en 24h</span>
        </div>
      </div>
    </div>
  );
}
