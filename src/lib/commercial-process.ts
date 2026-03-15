import { Building2, ClipboardCheck, FileCheck2, Handshake, HeartHandshake, Home, ShieldCheck, Users } from 'lucide-react';

export const COMMERCIAL_PROCESS_STAGES = [
  {
    id: 'prospecto',
    label: 'Prospecto',
    detail: 'Persona duena que queremos convertir en cliente desde circulo de influencia y trabajo de zona.',
    icon: Users,
  },
  {
    id: 'captacion',
    label: 'Captación',
    detail: 'Convertir la relacion en confianza, mandato y producto real en cartera.',
    icon: Building2,
  },
  {
    id: 'producto_listo',
    label: 'Producto listo',
    detail: 'Ficha, fotos, legal, documentación y difusión preparadas.',
    icon: Home,
  },
  {
    id: 'comprador',
    label: 'Comprador',
    detail: 'Seguimiento, visitas, negociación y tracción comercial.',
    icon: Handshake,
  },
  {
    id: 'oferta_arras',
    label: 'Oferta / Arras',
    detail: 'El interés se convierte en oferta y la venta se materializa comercialmente.',
    icon: ClipboardCheck,
  },
  {
    id: 'notaria',
    label: 'Notaría',
    detail: 'Preparación documental, coordinación y firma final.',
    icon: FileCheck2,
  },
  {
    id: 'postventa',
    label: 'Postventa',
    detail: 'Comprador cerrado, vendedor cerrado y relación cuidada para prescripción.',
    icon: HeartHandshake,
  },
] as const;

export const COMMERCIAL_PROCESS_ANCHORS = [
  'KPI',
  'Horus',
  'Cuellos',
  'Stock',
  'Cierre',
  'Admin',
] as const;

export const COMMERCIAL_PROCESS_ADMIN_NOTE =
  'Direccion debe leer donde se rompe el flujo de personas a negocio y sobre que agente actuar para reactivarlo.';

export const COMMERCIAL_PROCESS_AGENT_NOTE =
  'El agente debe entender que el negocio nace en personas, relaciones y confianza; luego se convierte en captacion, venta y prescripcion.';

export const COMMERCIAL_PROCESS_END_TO_END_NOTE =
  'Todo KPI, Horus, cuello, stock, cierre y lectura admin debe colgar de este proceso: primero personas y relaciones, luego producto y venta.';
