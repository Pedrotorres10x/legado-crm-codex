import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FEED_BASE_URL, FOTOCASA_FN, fetchWithTimeout, type PortalFeed } from '@/components/portals/portal-feed-shared';

const isFotocasaXmlFeed = (feed: PortalFeed) => {
  const portalName = (feed.portal_name || '').toLowerCase();
  const displayName = (feed.display_name || '').toLowerCase();
  return portalName.includes('fotocasa') || displayName.includes('fotocasa');
};

export function usePortalFeedsManager() {
  const [feeds, setFeeds] = useState<PortalFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [forcingAll, setForcingAll] = useState(false);
  const [lastCronRuns, setLastCronRuns] = useState<Record<string, string>>({});

  const fetchFeeds = async () => {
    const { data } = await supabase.from('portal_feeds').select('*').order('display_name');
    const allFeeds = (data as unknown as PortalFeed[]) || [];
    setFeeds(allFeeds.filter((feed) => !isFotocasaXmlFeed(feed)));
    setLoading(false);
  };

  const fetchLastCronRuns = async () => {
    const { data: fotocasaLog } = await supabase.from('erp_sync_logs').select('created_at').eq('target', 'fotocasa').order('created_at', { ascending: false }).limit(1);
    const { data: xmlLog } = await supabase.from('erp_sync_logs').select('created_at').eq('target', 'xml-import').order('created_at', { ascending: false }).limit(1);
    const { data: resyncLog } = await supabase.from('erp_sync_logs').select('created_at').eq('target', 'resync-audit').order('created_at', { ascending: false }).limit(1);

    setLastCronRuns({
      fotocasa: fotocasaLog?.[0]?.created_at || '',
      xml: xmlLog?.[0]?.created_at || resyncLog?.[0]?.created_at || '',
    });
  };

  useEffect(() => {
    fetchFeeds();
    fetchLastCronRuns();
  }, []);

  const toggleActive = async (feed: PortalFeed) => {
    const { error } = await supabase.from('portal_feeds').update({ is_active: !feed.is_active } as never).eq('id', feed.id);
    if (error) {
      toast.error('Error al actualizar');
      return;
    }
    toast.success(`${feed.display_name} ${!feed.is_active ? 'activado' : 'desactivado'}`);
    fetchFeeds();
  };

  const copyFeedUrl = (feed: PortalFeed) => {
    navigator.clipboard.writeText(`${FEED_BASE_URL}?token=${feed.feed_token}`);
    toast.success('URL copiada al portapapeles');
  };

  const testFeed = (feed: PortalFeed) => {
    window.open(`${FEED_BASE_URL}?token=${feed.feed_token}`, '_blank');
  };

  const forceFeed = async (feed: PortalFeed) => {
    const url = `${FEED_BASE_URL}?token=${feed.feed_token}`;
    toast.promise(
      fetch(url).then((response) => {
        if (!response.ok) throw new Error('Error');
        return fetchFeeds();
      }),
      {
        loading: `Enviando a ${feed.display_name}...`,
        success: `✅ ${feed.display_name} sincronizado`,
        error: `❌ Error en ${feed.display_name}`,
      },
    );
  };

  const forceAllFeeds = async () => {
    setForcingAll(true);
    const activeFeeds = feeds.filter((feed) => feed.is_active);
    let ok = 0;
    let fail = 0;
    let fotocasaBackground = false;

    const xmlPromises = activeFeeds.map(async (feed) => {
      try {
        const response = await fetch(`${FEED_BASE_URL}?token=${feed.feed_token}`);
        if (response.ok) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    });

    const fotocasaPromise = fetchWithTimeout(
      FOTOCASA_FN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action: 'sync_all' }),
      },
      15000,
    )
      .then((response) => {
        if (response.ok) ok += 1;
        else fail += 1;
      })
      .catch((error) => {
        const timedOut = error instanceof Error && error.message === 'timeout';
        if (timedOut) {
          fotocasaBackground = true;
          return;
        }
        fail += 1;
      });

    await Promise.all([...xmlPromises, fotocasaPromise]);
    setForcingAll(false);
    fetchFeeds();

    if (fotocasaBackground) {
      toast.info(`✅ ${ok} portales listos · Fotocasa continúa en segundo plano`);
      return;
    }

    if (fail === 0) toast.success(`✅ ${ok} portales sincronizados correctamente`);
    else toast.warning(`${ok} ok · ${fail} con error`);
  };

  return { feeds, loading, forcingAll, lastCronRuns, toggleActive, copyFeedUrl, testFeed, forceFeed, forceAllFeeds };
}
