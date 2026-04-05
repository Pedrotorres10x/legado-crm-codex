import { supabase } from '@/integrations/supabase/client';

export interface PortalFeed {
  id: string;
  portal_name: string;
  display_name: string;
  feed_token: string;
  format: string;
  is_active: boolean;
  last_accessed_at: string | null;
  updated_at: string;
  properties_count: number;
  notes: string | null;
  api_credentials: Record<string, string> | null;
}

export interface FotocasaSyncResult {
  ok: boolean;
  action: string;
  total: number;
  succeeded: number;
  failed: number;
  has_more?: boolean;
  total_available?: number;
  sync_run_id?: string;
}

export const FEED_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-xml-feed`;
export const FOTOCASA_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fotocasa-sync`;
export const PORTAL_CUTOVER_LAUNCH_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-cutover-launch`;
export const KYERO_COHORT_REFRESH_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kyero-cohort-refresh`;

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 45000,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const resolvePropertyId = async (ref: string): Promise<string | null> => {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  for (const col of ['crm_reference', 'xml_id', 'reference', 'id'] as const) {
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq(col, trimmed)
      .limit(1);

    if (data && data.length > 0) return data[0].id;
  }

  return null;
};
