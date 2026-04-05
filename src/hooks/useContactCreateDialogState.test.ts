import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useContactCreateDialogState } from './useContactCreateDialogState';

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  city: '',
  contact_type: '',
  notes: '',
  id_number: '',
  nationality: '',
  birth_date: '',
  budget_min: '',
  budget_max: '',
  desired_bedrooms: '',
  desired_surface: '',
  desired_cities: '',
  desired_zones: '',
  desired_property_type: 'piso',
  desired_operation: 'venta',
  property_address: '',
  estimated_price: '',
  property_type: 'piso',
  source_url: '',
  source_ref: '',
};

describe('useContactCreateDialogState', () => {
  it('abre el dialogo desde quickCreate y limpia el param al cerrar', () => {
    const setSearchParams = vi.fn();
    const searchParams = new URLSearchParams('quickCreate=1');

    const { result } = renderHook(() =>
      useContactCreateDialogState({
        searchParams,
        setSearchParams,
        emptyForm: { ...emptyForm },
      }),
    );

    expect(result.current.dialogOpen).toBe(true);

    act(() => {
      result.current.closeCreateDialog();
    });

    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.dialogStep).toBe('type');
    expect(result.current.formTags).toEqual([]);
    expect(result.current.formTagInput).toBe('');
    expect(setSearchParams).toHaveBeenCalledWith(expect.any(Function), { replace: true });

    const updater = setSearchParams.mock.calls[0][0] as (value: URLSearchParams) => URLSearchParams;
    const params = updater(new URLSearchParams('quickCreate=1&foo=bar'));
    expect(params.get('quickCreate')).toBeNull();
    expect(params.get('foo')).toBe('bar');
  });

  it('resetea paso, formulario y tags al cerrar o reiniciar', () => {
    const { result } = renderHook(() =>
      useContactCreateDialogState({
        searchParams: new URLSearchParams(),
        setSearchParams: vi.fn(),
        emptyForm: { ...emptyForm },
      }),
    );

    act(() => {
      result.current.setDialogStep('form');
      result.current.setForm({
        ...emptyForm,
        full_name: 'Ana',
        contact_type: 'comprador',
      });
      result.current.setFormTags(['vip']);
      result.current.setFormTagInput('pendiente');
      result.current.resetCreateDialog();
    });

    expect(result.current.dialogStep).toBe('type');
    expect(result.current.form).toEqual(emptyForm);
    expect(result.current.formTags).toEqual([]);
    expect(result.current.formTagInput).toBe('');
  });

  it('sincroniza el formulario si cambia emptyForm y maneja apertura manual', () => {
    const setSearchParams = vi.fn();

    const { result, rerender } = renderHook(
      ({ emptyForm }) =>
        useContactCreateDialogState({
          searchParams: new URLSearchParams(),
          setSearchParams,
          emptyForm,
        }),
      {
        initialProps: {
          emptyForm: { ...emptyForm },
        },
      },
    );

    act(() => {
      result.current.openCreateDialog();
      result.current.setForm((prev) => ({ ...prev, full_name: 'Pedro' }));
    });

    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.form.full_name).toBe('Pedro');

    rerender({
      emptyForm: {
        ...emptyForm,
        desired_property_type: 'atico',
        property_type: 'chalet',
      },
    });

    expect(result.current.form.desired_property_type).toBe('atico');
    expect(result.current.form.property_type).toBe('chalet');

    act(() => {
      result.current.handleDialogOpenChange(false);
    });

    expect(result.current.dialogOpen).toBe(false);
    expect(setSearchParams).not.toHaveBeenCalled();
  });
});
