const PROD_SUPABASE_PROJECT_IDS = ['srhkvthmzusfrbqtijlw'];

const hostname = window.location.hostname;
const isLocalhost =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0';

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? '';
const allowProdBackendOnLocal = import.meta.env.VITE_ALLOW_PROD_BACKEND_ON_LOCAL === 'true';

export const environmentSafety = {
  isLocalhost,
  projectId,
  isProductionProject: PROD_SUPABASE_PROJECT_IDS.includes(projectId),
  allowProdBackendOnLocal,
};

export const shouldBlockLocalProdBackend =
  environmentSafety.isLocalhost &&
  environmentSafety.isProductionProject &&
  !environmentSafety.allowProdBackendOnLocal;
