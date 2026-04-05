import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsApp } from '../_shared/greenapi.ts';
import { isAutomationOutboundEnabled } from '../_shared/automation-outbound.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Message types
const MESSAGE_TYPES: Record<string, string> = {
  cumpleanos: "🎂 Cumpleaños",
  navidad: "🎄 Navidad",
  semana_santa: "🐣 Semana Santa",
  verano: "☀️ Verano",
  aniversario_compra: "🏠 Aniversario de compra",
  aniversario_venta: "🏠 Aniversario de venta",
  renta_comprador: "📋 Renta (comprador)",
  renta_vendedor: "📋 Renta (vendedor)",
};

function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getSemanaSantaDate(year: number): Date {
  const easter = getEasterDate(year);
  const palmSunday = new Date(easter);
  palmSunday.setDate(palmSunday.getDate() - 7);
  return palmSunday;
}

function generateMessage(type: string, contactName: string, transactionYear?: number): string {
  const firstName = contactName.split(" ")[0];
  switch (type) {
    case "cumpleanos":
      return `¡Feliz cumpleaños, ${firstName}! 🎂🎉 Espero que tengas un día increíble. Un abrazo enorme 🤗 — Alicia, de Legado Inmobiliaria`;
    case "navidad":
      return `¡Feliz Navidad, ${firstName}! 🎄✨ Te deseo unas fiestas geniales y un año nuevo lleno de cosas buenas. ¡Un abrazo fuerte! — Alicia 🙂`;
    case "semana_santa":
      return `¡Feliz Semana Santa, ${firstName}! 🐣 A disfrutar de estos días de descanso. ¡Un saludo! — Alicia`;
    case "verano":
      return `¡Hola ${firstName}! ☀️ Que disfrutes mucho del verano. Si necesitas cualquier cosa, ya sabes que aquí estoy. ¡Un abrazo! — Alicia`;
    case "aniversario_compra":
      return `¡Hola ${firstName}! 🏠 Hoy hace un añito más desde que encontraste tu casa. Espero que la sigas disfrutando un montón. Si algún día necesitas algo, aquí me tienes 🙂 — Alicia`;
    case "aniversario_venta":
      return `¡Hola ${firstName}! 🏠 Hoy se cumple un año más desde que cerramos juntos la venta. Fue un placer acompañarte. Si necesitas algo, ya sabes dónde estoy 🙂 — Alicia`;
    case "renta_comprador":
      return `¡Hola ${firstName}! 📋 Se acerca la Renta y por si te hace falta, estoy disponible para cualquier documentación de tu vivienda (la de ${transactionYear}). Solo dime y te lo preparo 🙂 — Alicia`;
    case "renta_vendedor":
      return `¡Hola ${firstName}! 📋 Se acerca la Renta y por si necesitas algo relacionado con la venta de tu propiedad en ${transactionYear}, aquí estoy para echarte un cable. Solo avísame 🙂 — Alicia`;
    default:
      return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const automationEnabled = await isAutomationOutboundEnabled();
    if (!automationEnabled) {
      return new Response(JSON.stringify({ message: "Automatizacion saliente desactivada", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Fetch all propietarios with phone
    const { data: owners, error: ownersErr } = await supabase
      .from("contacts")
      .select("id, full_name, phone, birth_date, purchase_date, sale_date, contact_type")
      .in("contact_type", ["propietario", "comprador_cerrado", "vendedor_cerrado"])
      .not("phone", "is", null);

    if (ownersErr) throw ownersErr;
    if (!owners || owners.length === 0) {
      return new Response(JSON.stringify({ message: "No propietarios found", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sentThisYear } = await supabase
      .from("owner_reengagement")
      .select("contact_id, message_type, year")
      .eq("year", currentYear);

    const sentRows = (sentThisYear || []) as Array<{ contact_id: string; message_type: string; year: number }>;
    const sentSet = new Set(sentRows.map((s) => `${s.contact_id}:${s.message_type}:${s.year}`));

    const messagesToSend: { contact_id: string; message_type: string; year: number; message: string; phone: string; full_name: string }[] = [];

    const semanaSanta = getSemanaSantaDate(currentYear);
    const ssMonth = semanaSanta.getMonth() + 1;
    const ssDay = semanaSanta.getDate();

    for (const owner of owners) {
      const checks: { type: string; shouldSend: boolean; transactionYear?: number }[] = [];

      if (owner.birth_date) {
        const bd = new Date(owner.birth_date);
        checks.push({ type: "cumpleanos", shouldSend: bd.getMonth() + 1 === currentMonth && bd.getDate() === currentDay });
      }
      checks.push({ type: "navidad", shouldSend: currentMonth === 12 && currentDay === 23 });
      checks.push({ type: "semana_santa", shouldSend: currentMonth === ssMonth && currentDay === ssDay });
      checks.push({ type: "verano", shouldSend: currentMonth === 7 && currentDay === 1 });

      if (owner.purchase_date) {
        const pd = new Date(owner.purchase_date);
        const purchaseYear = pd.getFullYear();
        checks.push({
          type: "aniversario_compra",
          shouldSend: pd.getMonth() + 1 === currentMonth && pd.getDate() === currentDay && purchaseYear < currentYear,
          transactionYear: purchaseYear,
        });
        if (currentYear === purchaseYear + 1) {
          checks.push({ type: "renta_comprador", shouldSend: currentMonth === 5 && currentDay === 1, transactionYear: purchaseYear });
        }
      }

      if (owner.sale_date) {
        const sd = new Date(owner.sale_date);
        const saleYear = sd.getFullYear();
        checks.push({
          type: "aniversario_venta",
          shouldSend: sd.getMonth() + 1 === currentMonth && sd.getDate() === currentDay && saleYear < currentYear,
          transactionYear: saleYear,
        });
        if (currentYear === saleYear + 1) {
          checks.push({ type: "renta_vendedor", shouldSend: currentMonth === 5 && currentDay === 1, transactionYear: saleYear });
        }
      }

      for (const check of checks) {
        if (!check.shouldSend) continue;
        const key = `${owner.id}:${check.type}:${currentYear}`;
        if (sentSet.has(key)) continue;

        messagesToSend.push({
          contact_id: owner.id,
          message_type: check.type,
          year: currentYear,
          message: generateMessage(check.type, owner.full_name, check.transactionYear),
          phone: owner.phone,
          full_name: owner.full_name,
        });
      }
    }

    let sent = 0;
    const WA_DELAY_MIN_MS = 120_000; // 2 min
    const WA_DELAY_MAX_MS = 300_000; // 5 min
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (const msg of messagesToSend) {
      // Delay between sends (except first)
      if (sent > 0) {
        const delayMs = WA_DELAY_MIN_MS + Math.random() * (WA_DELAY_MAX_MS - WA_DELAY_MIN_MS);
        console.log(`[reengagement] Compliance delay: ${Math.round(delayMs / 1000)}s before send #${sent + 1}`);
        await sleep(delayMs);
      }

      await supabase.from("owner_reengagement").insert({
        contact_id: msg.contact_id,
        message_type: msg.message_type,
        year: msg.year,
        channel: "whatsapp",
        message_preview: msg.message.slice(0, 200),
      });

      // Send directly via Green API (rate limited globally)
      const waResult = await sendWhatsApp(msg.phone, msg.message);

      await supabase.from("notifications").insert({
        event_type: "owner_reengagement",
        entity_type: "contact",
        entity_id: msg.contact_id,
        title: `${MESSAGE_TYPES[msg.message_type] || msg.message_type} — ${msg.full_name}`,
        description: waResult.ok
          ? `✅ WhatsApp enviado automáticamente vía Green API`
          : `⚠️ WhatsApp no enviado: ${waResult.error || 'error desconocido'}`,
      });

      sent++;

      // Stop if we hit the global limit
      if (!waResult.ok && waResult.error?.includes('Límite diario')) {
        console.log('[reengagement] Global daily limit reached, stopping.');
        break;
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${owners.length} owners, ${sent} messages queued`, sent, owners: owners.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
