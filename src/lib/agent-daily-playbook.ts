import type { AgentAutonomyStatus, AgentCommercialFocus } from '@/lib/property-stock-health';

export type AgentDailyPlaybook = {
  title: string;
  intro: string;
  disciplineNote: string;
  outcomePromise: string;
  riskIfSkipped: string;
  pace: {
    level: 'verde' | 'amarillo' | 'rojo';
    label: string;
    detail: string;
  };
  primaryAction: {
    key: string;
    title: string;
    detail: string;
    route: string;
    cta: string;
  };
  steps: Array<{
    key: string;
    title: string;
    detail: string;
    route: string;
    cta: string;
  }>;
};

type Input = {
  focus: AgentCommercialFocus;
  autonomy: AgentAutonomyStatus;
  touchesToday: number;
  touchTarget: number;
  captureVisitsWeek: number;
  captureVisitsTarget: number;
  capturesMonth: number;
  capturesTarget: number;
  activeOffers: number;
  visitsWithoutOffer: number;
  inboundPending: number;
  annualSalesTarget: number;
};

export const getAgentDailyPlaybook = ({
  focus,
  autonomy,
  touchesToday,
  touchTarget,
  captureVisitsWeek,
  captureVisitsTarget,
  capturesMonth,
  capturesTarget,
  activeOffers,
  visitsWithoutOffer,
  inboundPending,
  annualSalesTarget,
}: Input): AgentDailyPlaybook => {
  const autonomyLine =
    autonomy.level === 'verde'
      ? 'Te has ganado autonomía: hoy toca sostener el ritmo sin perder foco.'
      : autonomy.level === 'amarillo'
        ? 'Tienes margen para moverte, pero el CRM te marca claramente dónde empujar.'
        : 'Hoy necesitas disciplina y foco total en lo que más negocio mueve.';

  const cadencePromise = `Si completas bien este plan, vas en ritmo de ${touchTarget} toques útiles al día, ${captureVisitsTarget} visitas de captación a la semana, ${capturesTarget} captaciones al mes y ${annualSalesTarget} arras al año.`;

  const buildPace = ({
    touchReady,
    visitsReady,
    capturesReady,
    saleReady,
  }: {
    touchReady: boolean;
    visitsReady: boolean;
    capturesReady: boolean;
    saleReady: boolean;
  }) => {
    const completed = [touchReady, visitsReady, capturesReady || saleReady].filter(Boolean).length;
    if (completed >= 2) {
      return {
        level: 'verde' as const,
        label: 'Vas en ritmo hoy',
        detail: 'Tu actividad de hoy está alineada con los números que queremos construir.',
      };
    }
    if (completed >= 1) {
      return {
        level: 'amarillo' as const,
        label: 'Todavía te falta rematar',
        detail: 'Ya hay movimiento, pero aún no basta para decir que el día está bien encaminado.',
      };
    }
    return {
      level: 'rojo' as const,
      label: 'Hoy vas por detrás',
      detail: 'Si sigues así, el día no sostiene el ritmo de captación y venta que buscamos.',
    };
  };

  if (focus.focus === 'captacion') {
    const touchReady = touchesToday >= touchTarget;
    const visitsReady = captureVisitsWeek >= captureVisitsTarget;
    const capturesReady = capturesMonth >= capturesTarget;
    const primaryAction =
      !touchReady
        ? {
            key: 'activar-circulo-zona',
            title: 'Empieza activando tu círculo y tu zona',
            detail: `Hasta que no llegues a ${touchTarget} toques útiles hoy, todo lo demás tiene menos fuerza. Llevas ${touchesToday}.`,
            route: '/contacts',
            cta: 'Empezar por contactos',
          }
        : !visitsReady
          ? {
              key: 'convertir-toques-en-visitas',
              title: 'Convierte toques en visitas de captación',
              detail: `Ya te has movido, pero esta semana solo llevas ${captureVisitsWeek}/${captureVisitsTarget} visitas de captación.`,
              route: '/contacts',
              cta: 'Trabajar contactos',
            }
          : {
              key: 'cerrar-exclusiva',
              title: 'Cierra exclusiva antes de dispersarte',
              detail: `Este mes llevas ${capturesMonth}/${capturesTarget} captaciones. Ahora toca transformar trabajo en mandato.`,
              route: '/properties',
              cta: 'Ir a cerrar captación',
            };

    return {
      title: 'Hoy te toca captar',
      intro: `Tu negocio nace en círculo y zona. ${autonomyLine}`,
      disciplineNote:
        'Apunta todo y con detalle: llamada, WhatsApp, visita y resultado. Si no lo registras, luego no puedes mejorar, cobrar bien Horus ni demostrar que tu máquina comercial funciona.',
      outcomePromise: cadencePromise,
      riskIfSkipped:
        'Si hoy no haces esto, mañana tendrás menos visitas de captación, menos exclusivas y una nevera más vacía para vender.',
      pace: buildPace({ touchReady, visitsReady, capturesReady, saleReady: false }),
      primaryAction,
      steps: [
        {
          key: 'toques-dia',
          title: 'Activa tu círculo y tu zona',
          detail: `Objetivo inmediato: llegar a ${touchTarget} toques útiles hoy. Llevas ${touchesToday}.`,
          route: '/contacts',
          cta: 'Abrir contactos',
        },
        {
          key: 'visitas-captacion-semana',
          title: 'Convierte actividad en visitas de captación',
          detail: `Esta semana llevas ${captureVisitsWeek}/${captureVisitsTarget} visitas de captación. Sin entrevista no hay producto.`,
          route: '/contacts',
          cta: 'Ir a contactos',
        },
        {
          key: 'captaciones-mes',
          title: 'Cierra exclusiva',
          detail: `Este mes llevas ${capturesMonth}/${capturesTarget} captaciones. El objetivo es llenar la nevera antes de pensar en vender más.`,
          route: '/properties',
          cta: 'Ir a inmuebles',
        },
      ],
    };
  }

  if (focus.focus === 'venta') {
    const touchReady = touchesToday >= touchTarget;
    const saleReady = activeOffers > 0 || visitsWithoutOffer === 0;
    const visitsReady = activeOffers > 0 || visitsWithoutOffer < 2;
    const primaryAction =
      activeOffers > 0
        ? {
            key: 'cerrar-ofertas-vivas',
            title: 'Empieza cerrando ofertas vivas',
            detail: `Tienes ${activeOffers} ofertas activas. Si ya hay negociación, no te disperses: tu primer trabajo es empujar a arras.`,
            route: '/matches',
            cta: 'Resolver ofertas',
          }
        : visitsWithoutOffer > 0
          ? {
              key: 'recuperar-visitas-sin-oferta',
              title: 'Recupera visitas sin oferta',
              detail: `Tienes ${visitsWithoutOffer} visitas sin oferta. Ahí puede estar la siguiente arras del mes.`,
              route: '/matches',
              cta: 'Seguir visitas comprador',
            }
          : {
              key: 'resolver-inbound-frio',
              title: 'No dejes inbound frío',
              detail: `Tienes ${inboundPending} leads sin trabajar. Si ya hay producto, cada lead frío es una venta que se escapa.`,
              route: '/operations?kind=lead',
              cta: 'Ir a operaciones',
            };

    return {
      title: 'Hoy te toca vender',
      intro: `Ya tienes cartera suficiente. ${autonomyLine}`,
      disciplineNote:
        'Registrar bien cada visita, oferta y siguiente paso no es burocracia: es lo que te permite convertir stock en arras y a nosotros leer dónde se te rompe la venta.',
      outcomePromise: cadencePromise,
      riskIfSkipped:
        'Si hoy no empujas venta, el stock se enfría, las visitas pierden fuerza y el trabajo ya hecho tarda más en convertirse en arras.',
      pace: buildPace({ touchReady, visitsReady, capturesReady: false, saleReady }),
      primaryAction,
      steps: [
        {
          key: 'visitas-comprador',
          title: 'Mueve compradores y visitas',
          detail: `Tienes ${visitsWithoutOffer} visitas sin oferta. Ahí puede estar el siguiente salto a arras.`,
          route: '/matches',
          cta: 'Abrir cruces',
        },
        {
          key: 'ofertas-activas',
          title: 'Empuja negociación',
          detail: `Hay ${activeOffers} ofertas activas. Hoy el foco no es captar más, sino convertir stock en arras.`,
          route: '/matches',
          cta: 'Resolver ofertas',
        },
        {
          key: 'inbound-pendiente',
          title: 'No dejes inbound frío',
          detail: `Tienes ${inboundPending} leads sin trabajar. Si ya hay producto, cada lead frío es venta perdida.`,
          route: '/operations?kind=lead',
          cta: 'Ir a operaciones',
        },
      ],
    };
  }

  const touchReady = touchesToday >= touchTarget;
  const capturesReady = capturesMonth >= capturesTarget;
  const saleReady = activeOffers > 0 || visitsWithoutOffer < 2;
  const primaryAction =
    !touchReady
      ? {
          key: 'sostener-ritmo-comercial',
          title: 'Empieza sosteniendo el ritmo comercial',
          detail: `Tu equilibrio se rompe si no llegas a ${touchTarget} toques útiles. Hoy llevas ${touchesToday}.`,
          route: '/contacts',
          cta: 'Activar círculo',
        }
      : !capturesReady
        ? {
            key: 'reponer-cartera',
            title: 'Repón cartera antes de que se vacíe',
            detail: `Llevas ${capturesMonth}/${capturesTarget} captaciones este mes. Si no repones producto, mañana te faltará venta.`,
            route: '/properties',
            cta: 'Revisar stock',
          }
        : {
            key: 'cerrar-lo-caliente',
            title: 'Cierra lo caliente sin perder el equilibrio',
            detail: `Tienes ${activeOffers} ofertas activas y ${visitsWithoutOffer} visitas sin oferta. Ahí está el negocio de hoy.`,
            route: '/matches',
            cta: 'Empujar venta',
          };

  return {
    title: 'Hoy te toca equilibrar',
    intro: `Estás en una zona buena. ${autonomyLine}`,
    disciplineNote:
      'Si no apuntas todo, el CRM pierde verdad. Y si el CRM pierde verdad, ni tú ni dirección podéis saber qué está funcionando y qué no.',
    outcomePromise: cadencePromise,
    riskIfSkipped:
      'Si dejas caer una de las dos máquinas, o se vacía la captación o se atasca la venta. El equilibrio solo funciona si lo sostienes cada día.',
    pace: buildPace({ touchReady, visitsReady: true, capturesReady, saleReady }),
    primaryAction,
    steps: [
      {
        key: 'toques-equilibrio',
        title: 'Mantén el ritmo comercial',
        detail: `Vas ${touchesToday}/${touchTarget} en toques hoy. No dejes que se enfríe el origen del negocio.`,
        route: '/contacts',
        cta: 'Activar círculo',
      },
      {
        key: 'captaciones-equilibrio',
        title: 'Sostén base vendedora',
        detail: `Llevas ${capturesMonth}/${capturesTarget} captaciones este mes. El equilibrio se pierde si dejas de reponer cartera.`,
        route: '/properties',
        cta: 'Revisar stock',
      },
      {
        key: 'ventas-equilibrio',
        title: 'Cierra lo que ya está caliente',
        detail: `Tienes ${activeOffers} ofertas activas y ${visitsWithoutOffer} visitas sin oferta. Ahí está el negocio de hoy.`,
        route: '/matches',
        cta: 'Empujar venta',
      },
    ],
  };
};
