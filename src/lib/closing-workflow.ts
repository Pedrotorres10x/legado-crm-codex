import type { ClosingStepKey } from '@/lib/closing-ops';

type ClosingProperty = Record<string, unknown> & {
  status?: string;
  operation?: string;
  arras_status?: string;
};

type PropertySetter = (fn: (current: ClosingProperty) => ClosingProperty) => void;
type PropertySaver = (updates: Partial<ClosingProperty>) => void;

export const commitClosingFieldUpdates = (
  onSetProperty: PropertySetter,
  onSaveField: PropertySaver,
  updates: Partial<ClosingProperty>,
) => {
  onSetProperty((current) => ({ ...current, ...updates }));
  onSaveField(updates);
};

export const buildClosingStageAdvanceUpdates = (
  property: ClosingProperty,
  activeStep: ClosingStepKey,
) => {
  if (activeStep === 'reserva') {
    return {
      arras_status: 'pendiente',
      status: property.status === 'disponible' ? 'arras' : property.status,
    };
  }

  if (activeStep === 'arras') {
    return {
      arras_status: 'firmado',
      status: 'arras',
    };
  }

  return {
    status: property.operation === 'alquiler' ? 'alquilado' : 'vendido',
  };
};

export const buildArrasStatusUpdates = (
  property: ClosingProperty,
  arrasStatus: string,
) => ({
  arras_status: arrasStatus,
  status: (arrasStatus === 'pendiente' || arrasStatus === 'firmado') && property.status === 'disponible'
    ? 'arras'
    : property.status,
});
