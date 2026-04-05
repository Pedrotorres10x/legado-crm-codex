import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const visitsOrder = vi.fn();
const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'visits') throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            order: (...args: unknown[]) => visitsOrder(...args),
          }),
        }),
      };
    },
  },
}));

import { useContactInsights } from './useContactInsights';

describe('useContactInsights', () => {
  beforeEach(() => {
    visitsOrder.mockReset();
    fetchMock.mockReset();
  });

  it('carga visitas del contacto y actualiza el estado', async () => {
    visitsOrder.mockResolvedValue({
      data: [
        { id: 'v1', visit_date: '2026-04-01', properties: { title: 'Villa en Altea' } },
        { id: 'v2', visit_date: '2026-03-15', properties: { title: 'Ático en Finestrat' } },
      ],
    });

    const toast = vi.fn();
    const { result } = renderHook(() => useContactInsights({ toast }));

    await act(async () => {
      await result.current.fetchContactVisits('contact-1');
    });

    expect(result.current.visitsOpen).toBe('contact-1');
    expect(result.current.visitsLoading).toBe(false);
    expect(result.current.contactVisits).toHaveLength(2);
    expect(toast).not.toHaveBeenCalled();
  });

  it('guarda el resumen IA cuando la función responde bien', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ summary: 'Resumen comercial listo.' }),
    });

    const toast = vi.fn();
    const { result } = renderHook(() => useContactInsights({ toast }));

    await act(async () => {
      await result.current.fetchSummary('contact-2');
    });

    expect(result.current.summaryOpen).toBe('contact-2');
    expect(result.current.summaryLoading).toBe(false);
    expect(result.current.summary).toBe('Resumen comercial listo.');
    expect(toast).not.toHaveBeenCalled();
  });

  it('maneja error funcional y error de red al pedir resumen IA', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ error: 'Sin contexto suficiente' }),
      })
      .mockRejectedValueOnce(new Error('network'));

    const toast = vi.fn();
    const { result } = renderHook(() => useContactInsights({ toast }));

    await act(async () => {
      await result.current.fetchSummary('contact-3');
    });

    expect(toast).toHaveBeenCalledWith({
      title: 'Error IA',
      description: 'Sin contexto suficiente',
      variant: 'destructive',
    });
    expect(result.current.summaryOpen).toBe(null);
    expect(result.current.summaryLoading).toBe(false);

    await act(async () => {
      await result.current.fetchSummary('contact-4');
    });

    expect(toast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'No se pudo conectar con IA',
      variant: 'destructive',
    });
    expect(result.current.summaryOpen).toBe(null);
    expect(result.current.summaryLoading).toBe(false);
  });
});
