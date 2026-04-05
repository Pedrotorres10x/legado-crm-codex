import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const settingsUpsert = vi.fn();

type SelectResponse = {
  data?: unknown;
  count?: number | null;
  error?: { message?: string } | null;
};

const selectQueue: Record<string, SelectResponse[]> = {
  user_roles: [],
  commissions: [],
  settings: [],
};

const shiftResponse = (table: keyof typeof selectQueue) =>
  Promise.resolve(selectQueue[table].shift() ?? { data: null, count: 0, error: null });

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => shiftResponse('settings'),
            }),
          }),
          upsert: (...args: unknown[]) => settingsUpsert(...args),
        };
      }

      if (table === 'user_roles') {
        return {
          select: () => ({
            eq: () => shiftResponse('user_roles'),
          }),
        };
      }

      if (table === 'commissions') {
        return {
          select: () => ({
            in: () => ({
              gte: () => shiftResponse('commissions'),
            }),
            eq: () => ({
              then: (resolve: (value: SelectResponse) => unknown, reject?: (reason: unknown) => unknown) =>
                shiftResponse('commissions').then(resolve, reject),
              gte: () => shiftResponse('commissions'),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

import { useDashboardAdminState } from './useDashboardAdminState';

describe('useDashboardAdminState', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    settingsUpsert.mockReset();
    selectQueue.user_roles = [];
    selectQueue.commissions = [];
    selectQueue.settings = [];
  });

  it('carga stats, KPI targets y match config iniciales', async () => {
    selectQueue.user_roles.push({ count: 7, error: null });
    selectQueue.commissions.push(
      { data: [{ agency_commission: 1000 }, { agency_commission: 2500 }], error: null },
      { data: [{ agent_total: 800 }, { agent_total: 200 }], error: null },
      { count: 3, error: null },
    );
    selectQueue.settings.push(
      { data: { value: { ventas_ano: 15, captaciones_mes: 4, citas_semana: 5, toques_horus_dia: 6 } }, error: null },
      { data: { value: { send_hour: '11:30', price_margin: 18 } }, error: null },
    );

    const { result } = renderHook(() =>
      useDashboardAdminState({
        semesterStartIso: '2026-01-01',
        cost: 2000,
        updateCost: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.stats).toEqual({
      totalAgents: 7,
      totalAgency: 3500,
      totalPaid: 1000,
      pendingApproval: 3,
    });
    expect(result.current.kpiTargets).toEqual({
      ventas_ano: 15,
      captaciones_mes: 4,
      citas_semana: 5,
      toques_horus_dia: 6,
    });
    expect(result.current.matchConfig).toEqual({
      send_hour: '11:30',
      price_margin: 18,
    });
  });

  it('valida y guarda coste fijo', async () => {
    selectQueue.user_roles.push({ count: 0, error: null });
    selectQueue.commissions.push({ data: [], error: null }, { data: [], error: null }, { count: 0, error: null });
    selectQueue.settings.push({ data: null, error: null }, { data: null, error: null });

    const updateCost = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useDashboardAdminState({
        semesterStartIso: '2026-01-01',
        cost: 2000,
        updateCost,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.setCostInput('0');
    });

    await act(async () => {
      await result.current.handleSaveCost();
    });

    expect(toastError).toHaveBeenCalledWith('Introduce un valor válido');

    await act(async () => {
      result.current.setEditingCost(true);
      result.current.setCostInput('3500');
    });

    await act(async () => {
      await result.current.handleSaveCost();
    });

    expect(updateCost).toHaveBeenCalledWith(3500);
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Coste fijo actualizado a'));
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('€/mes'));
    expect(result.current.editingCost).toBe(false);
  });

  it('guarda KPI targets y match config, y maneja error de guardado', async () => {
    selectQueue.user_roles.push({ count: 0, error: null });
    selectQueue.commissions.push({ data: [], error: null }, { data: [], error: null }, { count: 0, error: null });
    selectQueue.settings.push({ data: null, error: null }, { data: null, error: null });

    settingsUpsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'boom' } });

    const { result } = renderHook(() =>
      useDashboardAdminState({
        semesterStartIso: '2026-01-01',
        cost: 2000,
        updateCost: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.setKpiEditing(true);
      result.current.setKpiForm({
        ventas_ano: '20',
        captaciones_mes: '3',
        citas_semana: '4',
        toques_horus_dia: '8',
      });
    });

    await act(async () => {
      await result.current.handleSaveKpis();
    });

    expect(result.current.kpiTargets).toEqual({
      ventas_ano: 20,
      captaciones_mes: 3,
      citas_semana: 4,
      toques_horus_dia: 8,
    });
    expect(result.current.kpiEditing).toBe(false);
    expect(toastSuccess).toHaveBeenCalledWith('Objetivos KPI actualizados');

    await act(async () => {
      result.current.setMatchEditing(true);
      result.current.setMatchForm({
        send_hour: '',
        price_margin: '140',
      });
    });

    await act(async () => {
      await result.current.handleSaveMatchConfig();
    });

    expect(result.current.matchConfig).toEqual({
      send_hour: '09:00',
      price_margin: 100,
    });
    expect(result.current.matchEditing).toBe(false);
    expect(toastSuccess).toHaveBeenCalledWith('Configuración de envío actualizada');

    await act(async () => {
      result.current.setMatchEditing(true);
      await result.current.handleSaveMatchConfig();
    });

    expect(toastError).toHaveBeenCalledWith('Error al guardar configuración');
    expect(result.current.matchEditing).toBe(true);
  });
});
