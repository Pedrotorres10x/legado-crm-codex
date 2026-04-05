import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PropertyFiltersState } from '@/components/properties/PropertyFilters';

type QueryResponse = {
  data: unknown[] | null;
  count: number | null;
  error: { message?: string } | null;
};

const responseQueue: QueryResponse[] = [];
const queryCalls: Array<{ table: string; selectFields: string; count?: string | null }> = [];

class QueryBuilder {
  constructor(
    private readonly table: string,
    private readonly selectFields: string,
    private readonly count?: string | null,
  ) {}

  order() { return this; }
  or() { return this; }
  is() { return this; }
  not() { return this; }
  eq() { return this; }
  contains() { return this; }
  ilike() { return this; }
  gte() { return this; }
  lte() { return this; }
  lt() { return this; }
  range() { return this; }

  then(resolve: (value: QueryResponse) => unknown, reject?: (reason: unknown) => unknown) {
    const next = responseQueue.shift() ?? { data: [], count: 0, error: null };
    return Promise.resolve(next).then(resolve, reject);
  }
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: (selectFields: string, options?: { count?: string }) => {
        queryCalls.push({
          table,
          selectFields,
          count: options?.count ?? null,
        });
        return new QueryBuilder(table, selectFields, options?.count ?? null);
      },
    }),
  },
}));

import { usePropertiesData } from './usePropertiesData';

const baseFilters: PropertyFiltersState = {
  filterType: 'all',
  filterStatus: 'all',
  filterOperation: 'all',
  filterLegalRisk: 'all',
  filterCohort: 'all',
  priceMin: '',
  priceMax: '',
  surfaceMin: '',
  bedroomsMin: 'any',
  filterMandate: 'all',
  sortBy: 'recent',
  filterCity: '',
  filterCountry: '',
};

describe('usePropertiesData', () => {
  beforeEach(() => {
    responseQueue.length = 0;
    queryCalls.length = 0;
  });

  it('arranca con consulta extendida y expone configuracion base', async () => {
    const toast = vi.fn();
    const { result } = renderHook(() =>
      usePropertiesData({
        userId: 'agent-1',
        showAll: false,
        sourceTab: 'all',
        currentPage: 2,
        debouncedSearch: 'villa altea',
        filters: {
          ...baseFilters,
          sortBy: 'price_desc',
          filterStatus: 'disponible',
          filterCity: 'Altea',
        },
        toast,
      }),
    );

    await waitFor(() => expect(queryCalls.length).toBeGreaterThan(0));

    expect(result.current.isClientFiltered).toBe(false);
    expect(result.current.itemsPerPage).toBe(20);
    expect(queryCalls[0]?.table).toBe('properties');
    expect(queryCalls[0]?.selectFields).toContain('legal_risk_level');
    expect(toast).not.toHaveBeenCalled();
  });

  it('usa fallback sin campos avanzados y lanza toast informativo', async () => {
    responseQueue.push(
      {
        data: null,
        count: null,
        error: { message: 'column legal_risk_level does not exist' },
      },
      {
        data: [
          { id: 'p2', title: 'Piso', description: null, city: 'Benidorm', country: 'España', images: null, mandate_end: null },
        ],
        count: 1,
        error: null,
      },
    );

    const toast = vi.fn();
    const { result } = renderHook(() =>
      usePropertiesData({
        showAll: true,
        sourceTab: 'all',
        currentPage: 1,
        debouncedSearch: '',
        filters: baseFilters,
        toast,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.properties).toHaveLength(1);
    expect(result.current.totalCount).toBe(1);
    expect(queryCalls).toHaveLength(2);
    expect(queryCalls[0]?.selectFields).toContain('legal_risk_level');
    expect(queryCalls[1]?.selectFields).not.toContain('legal_risk_level');
    expect(toast).toHaveBeenCalledWith({
      title: 'Se cargó una versión reducida de inmuebles',
      description: 'La base no acepta algunos campos avanzados todavía. La lista principal sigue disponible.',
    });
  });

  it('filtra internacional en cliente y ajusta totalCount al resultado filtrado', async () => {
    responseQueue.push({
      data: [
        { id: 'p3', title: 'Casa', description: null, city: 'Valencia', country: 'España', images: null, mandate_end: null },
        { id: 'p4', title: 'Maison', description: null, city: 'Niza', country: 'Francia', images: null, mandate_end: null },
        { id: 'p5', title: 'Villa', description: null, city: 'Porto', country: 'Portugal', images: null, mandate_end: null },
      ],
      count: 99,
      error: null,
    });

    const toast = vi.fn();
    const { result } = renderHook(() =>
      usePropertiesData({
        showAll: true,
        sourceTab: 'internacional',
        currentPage: 1,
        debouncedSearch: '',
        filters: baseFilters,
        toast,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isClientFiltered).toBe(true);
    expect(result.current.properties.map((property) => property.id)).toEqual(['p4', 'p5']);
    expect(result.current.totalCount).toBe(2);
  });
});
