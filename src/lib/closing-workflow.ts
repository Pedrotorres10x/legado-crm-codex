import type { ClosingStepKey } from '@/lib/closing-ops';

type PropertySetter = (fn: (current: any) => any) => void;
type PropertySaver = (updates: Record<string, any>) => void;

export const commitClosingFieldUpdates = (
  onSetProperty: PropertySetter,
  onSaveField: PropertySaver,
  updates: Record<string, any>,
) => {
  onSetProperty((current: any) => ({ ...current, ...updates }));
  onSaveField(updates);
};

export const buildClosingStageAdvanceUpdates = (
  property: any,
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
  property: any,
  arrasStatus: string,
) => ({
  arras_status: arrasStatus,
  status: (arrasStatus === 'pendiente' || arrasStatus === 'firmado') && property.status === 'disponible'
    ? 'arras'
    : property.status,
});
