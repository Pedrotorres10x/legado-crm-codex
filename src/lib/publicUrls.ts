const runtimeOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://legado-crm-codex.vercel.app';

export const CRM_PUBLIC_APP_URL =
  import.meta.env.VITE_PUBLIC_APP_URL?.trim() || runtimeOrigin;

export const FAKTURA_PUBLIC_URL =
  import.meta.env.VITE_FAKTURA_PUBLIC_URL?.trim() || 'https://factura.legadocoleccion.es';

export const LINK_IN_BIO_PUBLIC_URL =
  import.meta.env.VITE_LINK_IN_BIO_PUBLIC_URL?.trim() || 'https://legadocoleccion.es';
