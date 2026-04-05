import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const selectMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: selectMock,
    }),
  },
}));

import { usePropertiesPageState } from './usePropertiesPageState';

describe('usePropertiesPageState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    selectMock.mockReset();
    selectMock.mockResolvedValue({
      data: [
        { city: 'Benidorm', country: 'España' },
        { city: 'Altea', country: 'España' },
        { city: 'Benidorm', country: 'Francia' },
        { city: null, country: null },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lee tab y quickCreate desde la URL y carga ubicaciones ordenadas', async () => {
    const setSearchParams = vi.fn();
    const searchParams = new URLSearchParams('tab=xml&quickCreate=1&q=atico');

    const { result } = renderHook(() =>
      usePropertiesPageState({
        canViewAll: true,
        searchParams,
        setSearchParams,
      }),
    );

    expect(result.current.sourceTab).toBe('xml');
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.searchText).toBe('atico');

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.availableCities).toEqual(['Altea', 'Benidorm']);
    expect(result.current.availableCountries).toEqual(['España', 'Francia']);
  });

  it('hace debounce de la busqueda y resetea pagina al tocar filtros', async () => {
    const { result } = renderHook(() =>
      usePropertiesPageState({
        canViewAll: true,
        searchParams: new URLSearchParams(),
        setSearchParams: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setCurrentPage(3);
      result.current.setSearchText('villa');
      result.current.patchFilters({ filterStatus: 'disponible' });
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.debouncedSearch).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.debouncedSearch).toBe('villa');
    expect(result.current.filters.filterStatus).toBe('disponible');
  });

  it('sincroniza cambio de tab y limpia quickCreate al cerrar el dialogo', async () => {
    const setSearchParams = vi.fn();
    const searchParams = new URLSearchParams('quickCreate=1');

    const { result } = renderHook(() =>
      usePropertiesPageState({
        canViewAll: true,
        searchParams,
        setSearchParams,
      }),
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(400);
    });

    act(() => {
      result.current.selectSourceTab('office');
    });

    expect(result.current.sourceTab).toBe('office');
    expect(setSearchParams).toHaveBeenCalledWith(expect.any(Function), { replace: true });

    const tabUpdater = setSearchParams.mock.calls[0][0] as (value: URLSearchParams) => URLSearchParams;
    const tabParams = tabUpdater(new URLSearchParams());
    expect(tabParams.get('tab')).toBe('office');

    act(() => {
      result.current.handlePropertyFormOpenChange(false);
    });

    const closeUpdater = setSearchParams.mock.calls[1][0] as (value: URLSearchParams) => URLSearchParams;
    const closeParams = closeUpdater(new URLSearchParams('quickCreate=1&tab=office'));
    expect(closeParams.get('quickCreate')).toBeNull();
    expect(closeParams.get('tab')).toBe('office');
  });

  it('desactiva showAll cuando el rol deja de permitirlo', async () => {
    const { result, rerender } = renderHook(
      ({ canViewAll }) =>
        usePropertiesPageState({
          canViewAll,
          searchParams: new URLSearchParams(),
          setSearchParams: vi.fn(),
        }),
      {
        initialProps: { canViewAll: true },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setShowAll(true);
    });

    await act(async () => {
      rerender({ canViewAll: false });
    });

    expect(result.current.showAll).toBe(false);
  });
});
