/**
 * Centralized ERP sync utility.
 *
 * Events are routed by the erp-dispatch Edge Function.
 * All satellites now use pull-based data bridges or direct integrations.
 * This dispatcher remains for audit logging and future webhook integrations.
 *
 * Fire-and-forget: never throws, logs errors silently.
 */

import { supabase } from '@/integrations/supabase/client';

export type ErpEvent =
  | 'commission_approved'
  | 'contact_created'
  | 'contact_updated'
  | 'property_created'
  | 'property_updated'
  | 'property_sold'
  | 'property_deleted'
  | 'visit_scheduled'
  | 'photos_updated';

export async function notifyERP(
  event: ErpEvent,
  data: Record<string, any>
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('erp-dispatch', {
      body: { event, data },
    });
    if (error) {
      console.warn('[erp] invoke error:', error.message);
    } else {
      console.log(`[erp] ✅ event dispatched: ${event}`);
    }
  } catch (err) {
    console.warn('[erp] unexpected error:', err);
  }
}
