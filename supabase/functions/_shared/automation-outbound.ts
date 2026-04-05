import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function readAppConfigFlag(key: string, defaultValue: boolean): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (!data) return defaultValue;
    return data.value === 'true';
  } catch {
    return defaultValue;
  }
}

export async function isAutomationOutboundEnabled(): Promise<boolean> {
  return await readAppConfigFlag('automation_outbound_enabled', true);
}

export async function isPropertyInterestAutomationEnabled(): Promise<boolean> {
  return await readAppConfigFlag('property_interest_automation_enabled', false);
}
