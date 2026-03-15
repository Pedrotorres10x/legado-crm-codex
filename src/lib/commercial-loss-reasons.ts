export const extractOfferLossReason = (notes?: string | null) => {
  if (!notes) return null;
  const lossLine = notes
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('Motivo de pérdida:'));

  return lossLine ? lossLine.replace('Motivo de pérdida:', '').trim() : null;
};

export const extractMatchDiscardReason = (notes?: string | null) => {
  if (!notes) return null;
  const reasonLine = notes
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('Motivo de descarte:'));

  return reasonLine ? reasonLine.replace('Motivo de descarte:', '').trim() : null;
};

export const buildTopReasons = (reasons: Array<string | null | undefined>) => {
  const counts = reasons
    .filter((reason): reason is string => Boolean(reason && reason.trim()))
    .reduce<Record<string, number>>((acc, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
};

export const getCommercialSuggestion = (reason?: string | null) => {
  const normalized = (reason || '').toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('precio') || normalized.includes('caro') || normalized.includes('mercado')) {
    return 'Revisar precio, comparables y argumento de valor antes del siguiente contacto.';
  }

  if (normalized.includes('zona') || normalized.includes('ubicación') || normalized.includes('localizacion')) {
    return 'Abrir búsqueda en zonas alternativas o recalibrar el briefing de ubicación.';
  }

  if (normalized.includes('financi') || normalized.includes('hipoteca') || normalized.includes('banco')) {
    return 'Validar solvencia y empujar preaprobación financiera antes de seguir negociando.';
  }

  if (normalized.includes('tipolog') || normalized.includes('habitaci') || normalized.includes('superficie')) {
    return 'Ajustar demanda por tipología/superficie y limpiar cruces poco afines.';
  }

  if (normalized.includes('esperar') || normalized.includes('timing') || normalized.includes('momento')) {
    return 'Programar recontacto con fecha clara y sacar la oportunidad de presión inmediata.';
  }

  return 'Revisar discurso comercial y dejar siguiente paso explícito antes de reactivar la oportunidad.';
};
