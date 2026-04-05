import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const profilesSelect = vi.fn();
const localStorageGetItem = vi.fn();
const localStorageSetItem = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        if (table !== 'profiles') throw new Error(`Unexpected table ${table}`);
        return profilesSelect(...args);
      },
    }),
  },
}));

import { useOperationsCenterPreferences } from './useOperationsCenterPreferences';

describe('useOperationsCenterPreferences', () => {
  beforeEach(() => {
    profilesSelect.mockReset();
    localStorageGetItem.mockReset();
    localStorageSetItem.mockReset();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: localStorageGetItem,
        setItem: localStorageSetItem,
      },
      configurable: true,
    });
  });

  it('prioriza query params y sincroniza URL/localStorage', async () => {
    profilesSelect.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: [
            { user_id: 'a1', full_name: 'Ana' },
            { user_id: 'a2', full_name: '' },
          ],
        }),
    });

    const setSearchParams = vi.fn();
    const searchParams = new URLSearchParams('preset=legal&kind=closing&agent=a1');

    const { result } = renderHook(() =>
      useOperationsCenterPreferences({
        userId: 'user-1',
        canViewAll: true,
        searchParams,
        setSearchParams,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.activePreset).toBe('legal');
    expect(result.current.issueFilter).toBe('closing');
    expect(result.current.selectedAgentId).toBe('a1');
    expect(result.current.agents).toEqual([{ user_id: 'a1', full_name: 'Ana' }]);
    expect(localStorageGetItem).not.toHaveBeenCalled();

    act(() => {
      result.current.setActivePreset('closing');
      result.current.setIssueFilter('task');
      result.current.setSelectedAgentId('a3');
    });

    expect(localStorageSetItem).toHaveBeenCalledWith(
      'operations-center-prefs:user-1',
      JSON.stringify({
        preset: 'closing',
        issueFilter: 'task',
        selectedAgentId: 'a3',
      }),
    );
    expect(setSearchParams).toHaveBeenCalled();
  });

  it('recupera preferencias desde localStorage cuando no hay query params', async () => {
    profilesSelect.mockReturnValue({
      order: () => Promise.resolve({ data: [] }),
    });
    localStorageGetItem.mockReturnValue(
      JSON.stringify({
        preset: 'delegated_today',
        issueFilter: 'lead',
        selectedAgentId: 'agent-9',
      }),
    );

    const { result } = renderHook(() =>
      useOperationsCenterPreferences({
        userId: 'user-2',
        canViewAll: true,
        searchParams: new URLSearchParams(),
        setSearchParams: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(localStorageGetItem).toHaveBeenCalledWith('operations-center-prefs:user-2');
    expect(result.current.activePreset).toBe('delegated_today');
    expect(result.current.issueFilter).toBe('lead');
    expect(result.current.selectedAgentId).toBe('agent-9');
  });

  it('fuerza agente all y no carga perfiles si no puede ver todo', async () => {
    localStorageGetItem.mockReturnValue(
      JSON.stringify({
        preset: 'my_urgent',
        issueFilter: 'offer',
        selectedAgentId: 'agent-4',
      }),
    );

    const setSearchParams = vi.fn();
    const { result } = renderHook(() =>
      useOperationsCenterPreferences({
        userId: 'user-3',
        canViewAll: false,
        searchParams: new URLSearchParams('agent=agent-4'),
        setSearchParams,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.selectedAgentId).toBe('all');
    expect(result.current.agents).toEqual([]);
    expect(profilesSelect).not.toHaveBeenCalled();

    const lastCall = setSearchParams.mock.calls.at(-1);
    expect(lastCall?.[0].toString()).not.toContain('agent=');
  });
});
