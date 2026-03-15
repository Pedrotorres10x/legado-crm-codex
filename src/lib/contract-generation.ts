import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type MinimalContact = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  id_number?: string | null;
};

type MinimalProperty = {
  title?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  zip_code?: string | null;
  price?: number | null;
  surface_area?: number | null;
  built_area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  reference?: string | null;
  property_type?: string | null;
  floor?: string | null;
  reservation_date?: string | null;
  reservation_amount?: number | null;
  arras_date?: string | null;
  arras_amount?: number | null;
  deed_date?: string | null;
  deed_notary?: string | null;
};

export type TransactionalTemplateKind = 'reserva' | 'arras';

const formatDate = (value?: string | null) =>
  value ? format(new Date(value), "dd 'de' MMMM 'de' yyyy", { locale: es }) : '___________';

const formatCurrency = (value?: number | null) =>
  typeof value === 'number' && !Number.isNaN(value)
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
    : '___________';

const stringValue = (value?: string | number | null) =>
  value === null || value === undefined || value === '' ? '___________' : String(value);

export const fillTransactionalTemplate = ({
  content,
  property,
  buyer,
  seller,
  agentName,
}: {
  content: string;
  property: MinimalProperty;
  buyer?: MinimalContact | null;
  seller?: MinimalContact | null;
  agentName?: string | null;
}) => {
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  const replacements: Record<string, string> = {
    '{{nombre_cliente}}': stringValue(buyer?.full_name),
    '{{email_cliente}}': stringValue(buyer?.email),
    '{{telefono_cliente}}': stringValue(buyer?.phone),
    '{{direccion_cliente}}': stringValue(buyer?.address),
    '{{ciudad_cliente}}': stringValue(buyer?.city),
    '{{dni_cliente}}': stringValue(buyer?.id_number),
    '{{nombre_comprador}}': stringValue(buyer?.full_name),
    '{{dni_comprador}}': stringValue(buyer?.id_number),
    '{{email_comprador}}': stringValue(buyer?.email),
    '{{telefono_comprador}}': stringValue(buyer?.phone),
    '{{nombre_propietario}}': stringValue(seller?.full_name),
    '{{dni_propietario}}': stringValue(seller?.id_number),
    '{{email_propietario}}': stringValue(seller?.email),
    '{{telefono_propietario}}': stringValue(seller?.phone),
    '{{titulo_propiedad}}': stringValue(property.title),
    '{{direccion_propiedad}}': stringValue(property.address),
    '{{ciudad_propiedad}}': stringValue(property.city),
    '{{provincia_propiedad}}': stringValue(property.province),
    '{{cp_propiedad}}': stringValue(property.zip_code),
    '{{precio_propiedad}}': formatCurrency(property.price),
    '{{superficie_propiedad}}': stringValue(property.surface_area),
    '{{superficie_construida}}': stringValue(property.built_area),
    '{{habitaciones}}': stringValue(property.bedrooms),
    '{{banos}}': stringValue(property.bathrooms),
    '{{referencia_catastral}}': stringValue(property.reference),
    '{{tipo_propiedad}}': stringValue(property.property_type),
    '{{planta}}': stringValue(property.floor),
    '{{fecha_actual}}': today,
    '{{nombre_agente}}': stringValue(agentName),
    '{{fecha_reserva}}': formatDate(property.reservation_date),
    '{{importe_reserva}}': formatCurrency(property.reservation_amount),
    '{{fecha_arras}}': formatDate(property.arras_date),
    '{{importe_arras}}': formatCurrency(property.arras_amount),
    '{{fecha_escritura}}': formatDate(property.deed_date),
    '{{notaria}}': stringValue(property.deed_notary),
  };

  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(key).join(value);
  }

  return result;
};

export const detectTransactionalTemplate = (
  templates: Array<{ id: string; name?: string | null; category?: string | null }>,
  kind: TransactionalTemplateKind,
) => {
  const normalizedKind = kind.toLowerCase();

  return templates.find((template) => {
    const name = (template.name || '').toLowerCase();
    const category = (template.category || '').toLowerCase();

    if (kind === 'reserva') {
      return name.includes('reserva');
    }

    return name.includes(normalizedKind) || category === 'arras';
  }) || null;
};

export const classifyGeneratedContract = (contract: {
  contract_templates?: { name?: string | null; category?: string | null } | null;
}) => {
  const name = (contract.contract_templates?.name || '').toLowerCase();
  const category = (contract.contract_templates?.category || '').toLowerCase();

  if (name.includes('reserva')) return 'reserva';
  if (name.includes('arras') || category === 'arras') return 'arras';
  return null;
};
