import { useEffect, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { OperationsItem } from '@/hooks/useOperationsFeed';

export type OperationsCenterAgent = {
  user_id: string;
  full_name: string;
};

export type OperationsCenterPresetKey = 'all' | 'my_urgent' | 'legal' | 'closing' | 'delegated_today';

const VALID_ISSUE_FILTERS: Array<'all' | OperationsItem['kind']> = ['all', 'legal', 'closing', 'signature', 'deed', 'postsale', 'stock', 'visit', 'offer', 'task', 'lead'];
const VALID_PRESETS: OperationsCenterPresetKey[] = ['all', 'my_urgent', 'legal', 'closing', 'delegated_today'];

const getOperationsCenterPrefsKey = (userId?: string) => `operations-center-prefs:${userId || 'anonymous'}`;

type Params = {
  userId?: string;
  canViewAll: boolean;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
};

export function useOperationsCenterPreferences({
  userId,
  canViewAll,
  searchParams,
  setSearchParams,
}: Params) {
  const [agents, setAgents] = useState<OperationsCenterAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('all');
  const [issueFilter, setIssueFilter] = useState<'all' | OperationsItem['kind']>('all');
  const [activePreset, setActivePreset] = useState<OperationsCenterPresetKey>('all');

  useEffect(() => {
    if (!userId) return;

    const queryPreset = searchParams.get('preset');
    const queryKind = searchParams.get('kind');
    const queryAgent = searchParams.get('agent');
    const hasQueryPrefs = !!(queryPreset || queryKind || queryAgent);

    if (hasQueryPrefs) {
      const nextPreset = VALID_PRESETS.includes((queryPreset || 'all') as OperationsCenterPresetKey)
        ? (queryPreset || 'all') as OperationsCenterPresetKey
        : 'all';
      const nextIssueFilter = VALID_ISSUE_FILTERS.includes((queryKind || 'all') as 'all' | OperationsItem['kind'])
        ? (queryKind || 'all') as 'all' | OperationsItem['kind']
        : 'all';
      const nextAgentId = canViewAll ? (queryAgent || 'all') : 'all';

      setActivePreset((current) => (current === nextPreset ? current : nextPreset));
      setIssueFilter((current) => (current === nextIssueFilter ? current : nextIssueFilter));
      setSelectedAgentId((current) => (current === nextAgentId ? current : nextAgentId));
      return;
    }

    try {
      const raw = window.localStorage.getItem(getOperationsCenterPrefsKey(userId));
      if (!raw) return;

      const prefs = JSON.parse(raw) as {
        preset?: OperationsCenterPresetKey;
        issueFilter?: 'all' | OperationsItem['kind'];
        selectedAgentId?: string;
      };

      if (prefs.preset && VALID_PRESETS.includes(prefs.preset)) setActivePreset(prefs.preset);
      if (prefs.issueFilter && VALID_ISSUE_FILTERS.includes(prefs.issueFilter)) setIssueFilter(prefs.issueFilter);
      if (canViewAll && prefs.selectedAgentId) setSelectedAgentId(prefs.selectedAgentId);
    } catch {
      // ignore malformed local preferences
    }
  }, [canViewAll, searchParams, userId]);

  useEffect(() => {
    if (!userId) return;

    const prefs = {
      preset: activePreset,
      issueFilter,
      selectedAgentId,
    };

    window.localStorage.setItem(getOperationsCenterPrefsKey(userId), JSON.stringify(prefs));
  }, [activePreset, issueFilter, selectedAgentId, userId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (activePreset === 'all') next.delete('preset');
    else next.set('preset', activePreset);

    if (issueFilter === 'all') next.delete('kind');
    else next.set('kind', issueFilter);

    if (!canViewAll || selectedAgentId === 'all') next.delete('agent');
    else next.set('agent', selectedAgentId);

    if (searchParams.toString() !== next.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activePreset, canViewAll, issueFilter, searchParams, selectedAgentId, setSearchParams]);

  useEffect(() => {
    if (!canViewAll) return;

    supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name')
      .then(({ data }) => {
        setAgents(((data || []) as OperationsCenterAgent[]).filter((agent) => agent.full_name));
      });
  }, [canViewAll]);

  return {
    agents,
    selectedAgentId,
    setSelectedAgentId,
    issueFilter,
    setIssueFilter,
    activePreset,
    setActivePreset,
  };
}
