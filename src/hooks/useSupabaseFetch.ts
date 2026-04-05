import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSupabaseFetchOptions<T> {
  /** Async function that returns the data array */
  fetcher: () => Promise<T[]>;
  /** Dependencies that trigger a re-fetch (like filter values) */
  deps?: React.DependencyList;
  /** Debounce delay in ms. 0 = immediate. Default 0. */
  debounce?: number;
}

interface UseSupabaseFetchResult<T> {
  data: T[];
  loading: boolean;
  refetch: () => void;
}

/**
 * Generic hook that handles the fetch → loading → debounce → refetch lifecycle
 * for Supabase queries. Eliminates the boilerplate repeated across every page.
 *
 * @example
 * const { data: tasks, loading, refetch } = useSupabaseFetch({
 *   fetcher: () => supabase.from('tasks').select('*').then(r => r.data ?? []),
 *   deps: [user?.id, filterType],
 * });
 */
export function useSupabaseFetch<T = unknown>({
  fetcher,
  deps = [],
  debounce = 0,
}: UseSupabaseFetchOptions<T>): UseSupabaseFetchResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a stable reference to the fetcher to avoid stale closures
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const run = async () => {
      setLoading(true);
      try {
        const result = await fetcherRef.current();
        setData(result);
      } catch (err) {
        console.error('[useSupabaseFetch] error:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    if (debounce > 0) {
      timerRef.current = setTimeout(run, debounce);
    } else {
      run();
    }
  }, [debounce]);

  useEffect(() => {
    execute();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, execute]);

  return { data, loading, refetch: execute };
}
