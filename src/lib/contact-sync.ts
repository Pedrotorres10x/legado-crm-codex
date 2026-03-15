import { Capacitor } from '@capacitor/core';
import { Contacts, PhoneType, EmailType } from '@capacitor-community/contacts';
import { supabase } from '@/integrations/supabase/client';

const CRM_PREFIX = '[CRM] ';
const CRM_ORG = 'Legado CRM';
const LAST_SYNC_KEY = 'crm_contacts_last_sync';
const AUTO_SYNC_KEY = 'crm_contacts_auto_sync';

export interface SyncResult {
  total: number;
  synced: number;
  errors: number;
}

export const isAutoSyncEnabled = () => localStorage.getItem(AUTO_SYNC_KEY) === 'true';

export const syncContacts = async (userId: string): Promise<SyncResult | null> => {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const permResult = await Contacts.requestPermissions();
    if (permResult.contacts !== 'granted') return null;

    let query = supabase
      .from('contacts')
      .select('id, full_name, phone, phone2, email, updated_at')
      .eq('agent_id', userId)
      .not('phone', 'is', null);

    const lastSyncDate = localStorage.getItem(LAST_SYNC_KEY);
    if (lastSyncDate) {
      query = query.gt('updated_at', lastSyncDate);
    }

    const { data: crmContacts, error } = await query;
    if (error) throw error;
    if (!crmContacts || crmContacts.length === 0) return { total: 0, synced: 0, errors: 0 };

    const result: SyncResult = { total: crmContacts.length, synced: 0, errors: 0 };

    for (const contact of crmContacts) {
      try {
        const phones: { type: PhoneType; label?: string; number: string | null }[] = [];
        if (contact.phone) phones.push({ type: PhoneType.Mobile, label: 'Móvil', number: contact.phone });
        if (contact.phone2) phones.push({ type: PhoneType.Mobile, label: 'Móvil 2', number: contact.phone2 });

        const emails: { type: EmailType; label?: string; address: string | null }[] = [];
        if (contact.email) emails.push({ type: EmailType.Work, label: 'Email', address: contact.email });

        await Contacts.createContact({
          contact: {
            name: { given: `${CRM_PREFIX}${contact.full_name}` },
            organization: { company: CRM_ORG },
            phones,
            emails,
          },
        });
        result.synced++;
      } catch {
        result.errors++;
      }
    }

    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return result;
  } catch (err) {
    console.error('Auto-sync error:', err);
    return null;
  }
};
