type InfluenceContactRow = {
  id: string;
  contact_type?: string | null;
  full_name?: string | null;
  status?: string | null;
  tags?: string[] | null;
  source_ref?: string | null;
};

const WORKING_DAYS_PER_YEAR = 230;
const MINIMUM_DAILY_TOUCHES = 4;
const HEALTHY_TIER_RANGES = {
  oro: { minRatio: 0.05, maxRatio: 0.1, idealRatio: 0.08 },
  plata: { minRatio: 0.25, maxRatio: 0.35, idealRatio: 0.3 },
  bronce: { minRatio: 0.55, maxRatio: 0.7, idealRatio: 0.62 },
} as const;

type TouchRecipe = {
  meals: number;
  coffees: number;
  calls: number;
  emails: number;
  whatsapps: number;
};

const SEGMENT_TOUCH_RECIPES = {
  prescriptores: {
    meals: 1,
    coffees: 1,
    calls: 1,
    emails: 0,
    whatsapps: 1,
  },
  zona: {
    meals: 0,
    coffees: 1,
    calls: 1,
    emails: 1,
    whatsapps: 1,
  },
  colaboradores: {
    meals: 0,
    coffees: 1,
    calls: 1,
    emails: 1,
    whatsapps: 1,
  },
  red_personal: {
    meals: 0,
    coffees: 0,
    calls: 1,
    emails: 1,
    whatsapps: 2,
  },
} satisfies Record<string, TouchRecipe>;

const multiplyRecipe = (recipe: TouchRecipe, count: number): TouchRecipe => ({
  meals: recipe.meals * count,
  coffees: recipe.coffees * count,
  calls: recipe.calls * count,
  emails: recipe.emails * count,
  whatsapps: recipe.whatsapps * count,
});

const sumRecipes = (recipes: TouchRecipe[]): TouchRecipe =>
  recipes.reduce(
    (acc, recipe) => ({
      meals: acc.meals + recipe.meals,
      coffees: acc.coffees + recipe.coffees,
      calls: acc.calls + recipe.calls,
      emails: acc.emails + recipe.emails,
      whatsapps: acc.whatsapps + recipe.whatsapps,
    }),
    { meals: 0, coffees: 0, calls: 0, emails: 0, whatsapps: 0 },
  );

const hasTag = (tags: string[] | null | undefined, values: string[]) => {
  const normalized = (tags || []).map((tag) => tag.toLowerCase());
  return values.some((value) => normalized.includes(value.toLowerCase()));
};

const sourceMatches = (sourceRef: string | null | undefined, values: string[]) => {
  const normalized = (sourceRef || '').toLowerCase();
  return values.some((value) => normalized.includes(value.toLowerCase()));
};

export const getRelationshipTier = (contact: InfluenceContactRow) => {
  if (hasTag(contact.tags, ['Oro', 'circulo-oro'])) return 'oro';
  if (hasTag(contact.tags, ['Plata', 'circulo-plata'])) return 'plata';
  return 'bronce';
};

export const getRelationshipValidation = (contact: InfluenceContactRow) => {
  if (
    ['comprador_cerrado', 'vendedor_cerrado'].includes(contact.contact_type || '') ||
    hasTag(contact.tags, ['Prescriptor', 'Recomendador', 'Cliente cerrado']) ||
    sourceMatches(contact.source_ref, ['prescriptor', 'referido', 'recommend'])
  ) {
    return 'validado';
  }

  if (
    hasTag(contact.tags, ['Circulo', 'Zona', 'Influenciador local']) ||
    sourceMatches(contact.source_ref, ['circulo', 'zona'])
  ) {
    return 'potencial';
  }

  return 'sin_validar';
};

export const isInfluenceCircleContact = (contact: InfluenceContactRow) => {
  const type = contact.contact_type || '';

  if (['contacto', 'colaborador', 'comprador_cerrado', 'vendedor_cerrado'].includes(type)) {
    return true;
  }

  if (type === 'ambos' && hasTag(contact.tags, ['circulo', 'zona', 'prescriptor', 'recomendador'])) {
    return true;
  }

  return hasTag(contact.tags, ['circulo', 'zona', 'prescriptor', 'recomendador', 'cliente cerrado', 'influenciador local']) ||
    sourceMatches(contact.source_ref, ['circulo', 'zona', 'prescriptor', 'referido', 'recommend']);
};

export const getAgentInfluenceCircle = (contacts: InfluenceContactRow[]) => {
  const useful = contacts.filter(isInfluenceCircleContact);

  const prescriptores = useful.filter(
    (contact) =>
      ['comprador_cerrado', 'vendedor_cerrado'].includes(contact.contact_type || '') ||
      hasTag(contact.tags, ['prescriptor', 'recomendador', 'cliente cerrado']),
  );

  const zona = useful.filter(
    (contact) =>
      hasTag(contact.tags, ['zona', 'influenciador local']) ||
      sourceMatches(contact.source_ref, ['zona', 'barrio', 'finca', 'portal']),
  );

  const colaboradores = useful.filter((contact) => contact.contact_type === 'colaborador');

  const redPersonal = useful.filter(
    (contact) =>
      !prescriptores.some((item) => item.id === contact.id) &&
      !zona.some((item) => item.id === contact.id) &&
      !colaboradores.some((item) => item.id === contact.id),
  );

  const total = useful.length;
  const health =
    total < 300
      ? 'red'
      : total <= 500
        ? 'green'
        : 'yellow';

  const tier =
    total < 300
      ? 'bronce'
      : total <= 400
        ? 'plata'
        : total <= 500
          ? 'oro'
          : 'saturado';

  const label =
    tier === 'oro'
      ? 'Circulo oro'
      : tier === 'plata'
        ? 'Circulo plata'
        : tier === 'bronce'
          ? 'Circulo bronce'
          : 'Circulo saturado';

  const detail =
    tier === 'oro'
      ? 'Tu base relacional ya puede sostener referrals, captaciones y seguimiento con una profundidad comercial muy sana.'
      : tier === 'plata'
        ? 'Ya tienes una base util interesante. Un poco mas de volumen y constancia te acerca a la zona mas potente.'
        : tier === 'bronce'
          ? 'Con menos de 300 contactos utiles es dificil sostener captacion continua solo desde circulo y zona.'
          : 'Por encima de 500 contactos empieza a costar atenderlos bien. Aqui no gana tener mas nombres, sino mejor cobertura real.';

  const action =
    tier === 'oro'
      ? 'Mantener cobertura constante y sacar negocio de prescriptores, zona, colaboradores y red personal sin perder cadencia.'
      : tier === 'plata'
        ? 'Seguir ampliando base util y consolidar un sistema de toques recurrente para empujar referrals y captacion.'
        : tier === 'bronce'
          ? 'Tu foco es ampliar el circulo util: antiguos clientes, recomendaciones, zona y relaciones que de verdad puedan abrir puertas.'
          : 'Toca priorizar y depurar. Mejor una base mas enfocada y bien trabajada que una agenda sobredimensionada.';

  const touchPlanBySegment = [
    {
      key: 'prescriptores',
      label: 'Prescriptores',
      count: prescriptores.length,
      recipe: SEGMENT_TOUCH_RECIPES.prescriptores,
      annual: multiplyRecipe(SEGMENT_TOUCH_RECIPES.prescriptores, prescriptores.length),
    },
    {
      key: 'zona',
      label: 'Zona',
      count: zona.length,
      recipe: SEGMENT_TOUCH_RECIPES.zona,
      annual: multiplyRecipe(SEGMENT_TOUCH_RECIPES.zona, zona.length),
    },
    {
      key: 'colaboradores',
      label: 'Colaboradores',
      count: colaboradores.length,
      recipe: SEGMENT_TOUCH_RECIPES.colaboradores,
      annual: multiplyRecipe(SEGMENT_TOUCH_RECIPES.colaboradores, colaboradores.length),
    },
    {
      key: 'red_personal',
      label: 'Red personal',
      count: redPersonal.length,
      recipe: SEGMENT_TOUCH_RECIPES.red_personal,
      annual: multiplyRecipe(SEGMENT_TOUCH_RECIPES.red_personal, redPersonal.length),
    },
  ];

  const annualTouchPlan = sumRecipes(touchPlanBySegment.map((segment) => segment.annual));
  const totalAnnualTouches =
    annualTouchPlan.meals +
    annualTouchPlan.coffees +
    annualTouchPlan.calls +
    annualTouchPlan.emails +
    annualTouchPlan.whatsapps;
  const averageTouchesPerContact = total === 0 ? 0 : totalAnnualTouches / total;
  const annualTouchDemand = total * 4;
  const recommendedDailyTouches = Math.max(
    MINIMUM_DAILY_TOUCHES,
    Math.ceil(annualTouchDemand / WORKING_DAYS_PER_YEAR),
  );
  const recommendedWeeklyTouches = recommendedDailyTouches * 5;
  const recommendedMonthlyTouches = Math.ceil(annualTouchDemand / 12);

  const tierCounts = useful.reduce(
    (acc, contact) => {
      const tierKey = getRelationshipTier(contact);
      const validationKey = getRelationshipValidation(contact);
      acc[tierKey] += 1;
      acc.validation[validationKey] += 1;
      return acc;
    },
    {
      oro: 0,
      plata: 0,
      bronce: 0,
      validation: {
        validado: 0,
        potencial: 0,
        sin_validar: 0,
      },
    },
  );

  const getTierRatio = (count: number) => (total === 0 ? 0 : count / total);

  const tierRatios = {
    oro: getTierRatio(tierCounts.oro),
    plata: getTierRatio(tierCounts.plata),
    bronce: getTierRatio(tierCounts.bronce),
  };

  const balanceIssues: string[] = [];
  if (tierRatios.oro > HEALTHY_TIER_RANGES.oro.maxRatio) {
    balanceIssues.push('Demasiado oro declarado para una base realista');
  } else if (tierRatios.oro < HEALTHY_TIER_RANGES.oro.minRatio) {
    balanceIssues.push('Faltan contactos oro de mucha confianza');
  }

  if (tierRatios.plata < HEALTHY_TIER_RANGES.plata.minRatio) {
    balanceIssues.push('Falta capa plata para sostener referrals estables');
  } else if (tierRatios.plata > HEALTHY_TIER_RANGES.plata.maxRatio) {
    balanceIssues.push('Hay demasiada capa plata y poca diferenciacion de valor');
  }

  if (tierRatios.bronce < HEALTHY_TIER_RANGES.bronce.minRatio) {
    balanceIssues.push('La base amplia de bronce es demasiado corta');
  } else if (tierRatios.bronce > HEALTHY_TIER_RANGES.bronce.maxRatio) {
    balanceIssues.push('La base es demasiado bronce y falta valor relacional');
  }

  const balanceHealth =
    balanceIssues.length === 0
      ? 'balanced'
      : balanceIssues.some((issue) => issue.includes('Demasiado oro') || issue.includes('falta valor'))
        ? 'warning'
        : 'attention';

  const balanceLabel =
    balanceHealth === 'balanced'
      ? 'Piramide sana'
      : balanceHealth === 'warning'
        ? 'Piramide descompensada'
        : 'Piramide a reforzar';

  const balanceDetail =
    balanceHealth === 'balanced'
      ? 'La mezcla oro/plata/bronce es bastante sana para sostener referrals, crecimiento y cobertura amplia.'
      : balanceIssues[0] || 'La base relacional necesita mejor equilibrio entre valor alto, medio y amplio.';

  return {
    total,
    health,
    tier,
    label,
    detail,
    action,
    segments: [
      { key: 'prescriptores', label: 'Prescriptores', count: prescriptores.length },
      { key: 'zona', label: 'Zona', count: zona.length },
      { key: 'colaboradores', label: 'Colaboradores', count: colaboradores.length },
      { key: 'red_personal', label: 'Red personal', count: redPersonal.length },
    ],
    topSegments: [prescriptores, zona, colaboradores, redPersonal]
      .map((segment, index) => ({
        key: ['prescriptores', 'zona', 'colaboradores', 'red_personal'][index],
        label: ['Prescriptores', 'Zona', 'Colaboradores', 'Red personal'][index],
        count: segment.length,
      }))
      .sort((a, b) => b.count - a.count),
    touchPlanBySegment,
    annualTouchPlan,
    totalAnnualTouches,
    averageTouchesPerContact,
    annualTouchDemand,
    recommendedDailyTouches,
    recommendedWeeklyTouches,
    recommendedMonthlyTouches,
    relationshipTiers: tierCounts,
    tierRatios,
    healthyTierRanges: HEALTHY_TIER_RANGES,
    balanceHealth,
    balanceLabel,
    balanceDetail,
    balanceIssues,
  };
};

export type AgentInfluenceCircleSummary = ReturnType<typeof getAgentInfluenceCircle>;
