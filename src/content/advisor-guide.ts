export type AdvisorGuideQuizOption = {
  id: string;
  label: string;
  correct?: boolean;
};

export type AdvisorGuideExamQuestion = {
  id: string;
  prompt: string;
  options: AdvisorGuideQuizOption[];
};

export type AdvisorGuideSection = {
  id: string;
  order: number;
  title: string;
  chapterLabel?: string;
  intro?: string[];
  objective: string;
  whyItMatters: string;
  bullets: string[];
  sections?: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
  mistake: string;
  testPrompt: string;
  testOptions: AdvisorGuideQuizOption[];
  successNote: string;
};

const uniqueStrings = (items: Array<string | undefined | null>) =>
  items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .filter((item, index, array) => array.indexOf(item) === index);

const buildOptions = (correct: string, distractors: string[]) => {
  const labels = [correct, ...distractors.filter((item) => item !== correct).slice(0, 3)];
  return labels.map((label, index) => ({
    id: String.fromCharCode(97 + index),
    label,
    correct: label === correct,
  }));
};

const pickDistractors = (pool: string[], current: string, fallbackPool: string[] = []) => {
  const filtered = uniqueStrings(pool).filter((item) => item !== current);
  const fallback = uniqueStrings(fallbackPool).filter((item) => item !== current && !filtered.includes(item));
  return [...filtered, ...fallback].slice(0, 3);
};

export const ADVISOR_GUIDE_SECTIONS: AdvisorGuideSection[] = [
  {
    id: 'personas-antes-que-casas',
    order: 1,
    chapterLabel: 'Capítulo 1',
    title: 'Qué significa ser asesor inmobiliario',
    intro: [
      'En Legado Inmobiliaria no somos vendedores de casas.',
      'Somos asesores inmobiliarios.',
      'Esto puede parecer una diferencia pequeña, pero en realidad cambia completamente la forma de trabajar.',
      'Un vendedor intenta cerrar operaciones. Un asesor ayuda a las personas a tomar buenas decisiones.',
    ],
    objective: 'Entender que el negocio inmobiliario no trata de casas, sino de personas que toman decisiones importantes sobre sus casas.',
    whyItMatters: 'Detrás de cada vivienda hay una historia personal. Cuando el asesor entiende eso, deja de competir por precio y empieza a construir confianza de verdad.',
    bullets: [
      'Nuestro trabajo no consiste simplemente en enseñar pisos, publicar anuncios o buscar compradores.',
      'Nuestro trabajo consiste en entender la situación del propietario y ayudarle a tomar la mejor decisión posible.',
      'Si te centras en el inmueble, compites por precio. Si te centras en la persona, compites por confianza.',
    ],
    sections: [
      {
        title: 'No vendemos casas. Asesoramos personas.',
        paragraphs: [
          'En el sector inmobiliario las decisiones que toman los propietarios suelen ser importantes.',
        ],
        bullets: [
          'vender la vivienda familiar',
          'cambiar de ciudad',
          'comprar una vivienda mejor',
          'resolver una herencia',
          'afrontar un divorcio',
          'reorganizar su patrimonio',
        ],
      },
      {
        title: 'La diferencia entre un vendedor y un asesor',
        paragraphs: [
          'Un vendedor se centra en el producto.',
          'Habla principalmente del inmueble, los portales, las visitas y el marketing. Su objetivo es cerrar la operación.',
          'Un asesor se centra en la persona.',
          'Primero intenta entender por qué quiere vender, qué situación está viviendo, qué le preocupa y qué espera de la operación.',
          'Solo después de entender esto tiene sentido hablar de estrategia de venta.',
          'Esta diferencia es fundamental porque determina cómo te percibe el propietario.',
        ],
      },
      {
        title: 'Cuando te centras en el inmueble',
        paragraphs: [
          'Muchos agentes hablan desde el primer momento del piso: cuánto vale, cómo se anunciará, cuántas visitas harán y dónde se publicará.',
          'Cuando el propietario escucha esto suele pensar: “Todas las agencias hacen lo mismo.”',
          'En ese momento el asesor pasa a ser uno más.',
          'Y cuando todos parecen iguales, la única diferencia que percibe el propietario es el precio de la comisión.',
          'Entonces la conversación gira en torno a descuentos, competencia entre agencias y quién cobra menos.',
          'Es decir, el agente entra en una guerra de precios.',
        ],
      },
      {
        title: 'Cuando te centras en la persona',
        paragraphs: [
          'Un asesor trabaja de forma diferente.',
          'Antes de hablar del piso intenta comprender al propietario.',
        ],
        bullets: [
          '¿Qué le ha hecho plantearse vender?',
          '¿Qué plazo tiene para hacerlo?',
          '¿Qué le gustaría conseguir con la venta?',
          '¿Qué le preocupa de todo este proceso?',
        ],
      },
      {
        title: 'La confianza es la base del negocio',
        paragraphs: [
          'Cuando el propietario percibe que el asesor escucha y entiende su situación, empieza a generarse algo muy importante: confianza.',
          'Y cuando hay confianza, la relación cambia.',
          'El propietario deja de ver al agente como alguien que quiere vender su casa y empieza a verlo como alguien que puede ayudarle a tomar una buena decisión.',
          'En el negocio inmobiliario todo gira alrededor de la confianza.',
        ],
        bullets: [
          'acepta su método de trabajo',
          'escucha su criterio sobre el precio',
          'respeta sus honorarios',
          'le entrega la representación de la vivienda',
        ],
      },
      {
        title: 'El principio clave de la captación',
        paragraphs: [
          'Existe una regla muy sencilla que todo asesor inmobiliario debe recordar.',
          'Si te centras en el inmueble, compites por precio. Si te centras en la persona, compites por confianza.',
          'Cuando un agente compite por precio, negocia su comisión, pierde autoridad profesional y se convierte en uno más del mercado.',
          'Cuando un asesor compite por confianza, el propietario le elige por criterio, la conversación cambia de nivel y la relación es más profesional.',
        ],
      },
      {
        title: 'El asesor como guía en decisiones importantes',
        paragraphs: [
          'Vender una vivienda no es una decisión menor. Para muchas personas es una de las decisiones económicas más importantes de su vida.',
          'Además del dinero, intervienen emociones: recuerdos, cambios familiares, miedo a equivocarse e incertidumbre sobre el mercado.',
          'El papel del asesor es acompañar al propietario durante todo ese proceso.',
        ],
        bullets: [
          'escuchar',
          'explicar el mercado',
          'diseñar una estrategia',
          'ayudar a tomar decisiones',
          'acompañar hasta el final de la operación',
        ],
      },
      {
        title: 'La mentalidad correcta para empezar',
        paragraphs: [
          'Un buen asesor inmobiliario no intenta convencer a todo el mundo de vender.',
          'Su trabajo consiste en identificar a las personas que realmente necesitan vender y ayudarles a hacerlo bien.',
          'Eso significa que algunas veces la mejor decisión para un propietario puede ser esperar, no vender todavía o replantear su estrategia.',
          'Cuando un asesor actúa con esta honestidad, construye algo mucho más valioso que una captación rápida: una relación de confianza a largo plazo.',
          'Y en el negocio inmobiliario las relaciones son el verdadero activo del asesor.',
        ],
      },
    ],
    mistake: 'Hablar demasiado pronto del inmueble y demasiado poco de la persona, su situación, sus miedos y su confianza.',
    testPrompt: '¿Qué significa de verdad ser asesor inmobiliario?',
    testOptions: [
      { id: 'a', label: 'Cerrar operaciones lo más rápido posible' },
      { id: 'b', label: 'Ayudar a las personas a tomar buenas decisiones inmobiliarias', correct: true },
      { id: 'c', label: 'Enseñar inmuebles y publicar anuncios antes que nada' },
    ],
    successNote: 'El negocio inmobiliario trata de personas que toman decisiones importantes, no solo de inmuebles.',
  },
  {
    id: 'circulo-y-zona',
    order: 2,
    chapterLabel: 'Capítulo 2',
    title: 'Cómo funciona realmente el negocio inmobiliario',
    intro: [
      'Muchos agentes nuevos creen que el negocio inmobiliario empieza cuando aparece una vivienda para vender.',
      'En realidad, el negocio empieza mucho antes.',
      'Empieza con personas.',
      'Antes de que exista una vivienda en venta, siempre hay una persona que está tomando una decisión.',
    ],
    objective: 'Entender que el negocio inmobiliario funciona como una cadena que empieza con personas y termina en recomendaciones.',
    whyItMatters: 'Cuando el asesor entiende bien esta cadena, deja de trabajar por intuición y empieza a construir negocio con lógica, orden y repetición.',
    bullets: [
      'La vivienda es solo la consecuencia de una decisión personal.',
      'El negocio inmobiliario empieza con personas, sigue con conversaciones y acaba en recomendaciones.',
      'Sin captaciones bien trabajadas, toda la cadena se rompe.',
    ],
    sections: [
      {
        title: 'El negocio inmobiliario empieza mucho antes de la vivienda',
        paragraphs: [
          'Antes de que exista una vivienda en venta, siempre hay una persona que está tomando una decisión.',
        ],
        bullets: [
          'cambiar de ciudad',
          'comprar una vivienda mejor',
          'vender una herencia',
          'reorganizar su situación familiar',
          'liberar patrimonio',
        ],
      },
      {
        title: 'La cadena real del negocio inmobiliario',
        paragraphs: [
          'El negocio inmobiliario funciona como una cadena. Cada eslabón lleva al siguiente.',
          'Personas -> conversaciones -> propietarios -> visitas de captación -> representación -> compradores -> ofertas -> arras -> notaría -> recomendaciones.',
          'Cuando uno de estos pasos falla, el negocio se detiene.',
          'Por eso es importante entender cómo se construye cada etapa.',
        ],
      },
      {
        title: 'Personas',
        paragraphs: [
          'Todo empieza con personas.',
        ],
        bullets: [
          'amigos',
          'conocidos',
          'vecinos',
          'clientes',
          'contactos profesionales',
          'personas del barrio',
        ],
      },
      {
        title: 'Conversaciones',
        paragraphs: [
          'Las operaciones inmobiliarias empiezan casi siempre con una conversación. No empiezan en los portales inmobiliarios.',
          'Empiezan cuando alguien dice algo como “Estamos pensando en vender”, “Nos gustaría comprar algo más grande” o “Quizá deberíamos vender esta vivienda”.',
          'El asesor debe aprender a detectar esas conversaciones.',
          'Y para detectarlas hay que hablar con personas.',
        ],
      },
      {
        title: 'Propietarios',
        paragraphs: [
          'De todas las personas con las que hablas, algunas serán propietarios que pueden estar pensando en vender.',
          'Pero no todos los propietarios están preparados para vender.',
          'Por eso el asesor debe aprender a diagnosticar la situación del propietario.',
        ],
        bullets: [
          'motivo',
          'plazo',
          'motivación real',
        ],
      },
      {
        title: 'Visitas de captación',
        paragraphs: [
          'Cuando un propietario está considerando vender, el siguiente paso es la visita.',
          'La visita no es solo para ver la vivienda.',
          'La visita sirve para entender la situación del propietario, analizar la vivienda, explicar el mercado y empezar a construir una relación de confianza.',
          'Una buena visita es el inicio de una buena captación.',
        ],
      },
      {
        title: 'Representación',
        paragraphs: [
          'Cuando el propietario confía en el asesor, le entrega la representación de la venta.',
          'Este es un momento clave.',
          'A partir de aquí el asesor se convierte en la persona responsable de gestionar la operación.',
        ],
        bullets: [
          'diseñar estrategia',
          'coordinar la comercialización',
          'gestionar compradores',
          'negociar ofertas',
        ],
      },
      {
        title: 'Compradores',
        paragraphs: [
          'Una vez que la vivienda está bien posicionada en el mercado, empiezan a aparecer compradores.',
          'El trabajo del asesor es filtrar compradores, organizar visitas útiles y recoger feedback del mercado.',
          'No se trata de hacer muchas visitas.',
          'Se trata de hacer visitas con compradores adecuados.',
        ],
      },
      {
        title: 'Ofertas, arras y notaría',
        paragraphs: [
          'Cuando un comprador está interesado, aparece la oferta.',
          'Aquí empieza una fase importante del trabajo del asesor: negociar condiciones, proteger los intereses del vendedor y acercar posiciones entre comprador y vendedor.',
          'Cuando se alcanza un acuerdo, se firma el contrato de arras.',
          'Después se prepara la operación para la firma en notaría.',
          'El asesor acompaña al cliente durante todo este proceso.',
        ],
      },
      {
        title: 'Recomendaciones',
        paragraphs: [
          'Una operación no termina realmente en notaría.',
          'Si el cliente ha tenido una buena experiencia, ocurrirá algo muy importante: recomendará al asesor a otras personas.',
          'Y así el ciclo vuelve a empezar.',
          'Las recomendaciones son una de las fuentes de negocio más valiosas.',
        ],
      },
      {
        title: 'La parte más importante de la cadena',
        paragraphs: [
          'Aunque la cadena tiene muchos pasos, hay uno especialmente importante: las captaciones.',
          'Sin viviendas bien representadas no hay negocio.',
          'Por eso el asesor debe dedicar una parte importante de su trabajo a hablar con personas, detectar propietarios y conseguir visitas de captación.',
        ],
      },
      {
        title: 'El error más común de los agentes nuevos',
        paragraphs: [
          'Muchos agentes se concentran en portales, anuncios, visitas y compradores, pero olvidan el origen del negocio.',
          'El origen siempre está en las relaciones con personas y las captaciones.',
          'Por eso los asesores más productivos no son los que enseñan más viviendas.',
          'Son los que tienen mejores relaciones con propietarios.',
        ],
      },
    ],
    mistake: 'Pensar que el negocio empieza en los portales, en las visitas o en los compradores, y olvidar que el origen real está en las personas y las captaciones.',
    testPrompt: '¿Dónde empieza realmente el negocio inmobiliario?',
    testOptions: [
      { id: 'a', label: 'Cuando aparece una vivienda en venta' },
      { id: 'b', label: 'Cuando empiezan a entrar compradores' },
      { id: 'c', label: 'Con personas y conversaciones que luego se convierten en captación', correct: true },
    ],
    successNote: 'La vivienda llega después; el negocio empieza en la relación, la conversación y la captación.',
  },
  {
    id: 'captacion-y-exclusiva',
    order: 3,
    chapterLabel: 'Capítulo 3',
    title: 'El rol del asesor inmobiliario',
    intro: [
      'Cuando alguien empieza en el sector inmobiliario suele pensar que el trabajo consiste principalmente en enseñar viviendas, publicar anuncios y buscar compradores.',
      'En realidad, estas son solo pequeñas partes del trabajo.',
      'El verdadero trabajo del asesor inmobiliario consiste en tres funciones principales: generar confianza, diseñar una estrategia de venta y gestionar la operación hasta el final.',
    ],
    objective: 'Entender que el valor real del asesor aparece cuando genera confianza, diseña estrategia y acompaña toda la operación.',
    whyItMatters: 'Cuando el agente entiende bien su rol, deja de actuar como un enseñador de viviendas y empieza a comportarse como un profesional que guía decisiones importantes.',
    bullets: [
      'El trabajo no consiste solo en enseñar viviendas, publicar anuncios o buscar compradores.',
      'El asesor profesional escucha, analiza el mercado, diseña estrategia y acompaña a las personas.',
      'El verdadero valor del asesor está en gestionar correctamente toda la operación.',
    ],
    sections: [
      {
        title: 'Qué hace realmente un asesor inmobiliario',
        paragraphs: [
          'Cuando estas tres funciones se realizan correctamente, el asesor aporta un valor real al propietario.',
        ],
        bullets: [
          'generar confianza',
          'diseñar una estrategia de venta',
          'gestionar la operación hasta el final',
        ],
      },
      {
        title: '1. Generar confianza',
        paragraphs: [
          'La primera tarea del asesor es generar confianza.',
          'Un propietario que decide vender su vivienda está tomando una decisión importante económicamente, emocionalmente y familiarmente.',
          'Por eso necesita confiar en la persona que le va a acompañar en ese proceso.',
          'La confianza no se genera hablando mucho del piso.',
          'Se genera cuando el asesor demuestra que escucha, entiende la situación del propietario, conoce el mercado y actúa con honestidad.',
          'Cuando un propietario percibe esto, empieza a confiar.',
          'Y cuando hay confianza, la relación cambia.',
          'El propietario deja de buscar agencias y empieza a buscar un asesor de confianza.',
        ],
      },
      {
        title: '2. Diseñar la estrategia de venta',
        paragraphs: [
          'Una vivienda no se vende solo por anunciarla.',
          'Cada vivienda necesita una estrategia.',
          'El asesor debe analizar el mercado, el tipo de vivienda, el perfil de comprador y el posicionamiento del precio.',
          'A partir de ese análisis se diseña la estrategia de venta.',
          'El asesor no improvisa. El asesor trabaja con criterio y estrategia.',
        ],
        bullets: [
          'precio de salida',
          'posicionamiento en el mercado',
          'tipo de compradores objetivo',
          'ritmo de visitas',
          'ajustes si el mercado lo requiere',
        ],
      },
      {
        title: '3. Gestionar la operación',
        paragraphs: [
          'Una operación inmobiliaria tiene muchas fases.',
          'El asesor acompaña al propietario en todas ellas.',
        ],
        bullets: [
          'preparar la vivienda para el mercado',
          'gestionar las visitas',
          'recoger feedback de compradores',
          'gestionar ofertas',
          'negociar condiciones',
          'preparar la operación para notaría',
        ],
      },
      {
        title: 'El asesor como intermediario profesional',
        paragraphs: [
          'Durante este proceso suelen aparecer dudas, miedos y decisiones importantes.',
          'El asesor actúa como guía del proceso.',
          'Su papel es aportar claridad y ayudar al propietario a tomar decisiones informadas.',
          'En una operación inmobiliaria hay dos partes con intereses distintos: el vendedor y el comprador.',
          'Cada uno quiere conseguir el mejor resultado posible.',
          'El asesor actúa como intermediario profesional.',
        ],
        bullets: [
          'facilitar la comunicación',
          'evitar conflictos innecesarios',
          'encontrar puntos de acuerdo',
        ],
      },
      {
        title: 'Lo que diferencia a un asesor profesional',
        paragraphs: [
          'Un asesor profesional no se limita a enseñar viviendas.',
        ],
        bullets: [
          'entiende a las personas',
          'analiza el mercado',
          'diseña una estrategia',
          'acompaña durante todo el proceso',
        ],
      },
      {
        title: 'El asesor construye relaciones, no solo operaciones',
        paragraphs: [
          'Por eso el valor del asesor no está en abrir una puerta.',
          'Está en gestionar correctamente toda la operación.',
          'Una operación inmobiliaria puede durar unos meses.',
          'Pero una relación de confianza puede durar años.',
          'Cuando un cliente ha tenido una buena experiencia con su asesor, suele ocurrir algo muy valioso: vuelve a contactar en el futuro o recomienda al asesor a familiares o amigos.',
          'Por eso el objetivo del asesor no es solo cerrar operaciones.',
          'Es construir relaciones de confianza a largo plazo.',
        ],
      },
    ],
    mistake: 'Creer que el trabajo consiste solo en enseñar viviendas, publicar anuncios o buscar compradores, sin entender que el valor real está en la confianza, la estrategia y la gestión completa.',
    testPrompt: '¿Cuál es el trabajo real de un asesor inmobiliario?',
    testOptions: [
      { id: 'a', label: 'Abrir puertas y enseñar viviendas' },
      { id: 'b', label: 'Generar confianza, diseñar estrategia y gestionar la operación hasta el final', correct: true },
      { id: 'c', label: 'Publicar anuncios y esperar compradores' },
    ],
    successNote: 'El asesor profesional no vende casas sin más: genera confianza, diseña estrategia y acompaña todo el proceso.',
  },
  {
    id: 'ficha-rica-y-producto',
    order: 4,
    chapterLabel: 'Capítulo 4',
    title: 'La rutina diaria del asesor inmobiliario',
    intro: [
      'El negocio inmobiliario no se construye con acciones puntuales.',
      'Se construye con actividad constante.',
      'Un asesor que trabaja con disciplina cada día termina generando conversaciones, propietarios, captaciones y ventas.',
      'Por eso es fundamental tener una rutina clara de trabajo.',
    ],
    objective: 'Entender que el éxito inmobiliario depende de repetir cada día las actividades correctas y registrarlas bien en el CRM.',
    whyItMatters: 'Sin rutina, el negocio se vuelve irregular. Con disciplina diaria, el asesor construye un negocio estable y predecible.',
    bullets: [
      'El trabajo diario se divide en generar negocio, convertir negocio y cuidar relaciones.',
      'La mañana suele servir mejor para abrir oportunidades nuevas.',
      'La tarde suele ser mejor para visitas, reuniones y seguimiento.',
    ],
    sections: [
      {
        title: 'Las tres actividades del asesor cada día',
        paragraphs: [
          'El trabajo del asesor inmobiliario se puede dividir en tres tipos de actividad.',
        ],
        bullets: [
          'Generar negocio',
          'Convertir negocio',
          'Cuidar relaciones',
        ],
      },
      {
        title: '1. Generar negocio',
        paragraphs: [
          'Generar negocio significa crear nuevas oportunidades.',
          'Esto incluye hablar con personas, trabajar la zona, activar contactos, pedir recomendaciones y detectar posibles vendedores.',
          'Esta es la parte del trabajo que asegura el futuro.',
          'Muchos asesores la descuidan porque no genera resultados inmediatos.',
          'Pero sin esta actividad, tarde o temprano el negocio se detiene.',
        ],
      },
      {
        title: '2. Convertir negocio',
        paragraphs: [
          'Convertir negocio significa trabajar las oportunidades que ya existen.',
        ],
        bullets: [
          'visitas de captación',
          'visitas con compradores',
          'seguimiento de interesados',
          'gestión de ofertas',
        ],
      },
      {
        title: '3. Cuidar relaciones',
        paragraphs: [
          'El negocio inmobiliario se basa en relaciones.',
          'Por eso el asesor debe dedicar tiempo a mantener contacto con clientes actuales, antiguos clientes, compradores y prescriptores.',
          'Muchas operaciones llegan meses o incluso años después de la primera conversación.',
          'Mantener estas relaciones es una inversión a largo plazo.',
        ],
      },
      {
        title: 'Cómo estructurar el día de trabajo',
        paragraphs: [
          'Una forma sencilla de organizar el día es dividirlo en dos bloques principales.',
        ],
      },
      {
        title: 'Mañana: generar negocio',
        paragraphs: [
          'Las primeras horas del día son ideales para actividades que generan nuevas oportunidades.',
        ],
        bullets: [
          'llamadas a contactos',
          'conversaciones con propietarios',
          'trabajar la zona',
          'activar recomendaciones',
        ],
      },
      {
        title: 'Tarde: convertir negocio',
        paragraphs: [
          'Las tardes suelen ser el momento en que los propietarios y compradores están más disponibles.',
          'Por eso se utilizan para visitas de captación, visitas con compradores, reuniones y seguimiento.',
          'Aquí es donde el trabajo realizado por la mañana empieza a dar resultados.',
        ],
      },
      {
        title: 'El CRM: el coach del asesor',
        paragraphs: [
          'En Legado Inmobiliaria el CRM no es solo una herramienta para guardar información.',
          'El CRM funciona como el coach del asesor.',
          'Su función es ayudar al asesor a saber si está construyendo negocio o si simplemente está ocupado.',
          'El CRM permite ver con claridad cuántas personas ha contactado el asesor, cuántas conversaciones ha tenido, cuántas visitas de captación ha realizado, cuántas captaciones ha conseguido y cuántas operaciones están avanzando.',
          'De esta forma el asesor puede entender rápidamente dónde está su negocio.',
        ],
      },
      {
        title: 'Lo que no se registra no existe',
        paragraphs: [
          'Registrar la actividad en el CRM no es burocracia.',
          'Es parte del trabajo profesional.',
          'Si una llamada, una conversación o una visita no se registra, no se puede medir, no se puede analizar y no se puede mejorar.',
          'El CRM permite convertir la actividad diaria en información útil para mejorar el trabajo.',
        ],
      },
      {
        title: 'El CRM ayuda a detectar problemas',
        paragraphs: [
          'Cuando el asesor registra su actividad, el CRM permite detectar rápidamente dónde está el problema.',
        ],
        bullets: [
          'si hay muchas conversaciones pero pocas visitas de captación',
          'si hay visitas pero pocas captaciones',
          'si hay captaciones pero pocas ofertas',
        ],
      },
      {
        title: 'El CRM también protege al asesor',
        paragraphs: [
          'Registrar bien la actividad tiene otra ventaja importante.',
          'Permite demostrar el trabajo realizado.',
          'En inmobiliaria es fácil tener la sensación de que se trabaja mucho sin resultados.',
          'Cuando la actividad está registrada, el asesor puede ver con claridad qué ha hecho, qué ha funcionado y qué necesita mejorar.',
          'Esto convierte el CRM en una herramienta muy valiosa para el desarrollo profesional.',
        ],
      },
    ],
    mistake: 'Trabajar de forma desordenada, saltando de una cosa a otra, sin dedicar bloques reales a generar negocio ni registrar lo que haces.',
    testPrompt: '¿Qué construye de verdad un negocio estable en inmobiliaria?',
    testOptions: [
      { id: 'a', label: 'Hacer algo extraordinario de vez en cuando' },
      { id: 'b', label: 'Hacer las actividades correctas cada día y registrarlas bien', correct: true },
      { id: 'c', label: 'Esperar a que salgan operaciones para ponerse a trabajar' },
    ],
    successNote: 'La disciplina diaria y el registro correcto convierten la actividad en negocio repetible.',
  },
  {
    id: 'registrar-todo',
    order: 6,
    chapterLabel: 'Capítulo 6',
    title: 'Cómo trabajar una zona',
    intro: [
      'La zona no se reparte. La zona se cultiva.',
      'Muchos agentes nuevos entienden mal lo que significa trabajar una zona.',
      'No se trata de pasear sin método, repartir flyers o tocar puertas al azar.',
      'Trabajar una zona significa convertirse, poco a poco, en el asesor inmobiliario que más conoce, más entiende y más presencia tiene en ese entorno.',
    ],
    objective: 'Entender que trabajar una zona significa integrarse en un ecosistema humano para detectar a tiempo propietarios reales o futuros.',
    whyItMatters: 'Una zona bien trabajada se convierte en una fuente constante de conversaciones, relaciones, captaciones y recomendaciones.',
    bullets: [
      'La zona no es solo un conjunto de calles: es un ecosistema humano.',
      'El objetivo real no es repartir publicidad, sino detectar propietarios y generar conversaciones de confianza.',
      'Caminar sin método no es trabajar la zona; observar, registrar y seguir sí lo es.',
    ],
    sections: [
      {
        title: 'Por qué trabajar una zona',
        paragraphs: [
          'Trabajar una zona tiene varias ventajas muy importantes, especialmente para un asesor junior.',
        ],
      },
      {
        title: '1. Te da foco',
        paragraphs: [
          'Uno de los grandes problemas de los agentes nuevos es que trabajan un poco de todo y al final no dominan nada.',
          'Cuando un asesor trabaja una zona concreta, repite calles, reconoce edificios, identifica patrones y gana seguridad.',
          'Eso acelera muchísimo el aprendizaje.',
        ],
      },
      {
        title: '2. Te da contexto',
        paragraphs: [
          'Cuanto más conoces una zona, mejor puedes entender qué tipo de vivienda se vende mejor, qué tipo de propietario hay, qué compradores buscan ahí, qué rangos de precio son razonables y qué edificios tienen más potencial de rotación.',
          'Ese conocimiento da autoridad. Y la autoridad genera confianza.',
        ],
      },
      {
        title: '3. Te da visibilidad',
        paragraphs: [
          'Las personas empiezan a verte repetidamente.',
          'Y en inmobiliaria la repetición importa mucho.',
          'Un vecino que te ve varias veces, hablando con otros vecinos, entrando en edificios, conversando con negocios y moviéndote con naturalidad, empieza a percibirte como alguien que forma parte del entorno.',
          'Eso reduce la fricción cuando llega el momento de hablar.',
        ],
      },
      {
        title: '4. Te da relaciones',
        paragraphs: [
          'La mayoría de captaciones no llegan por una acción aislada.',
          'Llegan por acumulación de contactos y confianza.',
          'Trabajar una zona te permite construir una red de relaciones compuesta por vecinos, conserjes, comerciantes, administradores, clientes, antiguos clientes y propietarios que hoy no venden, pero venderán.',
          'Ese tejido relacional es mucho más valioso que cualquier acción puntual.',
        ],
      },
      {
        title: 'El objetivo real de trabajar zona',
        paragraphs: [
          'El objetivo de trabajar una zona no es repartir publicidad ni que te vean sin más.',
          'El objetivo real es este: detectar propietarios que podrían vender y generar conversaciones de confianza con ellos o con personas que los conocen.',
          'Cuando entiendes esto, dejas de actuar como alguien que intenta promocionarse.',
          'Empiezas a actuar como alguien que observa, escucha, pregunta, relaciona información y detecta oportunidades reales.',
        ],
      },
      {
        title: 'Qué significa conocer una zona de verdad',
        paragraphs: [
          'Conocer una zona no es solo saber qué calles tiene.',
          'Conocer una zona de verdad significa entender cinco niveles.',
        ],
        bullets: [
          'nivel físico',
          'nivel inmobiliario',
          'nivel humano',
          'nivel relacional',
          'nivel de oportunidad',
        ],
      },
      {
        title: 'Cómo empezar a trabajar una zona',
        paragraphs: [
          'Un asesor junior no necesita complicarse. Necesita método.',
          'El trabajo de zona puede organizarse en cuatro fases.',
        ],
        bullets: [
          'Elegir y acotar la zona',
          'Observar antes de hablar',
          'Relacionarte con naturalidad',
          'Registrar y hacer seguimiento',
        ],
      },
      {
        title: 'Fase 1. Elegir y acotar la zona',
        paragraphs: [
          'La zona debe ser concreta.',
          'No sirve decir Benidorm, Altea o Finestrat si eso es demasiado amplio.',
          'Hay que acotar a algo que el asesor pueda trabajar de verdad: unas calles concretas, un barrio, una urbanización, un conjunto de edificios o un núcleo con lógica común.',
          'La clave no es abarcar mucho. La clave es repetir bien.',
        ],
      },
      {
        title: 'Fase 2. Observar antes de hablar',
        paragraphs: [
          'Antes de hablar, hay que observar.',
          'Caminar la zona con atención permite detectar muchísimo.',
        ],
        bullets: [
          'carteles de venta y alquiler',
          'locales de barrio',
          'portales y estado de las fincas',
          'tablones de comunidad',
          'buzones',
          'conserjería',
          'flujo de vecinos',
          'viviendas cerradas o poco usadas',
          'edificios con tipologías interesantes',
        ],
      },
      {
        title: 'Fase 3. Relacionarte con naturalidad',
        paragraphs: [
          'Una vez observada la zona, empieza la parte relacional.',
          'No se trata de ir a colocar un discurso.',
          'Se trata de abrir conversaciones normales y memorables.',
          'El objetivo no es venderse. El objetivo es presentarse, ubicarse, generar familiaridad y detectar información útil.',
        ],
      },
      {
        title: 'Fase 4. Registrar y hacer seguimiento',
        paragraphs: [
          'Aquí es donde muchos fallan.',
          'Trabajan una zona, hablan con gente, descubren cosas y no registran nada.',
          'Eso es perder capital comercial.',
          'Cada interacción útil debe alimentar el CRM.',
          'Porque el trabajo de zona no da fruto solo hoy. Da fruto por acumulación. Y sin registro no hay acumulación útil.',
        ],
      },
      {
        title: 'A quién hablar en una zona',
        paragraphs: [
          'No todas las personas tienen el mismo valor informativo. Hay perfiles especialmente interesantes.',
        ],
        bullets: [
          'vecinos',
          'comercios de proximidad',
          'conserjes, porteros y mantenimiento',
          'administradores y perfiles vinculados a comunidades',
          'compradores de la zona',
        ],
      },
      {
        title: 'Cómo abrir una conversación en zona',
        paragraphs: [
          'La apertura debe ser corta, natural y sin tono de vendedor.',
          'Nunca conviene empezar con un discurso largo.',
          'La mejor entrada suele combinar tres elementos: identificación simple, contexto local y pregunta fácil.',
          'Lo importante no es memorizar frases perfectas.',
          'Lo importante es el enfoque: tranquilo, sin presión, sin sonar necesitado y sin precipitarse a pedir nada.',
        ],
      },
      {
        title: 'Qué debes evitar al trabajar zona',
        paragraphs: [
          'Hay varios errores que dañan mucho la percepción del asesor.',
        ],
        bullets: [
          'sonar comercial demasiado rápido',
          'hablar más de la cuenta',
          'ir sin continuidad',
          'no registrar información',
          'querer resultados inmediatos',
        ],
      },
      {
        title: 'Qué información debe recoger el asesor',
        paragraphs: [
          'No hace falta registrar novelas. Hace falta registrar información accionable.',
        ],
        bullets: [
          'nombre de la persona',
          'ubicación exacta',
          'edificio o calle',
          'relación con la zona',
          'posibles propietarios detectados',
          'comentarios sobre vecinos o ventas futuras',
          'nivel de interés real',
          'próxima acción recomendada',
        ],
      },
      {
        title: 'Cómo usar el CRM en el trabajo de zona',
        paragraphs: [
          'El CRM no solo sirve para clientes ya avanzados. También sirve para convertir el trabajo de calle en un sistema.',
          'Cuando el asesor trabaja una zona y registra correctamente, el CRM permite saber cuántos contactos de zona está generando, identificar edificios con potencial, hacer seguimiento a vecinos o comercios clave, marcar prospectos en barbecho y programar próximas acciones.',
          'Por eso, en el trabajo de zona, el CRM actúa otra vez como coach.',
        ],
      },
      {
        title: 'Señales de que una zona está empezando a funcionar',
        paragraphs: [
          'Un asesor puede saber que está construyendo bien una zona cuando empiezan a ocurrir pequeñas señales.',
        ],
        bullets: [
          'algunas personas ya le reconocen',
          'ciertos negocios ya saben quién es',
          'aparecen conversaciones espontáneas sobre ventas',
          'un vecino le habla de alguien que quiere vender',
          'empieza a recibir pequeñas recomendaciones',
          'se siente cada vez más parte del entorno',
        ],
      },
      {
        title: 'Qué mentalidad debe tener el asesor',
        paragraphs: [
          'La zona no se trabaja con ansiedad.',
          'Se trabaja con paciencia, curiosidad y continuidad.',
          'El asesor no debe pensar “¿Cuántos pisos saco hoy?”.',
          'Debe pensar “¿Qué relaciones construyo hoy que pueden traer negocio mañana?”.',
          'Ese cambio mental marca la diferencia entre un captador torpe y un asesor serio.',
        ],
      },
    ],
    mistake: 'Trabajar la zona como si fuera una acción rápida para sacar pisos ya, en vez de tratarla como una construcción lenta de información, relaciones y confianza.',
    testPrompt: '¿Qué significa trabajar una zona de forma profesional?',
    testOptions: [
      { id: 'a', label: 'Pasear, repartir flyers y tocar puertas al azar' },
      { id: 'b', label: 'Integrarte en el entorno, construir relaciones y detectar propietarios reales o futuros', correct: true },
      { id: 'c', label: 'Esperar a que la zona te dé viviendas por simple presencia' },
    ],
    successNote: 'La zona se cultiva con observación, relación, registro y continuidad, no con ansiedad comercial.',
  },
  {
    id: 'postventa-y-prescripcion',
    order: 7,
    chapterLabel: 'Capítulo 7',
    title: 'La primera entrevista con el propietario',
    intro: [
      'La primera entrevista no sirve para convencer al propietario.',
      'Sirve para diagnosticar su situación antes de intentar captar la vivienda.',
      'Aquí es donde un asesor deja de ser alguien que va a ver un piso y empieza a actuar como un profesional.',
      'Si diagnosticas bien, ganas tiempo, cartera y autoridad. Si diagnosticas mal, llenas tu agenda de falsas oportunidades.',
    ],
    objective: 'Entender que la primera entrevista con un propietario sirve para diagnosticar si realmente necesita vender y en qué condiciones tiene sentido avanzar.',
    whyItMatters: 'Las mejores captaciones no se ganan hablando más del piso. Se ganan entendiendo mejor a la persona, su motivo, su plazo y su motivación real.',
    bullets: [
      'Antes de hablar de precio, marketing o portales hay que entender motivo, plazo y motivación real.',
      'Si te centras en el inmueble, compites por precio. Si te centras en la persona, compites por confianza.',
      'No todos los propietarios están para captar hoy: algunos están en barbecho y necesitan relación, no presión.',
    ],
    sections: [
      {
        title: 'El objetivo de la primera entrevista',
        paragraphs: [
          'Muchos creen que el objetivo es captar la vivienda. Ese no es el objetivo.',
          'El objetivo real de la primera entrevista es entender la situación del propietario.',
          'Antes de hablar de precio, marketing, portales o visitas, el asesor debe comprender tres cosas fundamentales.',
        ],
        bullets: [
          'el motivo de la venta',
          'el plazo',
          'la motivación real',
        ],
      },
      {
        title: 'El error más común de los agentes',
        paragraphs: [
          'Muchos agentes llegan a la primera visita y empiezan a hablar demasiado rápido de cuánto vale la vivienda, dónde la anunciarán, cuántas visitas harán y qué portales usarán.',
          'Eso hace que el propietario piense que todas las agencias dicen lo mismo.',
          'Cuando ocurre, el asesor pasa a ser uno más y la decisión se toma por precio, promesas o insistencia.',
          'Ese es el peor escenario posible.',
        ],
      },
      {
        title: 'La primera entrevista es un diagnóstico',
        paragraphs: [
          'El asesor inmobiliario no empieza vendiendo. Empieza diagnosticando.',
          'Igual que un médico no receta antes de entender el problema, un asesor no puede diseñar una estrategia antes de entender la situación del propietario.',
          'El diagnóstico consiste en entender por qué quiere vender, cuándo quiere vender, qué espera conseguir y qué le preocupa.',
          'Cuando el asesor entiende esto, la conversación cambia completamente.',
        ],
      },
      {
        title: 'Centrarse en la persona, no en la vivienda',
        paragraphs: [
          'Muchos agentes hablan del inmueble. Un asesor habla de la persona.',
          'Cuando la conversación se centra en la vivienda, el asesor compite con otras agencias, la conversación gira en torno al precio y el propietario compara comisiones.',
          'Cuando la conversación se centra en la persona, aparece confianza, el asesor entiende el contexto y el propietario se siente escuchado.',
          'Y cuando hay confianza, el propietario suele tomar decisiones más claras.',
        ],
      },
      {
        title: 'Principio clave de captación',
        paragraphs: [
          'Existe una regla muy sencilla que todo asesor debe recordar.',
          'Si te centras en el inmueble, compites por precio. Si te centras en la persona, compites por confianza.',
        ],
      },
      {
        title: 'Qué debe observar el asesor',
        paragraphs: [
          'Durante la primera entrevista el asesor no solo escucha respuestas. También observa señales.',
        ],
        bullets: [
          'cómo habla el propietario',
          'si parece decidido o dubitativo',
          'si habla con ilusión o con dudas',
          'si menciona presión o urgencia',
          'si parece tener expectativas irreales',
        ],
      },
      {
        title: 'Las preguntas de diagnóstico',
        paragraphs: [
          'Durante la conversación el asesor debe hacer preguntas que ayuden a entender la situación real.',
          'Estas preguntas no deben sonar como un interrogatorio. Deben formar parte natural de la conversación.',
        ],
      },
      {
        title: 'Pregunta 1. ¿Qué le ha hecho plantearse vender la vivienda?',
        paragraphs: [
          'Esta pregunta revela el motivo.',
          'Un vendedor real casi siempre tiene un motivo claro.',
        ],
        bullets: [
          'cambio de ciudad',
          'divorcio',
          'herencia',
          'cambio de vivienda',
          'jubilación',
          'necesidad económica',
        ],
      },
      {
        title: 'Pregunta 2. ¿Qué plazo tiene para vender?',
        paragraphs: [
          'El plazo indica el nivel de urgencia.',
        ],
        bullets: [
          '“Nos gustaría vender este año.”',
          '“Queremos cambiar de casa en unos meses.”',
          '“Nos mudamos pronto.”',
          '“No tengo prisa.”',
          '“Vamos viendo.”',
          '“Estoy mirando.”',
        ],
      },
      {
        title: 'Pregunta 3. Si dentro de un año la vivienda no se ha vendido, ¿qué ocurriría?',
        paragraphs: [
          'Esta pregunta es muy reveladora porque obliga al propietario a pensar en las consecuencias.',
          'Si responde “No pasaría nada”, probablemente no tiene necesidad real de vender.',
          'Si responde “Sería un problema porque necesitamos comprar otra vivienda”, entonces sí existe una motivación clara.',
        ],
      },
      {
        title: 'La pregunta más poderosa',
        paragraphs: [
          'Hay una pregunta especialmente útil para entender la verdadera intención del propietario.',
          '“Si mañana le traigo un comprador que paga exactamente lo que usted pide, cuánto tardamos en vender?”',
          'Funciona porque obliga al propietario a imaginar una situación real, no una teoría.',
        ],
      },
      {
        title: 'Cómo interpretar la respuesta',
        paragraphs: [
          'Las respuestas suelen revelar mucho.',
          'Cuando un propietario responde “Venderíamos”, “Tendríamos que organizarnos” o “En unos meses”, suele haber decisión.',
          'Cuando responde “Tendría que pensarlo”, “No lo sé” o “Depende”, normalmente todavía no está preparado para vender.',
        ],
      },
      {
        title: 'Cuando el propietario dice “no tengo prisa”',
        paragraphs: [
          'Muchos propietarios dicen esto y un asesor no debe discutir.',
          'Puede responder algo como: “Perfecto. Si realmente no hay prisa, lo más sensato es no vender hasta que el mercado o su situación lo aconsejen.”',
          'Esta respuesta genera confianza porque demuestra que el asesor no intenta forzar la venta, respeta la situación y piensa en el interés del propietario.',
        ],
      },
      {
        title: 'Detectar propietarios poco motivados',
        paragraphs: [
          'No todos los propietarios que hablan de vender están preparados para hacerlo.',
          'Hay frases que suelen indicar baja motivación.',
        ],
        bullets: [
          '“Si me pagan lo que quiero vendo.”',
          '“Voy a probar.”',
          '“No tengo prisa.”',
          '“Vamos viendo.”',
        ],
      },
      {
        title: 'Prospectos en barbecho',
        paragraphs: [
          'No todos los propietarios son clientes hoy. Algunos están en barbecho.',
          'Esto significa que hoy no están preparados para vender, pero podrían estarlo en el futuro.',
          'El asesor debe mantener la relación, registrar la información en el CRM y hacer seguimiento cuando tenga sentido.',
          'Muchos vendedores reales aparecen meses después de la primera conversación.',
        ],
      },
      {
        title: 'Los cinco tipos de vendedores',
        paragraphs: [
          'Durante la entrevista el asesor debe intentar identificar qué tipo de vendedor tiene delante.',
        ],
        bullets: [
          'el vendedor decidido',
          'el vendedor con necesidad',
          'el vendedor aspiracional',
          'el vendedor explorador',
          'el vendedor escéptico',
        ],
      },
      {
        title: 'La decisión más importante del asesor',
        paragraphs: [
          'En la primera entrevista el asesor debe tomar una decisión clave: ¿este propietario es un vendedor real o no?',
          'Si lo es, tiene sentido avanzar hacia la estrategia de venta.',
          'Si no lo es, lo más inteligente puede ser mantener la relación y esperar el momento adecuado.',
        ],
      },
    ],
    mistake: 'Ir a la primera entrevista intentando captar a toda costa, sin diagnosticar antes si el propietario tiene motivo, plazo y motivación real.',
    testPrompt: '¿Para qué sirve realmente la primera entrevista con un propietario?',
    testOptions: [
      { id: 'a', label: 'Para empezar hablando de precio, portales y visitas' },
      { id: 'b', label: 'Para diagnosticar si realmente necesita vender y entender su situación', correct: true },
      { id: 'c', label: 'Para convencerle cuanto antes de firmar' },
    ],
    successNote: 'La primera entrevista sirve para diagnosticar antes de captar. Ahí se gana o se pierde la calidad de toda la cartera futura.',
  },
  {
    id: 'detectar-propietario-real',
    order: 8,
    chapterLabel: 'Capítulo 8',
    title: 'Detectar si el propietario realmente quiere vender',
    intro: [
      'No todos los propietarios son vendedores.',
      'Uno de los errores más caros al empezar es aceptar cualquier captación como si toda vivienda fuera una oportunidad buena.',
      'Una cartera llena de propietarios poco motivados bloquea tiempo, energía y foco.',
      'Por eso una de las habilidades más valiosas del asesor es distinguir entre quien piensa en vender y quien de verdad está listo para hacerlo.',
    ],
    objective: 'Aprender a distinguir entre propietarios que realmente quieren vender y propietarios que solo están explorando, para proteger el tiempo y la calidad de la cartera.',
    whyItMatters: 'El negocio sostenible no nace de captar mucho, sino de captar bien. Una mala captación puede consumir semanas o meses sin devolver ni venta, ni aprendizaje útil, ni reputación.',
    bullets: [
      'No toda persona que habla de vender está preparada para hacerlo.',
      'La calidad de la cartera depende más de la motivación del propietario que del número de inmuebles.',
      'Saber decir que no también es parte del trabajo profesional.',
    ],
    sections: [
      {
        title: 'No todos los propietarios son vendedores',
        paragraphs: [
          'Muchos piensan que cuantas más viviendas tengan, más venderán. En la práctica suele ocurrir lo contrario.',
          'Una cartera llena de viviendas de propietarios poco motivados provoca muchas visitas improductivas, meses de trabajo sin resultado, desgaste del asesor y frustración del propietario.',
          'Por eso una de las habilidades más importantes de un asesor inmobiliario es saber identificar quién realmente quiere vender y quién no.',
        ],
      },
      {
        title: 'La diferencia entre querer vender y pensar en vender',
        paragraphs: [
          'Un propietario puede decir que quiere vender, pero eso no siempre significa que realmente esté preparado para hacerlo.',
          'Existen dos situaciones muy distintas.',
        ],
        bullets: [
          'Pensar en vender: explora, compara, pregunta y no ha tomado una decisión real.',
          'Decidir vender: tiene motivo, plazo y está dispuesto a tomar decisiones.',
        ],
      },
      {
        title: 'Señales de un vendedor real',
        paragraphs: [
          'Un vendedor real suele mostrar varias características claras.',
          'Tiene un motivo claro para vender, un plazo razonable y está dispuesto a escuchar información sobre el mercado.',
          'Eso significa que acepta que el precio debe estar alineado con la realidad.',
          'Cuando estas tres condiciones aparecen juntas, la probabilidad de venta aumenta mucho.',
        ],
        bullets: [
          'cambiar de vivienda',
          'mudarse de ciudad',
          'resolver una herencia',
          'reorganizar su situación familiar',
        ],
      },
      {
        title: 'Señales de un propietario poco motivado',
        paragraphs: [
          'También existen señales bastante claras de baja motivación.',
          'Suelen aparecer cuando el propietario quiere mantener todas las opciones abiertas sin tomar decisiones reales.',
        ],
        bullets: [
          '“Si me pagan lo que quiero vendo.”',
          '“Voy a probar.”',
          '“No tengo prisa.”',
          '“Vamos viendo.”',
        ],
      },
      {
        title: 'El problema del vendedor aspiracional',
        paragraphs: [
          'Uno de los perfiles más comunes es el vendedor aspiracional.',
          'Es el propietario que dice algo como “Si consigo este precio vendo.”',
          'El problema suele ser que ese precio está muy por encima del mercado.',
          'Esto provoca falta de interés real, meses sin resultados, frustración del propietario y pérdida de tiempo del asesor.',
          'En estos casos el asesor debe actuar con mucha claridad y explicar la realidad del mercado.',
        ],
      },
      {
        title: 'El coste de una mala captación',
        paragraphs: [
          'Aceptar una captación equivocada tiene varios costes.',
        ],
        bullets: [
          'Tiempo: visitas, seguimiento, conversaciones y negociaciones.',
          'Energía: trabajar una vivienda que no se vende desgasta.',
          'Oportunidad perdida: mientras trabajas esa vivienda, no estás detectando vendedores reales ni generando negocio nuevo.',
        ],
      },
      {
        title: 'Prospectos en barbecho',
        paragraphs: [
          'Que un propietario no esté preparado para vender hoy no significa que nunca vaya a vender.',
          'Algunos están en fase de reflexión: quieren observar el mercado, esperar cambios familiares o estudiar una mudanza futura.',
          'En esos casos conviene tratarlos como prospectos en barbecho.',
          'Eso significa mantener la relación, registrar la información en el CRM y volver cuando tenga sentido.',
          'Muchas captaciones nacen meses o incluso años después de la primera conversación.',
        ],
      },
      {
        title: 'Saber decir que no',
        paragraphs: [
          'Un asesor profesional también debe saber cuándo no aceptar una captación.',
          'Si el propietario no tiene motivación real, no acepta escuchar el mercado o mantiene expectativas completamente irreales, puede ser mejor no aceptar el encargo.',
          'A veces la decisión más inteligente es decir: “Quizá ahora mismo no es el mejor momento para vender. Podemos volver a hablar más adelante si la situación cambia.”',
          'Eso muchas veces genera más respeto y confianza que aceptar cualquier cosa.',
        ],
      },
      {
        title: 'Cartera de calidad vs cartera grande',
        paragraphs: [
          'Un asesor inmobiliario no necesita tener muchas viviendas. Necesita tener las viviendas correctas.',
          'Una cartera pequeña pero bien posicionada suele producir más operaciones que una cartera grande llena de viviendas imposibles.',
          'La clave está en la calidad de los vendedores, no en la cantidad de propiedades.',
        ],
      },
    ],
    mistake: 'Aceptar cualquier captación por miedo a tener poca cartera, aunque el propietario no tenga motivo, plazo ni voluntad real de vender.',
    testPrompt: '¿Qué hace que una captación sea realmente buena para trabajar?',
    testOptions: [
      { id: 'a', label: 'Que la vivienda parezca bonita aunque el propietario esté dudando' },
      { id: 'b', label: 'Que el propietario tenga motivación real, plazo y disposición a escuchar el mercado', correct: true },
      { id: 'c', label: 'Que el asesor consiga firmarla aunque el precio sea imposible' },
    ],
    successNote: 'Lo importante no es captar mucho, sino captar bien: propietarios reales, motivados y trabajables.',
  },
  {
    id: 'proceso-de-captacion',
    order: 9,
    chapterLabel: 'Capítulo 9',
    title: 'El proceso de captación',
    intro: [
      'Una captación profesional no se improvisa.',
      'Uno de los errores más frecuentes del sector es intentar cerrar todo en la primera visita: precio, comisión y promesas.',
      'Eso suele degradar la conversación y convertirla en una comparación superficial entre agencias.',
      'Separar diagnóstico y estrategia mejora la confianza, el criterio y la calidad de la decisión.',
    ],
    objective: 'Entender que el proceso de captación debe dividirse en dos visitas: una para diagnosticar y otra para definir precio y estrategia.',
    whyItMatters: 'Cuando un asesor intenta captar en la primera visita sin haber analizado bien la situación y el mercado, pierde autoridad profesional y empuja al propietario a comparar por precio o promesas.',
    bullets: [
      'La primera visita sirve para generar confianza, diagnosticar al propietario y analizar la vivienda.',
      'La segunda visita sirve para hablar de precio, estrategia y representación con criterio.',
      'Separar ambas conversaciones evita improvisación y mejora la calidad de la captación.',
    ],
    sections: [
      {
        title: 'Por qué no se debe captar en la primera visita',
        paragraphs: [
          'Uno de los errores más comunes en el sector es intentar cerrar la captación en la primera reunión.',
          'Muchos agentes llegan a la vivienda y enseguida hablan de cuánto vale, cuánto creen que se puede vender, cómo lo anunciarán o qué comisión cobrarán.',
          'Eso suele provocar dos problemas: el asesor no tiene información suficiente para dar un criterio serio sobre el precio y el propietario compara esas valoraciones con las de otras agencias.',
          'Cuando varias agencias prometen cosas distintas sin análisis profundo, la conversación se convierte en una competición por quién promete más precio o cobra menos.',
          'Ese no es un terreno profesional.',
        ],
      },
      {
        title: 'El método de las dos visitas',
        paragraphs: [
          'Para evitar ese problema, el proceso de captación se divide en dos reuniones diferentes.',
          'Cada una tiene un objetivo distinto.',
        ],
        bullets: [
          'Visita 1: confianza y diagnóstico.',
          'Visita 2: precio y estrategia de venta.',
        ],
      },
      {
        title: 'Visita 1. Confianza y diagnóstico',
        paragraphs: [
          'La primera visita no tiene como objetivo hablar del precio.',
          'Tiene tres objetivos principales: conocer al propietario, entender su situación y analizar la vivienda.',
        ],
      },
      {
        title: 'Conocer al propietario',
        paragraphs: [
          'Lo primero que debe hacer el asesor es entender la situación personal del propietario.',
          'Es importante escuchar con atención por qué quiere vender, qué plazo tiene, qué espera conseguir y qué preocupaciones tiene.',
          'Este momento es clave para generar confianza.',
          'El propietario debe sentir que el asesor intenta comprender su situación, no simplemente cerrar una captación.',
        ],
      },
      {
        title: 'Entender la motivación',
        paragraphs: [
          'Durante esta conversación el asesor intenta detectar si el propietario realmente quiere vender.',
          'Aquí aparecen preguntas clave de diagnóstico.',
        ],
        bullets: [
          '¿Qué le ha hecho plantearse vender?',
          '¿Qué plazo tiene para hacerlo?',
          'Si dentro de un año no se ha vendido, ¿qué ocurriría?',
          'Si mañana traigo un comprador que paga lo que pide, ¿cuánto tardamos en vender?',
        ],
      },
      {
        title: 'Analizar la vivienda',
        paragraphs: [
          'Después de hablar con el propietario, el asesor analiza la vivienda.',
          'En esta fase observa estado general, distribución, orientación, altura, vistas, características especiales y posibles mejoras.',
          'También revisa información relevante como superficie, comunidad, gastos y situación registral si se conoce.',
          'El objetivo es entender bien el producto.',
        ],
      },
      {
        title: 'Explicar el proceso',
        paragraphs: [
          'Al final de la primera visita, el asesor explica cómo trabaja.',
          'Puede decir que para recomendar un precio con criterio necesita analizar el mercado con calma y preparar un estudio comparativo con viviendas similares vendidas o en venta en la zona.',
          'Después, propone volver a reunirse para revisar juntos la mejor estrategia.',
          'Esto lo posiciona como alguien que trabaja con método.',
        ],
      },
      {
        title: 'Preparar la segunda reunión',
        paragraphs: [
          'Antes de terminar la primera visita se propone una segunda reunión.',
          'Por ejemplo: “Si le parece bien, preparo el análisis de mercado y volvemos a vernos para revisarlo con calma.”',
          'Así la conversación queda abierta y el proceso sigue su curso.',
        ],
      },
      {
        title: 'Visita 2. Estrategia de venta',
        paragraphs: [
          'La segunda visita tiene un objetivo muy claro: definir la estrategia de venta.',
          'En esta reunión se abordan tres temas principales: el precio, el plan de comercialización y la representación.',
        ],
      },
      {
        title: 'Explicar el mercado',
        paragraphs: [
          'Lo primero es explicar cómo está el mercado.',
          'Esto se hace comparando la vivienda con viviendas similares en venta, viviendas que se han vendido recientemente y viviendas que llevan tiempo en el mercado.',
          'Eso ayuda al propietario a entender cómo se posiciona su vivienda.',
        ],
      },
      {
        title: 'Proponer una estrategia de precio',
        paragraphs: [
          'El precio no debe presentarse como una opinión. Debe presentarse como una recomendación basada en información.',
          'El asesor explica cómo diferentes precios pueden provocar distintos resultados.',
        ],
        bullets: [
          'un precio muy alto puede provocar falta de visitas',
          'un precio ajustado puede generar más interés',
        ],
      },
      {
        title: 'Explicar el plan de venta',
        paragraphs: [
          'En esta fase se explica cómo se gestionará la venta.',
        ],
        bullets: [
          'preparación del inmueble',
          'material fotográfico',
          'publicación en portales',
          'gestión de compradores',
          'organización de visitas',
          'seguimiento del mercado',
        ],
      },
      {
        title: 'La representación del propietario',
        paragraphs: [
          'Cuando el propietario confía en el asesor, llega el momento de formalizar la representación.',
          'Eso significa que el asesor será la persona encargada de gestionar la venta, coordinar el mercado y representar los intereses del propietario.',
          'Esta relación se basa en confianza y responsabilidad.',
        ],
      },
      {
        title: 'Por qué este método funciona',
        paragraphs: [
          'El método de las dos visitas tiene varias ventajas.',
        ],
        bullets: [
          'permite generar confianza antes de hablar de precio',
          'evita promesas improvisadas',
          'demuestra profesionalidad',
          'ayuda al propietario a tomar decisiones con más información',
        ],
      },
    ],
    mistake: 'Intentar cerrar la captación en la primera visita sin diagnóstico ni análisis serio de mercado, reduciendo la conversación a promesas y comisión.',
    testPrompt: '¿Por qué conviene separar el proceso de captación en dos visitas?',
    testOptions: [
      { id: 'a', label: 'Para alargar el proceso aunque no aporte más valor' },
      { id: 'b', label: 'Para diagnosticar primero y definir luego precio y estrategia con criterio', correct: true },
      { id: 'c', label: 'Para hablar dos veces de comisión con el propietario' },
    ],
    successNote: 'Primero se genera confianza y se diagnostica; después se propone precio y estrategia con criterio profesional.',
  },
  {
    id: 'objeciones-inmobiliarias',
    order: 10,
    chapterLabel: 'Capítulo 10',
    title: 'Las 10 objeciones inmobiliarias más comunes',
    intro: [
      'Una objeción no es un ataque.',
      'Una objeción es una duda del propietario, muchas veces nacida del miedo, la desinformación o experiencias previas.',
      'Por eso el asesor no debe discutir ni defenderse de forma impulsiva.',
      'Debe escuchar, validar, explicar con criterio y volver a involucrar al propietario en la conversación.',
    ],
    objective: 'Aprender a responder las objeciones más comunes con calma, criterio profesional y foco en ayudar al propietario a decidir mejor.',
    whyItMatters: 'Las objeciones forman parte natural de la captación. Quien sabe manejarlas transmite profesionalidad y confianza; quien las discute suele perder autoridad.',
    bullets: [
      'Las objeciones no son ataques: suelen ser dudas, miedos o falta de información.',
      'La respuesta profesional sigue cuatro pasos: escuchar, validar, explicar y preguntar.',
      'Cada objeción bien trabajada es una oportunidad para mostrar el valor del asesor.',
    ],
    sections: [
      {
        title: 'Qué es realmente una objeción',
        paragraphs: [
          'Muchas veces una objeción aparece porque el propietario no entiende algo, tiene miedo a equivocarse, ha tenido malas experiencias o ha escuchado opiniones externas.',
          'Por eso, cuando aparece una objeción, el objetivo no es discutir. El objetivo es escuchar, entender y explicar con claridad.',
          'Cuando un asesor responde con calma y criterio, la objeción suele perder fuerza.',
        ],
      },
      {
        title: 'Cómo manejar una objeción',
        paragraphs: [
          'Existe un principio muy útil para no convertir la conversación en una discusión.',
        ],
        bullets: [
          '1. Escuchar: dejar que el propietario explique su punto de vista.',
          '2. Validar: reconocer que su preocupación es comprensible.',
          '3. Explicar: aportar información o perspectiva profesional.',
          '4. Preguntar: volver a involucrar al propietario en la conversación.',
        ],
      },
      {
        title: 'Objeción 1. “No quiero exclusiva”',
        paragraphs: [
          'Muchos propietarios creen que trabajar con varias agencias aumenta las posibilidades de vender.',
          'El asesor puede explicar que eso suele generar precios distintos, falta de control de la información, compradores confundidos y pérdida de credibilidad.',
          'Con un solo interlocutor hay estrategia clara, control de la comunicación, coordinación con otros agentes e imagen más profesional en el mercado.',
        ],
      },
      {
        title: 'Objeción 2. “La comisión es muy alta”',
        paragraphs: [
          'Aquí conviene explicar que el trabajo del asesor no consiste solo en publicar un anuncio.',
          'Incluye analizar el mercado, diseñar estrategia, gestionar compradores, negociar ofertas y acompañar hasta notaría.',
          'El propietario no paga por un anuncio: paga por gestionar bien una operación que puede representar una gran parte de su patrimonio.',
        ],
      },
      {
        title: 'Objeción 3. “Voy a vender por mi cuenta”',
        paragraphs: [
          'El asesor puede reconocer que algunas personas venden por su cuenta.',
          'Pero también puede explicar que el proceso suele implicar filtrar compradores, negociar ofertas, preparar documentación y gestionar el proceso hasta notaría.',
          'Para muchas personas, tener un profesional gestionando todo eso aporta tranquilidad.',
        ],
      },
      {
        title: 'Objeción 4. “Ya tengo otra agencia”',
        paragraphs: [
          'El asesor puede preguntar cómo está funcionando esa relación.',
          'A veces el propietario solo quiere comparar opiniones.',
          'En ese caso se puede ofrecer un análisis del mercado y dejar que el propietario valore las opciones con calma.',
        ],
      },
      {
        title: 'Objeción 5. “Tengo un amigo que es agente”',
        paragraphs: [
          'El asesor no debe criticar al amigo.',
          'Puede explicar que lo importante es trabajar con alguien en quien se confíe y que tenga un método claro de trabajo.',
          'Si el propietario percibe profesionalidad, muchas veces mantiene abierta la propuesta.',
        ],
      },
      {
        title: 'Objeción 6. “No tengo prisa en vender”',
        paragraphs: [
          'Una respuesta eficaz puede ser: “Perfecto. Si realmente no hay prisa, quizá lo más sensato sea esperar al momento adecuado.”',
          'Eso elimina presión, genera confianza y muchas veces hace que el propietario explique su situación real.',
        ],
      },
      {
        title: 'Objeción 7. “Quiero sacar más dinero”',
        paragraphs: [
          'Es normal que un propietario quiera obtener el mejor precio posible.',
          'El asesor debe explicar que el precio no lo decide la agencia ni el propietario: lo decide el mercado.',
          'Cuando el precio está alineado con el mercado aparecen compradores. Cuando está por encima, la vivienda suele quedarse parada.',
        ],
      },
      {
        title: 'Objeción 8. “Ya lo intenté antes y no se vendió”',
        paragraphs: [
          'Aquí conviene entender qué ocurrió: puede haber fallado el precio, la presentación, la estrategia de comercialización o el seguimiento.',
          'El asesor puede analizar la situación y explicar cómo se abordaría de forma diferente.',
        ],
      },
      {
        title: 'Objeción 9. “Tengo que hablarlo con mi pareja”',
        paragraphs: [
          'Esta objeción suele indicar que la decisión todavía no está tomada.',
          'Lo más adecuado es respetar el proceso y ofrecer resolver cualquier duda cuando ambos puedan revisar la situación juntos.',
        ],
      },
      {
        title: 'Objeción 10. “Voy a esperar a que el mercado suba”',
        paragraphs: [
          'Muchos propietarios quieren vender en el mejor momento posible.',
          'El asesor puede explicar que el mercado es difícil de prever con exactitud y que, si además quieren comprar otra vivienda, el mercado afectará a ambas operaciones.',
          'Lo importante es decidir según la situación personal del propietario, no solo según previsiones.',
        ],
      },
      {
        title: 'Qué tienen en común todas las objeciones',
        paragraphs: [
          'Las objeciones suelen aparecer cuando el propietario no entiende el proceso, tiene miedo a equivocarse o necesita más información.',
          'Cuando el asesor responde con calma y profesionalidad, la mayoría se convierten en oportunidades para explicar el valor de su trabajo.',
        ],
      },
    ],
    mistake: 'Tomarse la objeción como un ataque personal y responder discutiendo, justificándose de más o intentando imponer el punto de vista.',
    testPrompt: '¿Cuál es la forma más profesional de manejar una objeción del propietario?',
    testOptions: [
      { id: 'a', label: 'Discutir rápido para demostrar que el agente tiene razón' },
      { id: 'b', label: 'Escuchar, validar, explicar con criterio y volver a preguntar', correct: true },
      { id: 'c', label: 'Cambiar de tema para no entrar en conflicto' },
    ],
    successNote: 'Una objeción bien trabajada no rompe la captación: muchas veces la fortalece.',
  },
  {
    id: 'mentalidad-del-asesor',
    order: 11,
    chapterLabel: 'Capítulo 11',
    title: 'La mentalidad del asesor inmobiliario',
    intro: [
      'Este negocio no se gana en un mes.',
      'La inmobiliaria no recompensa solo el esfuerzo puntual: recompensa la constancia acumulada.',
      'Entre una primera conversación y una notaría pueden pasar semanas o meses.',
      'Por eso el asesor que aguanta, aprende y construye relaciones termina separándose del que solo busca resultados inmediatos.',
    ],
    objective: 'Entender que el negocio inmobiliario se construye con tiempo, constancia, aprendizaje y relaciones de confianza a largo plazo.',
    whyItMatters: 'Sin la mentalidad correcta, un agente nuevo suele frustrarse antes de que su actividad tenga tiempo de madurar. Con la mentalidad correcta, entiende que sembrar hoy es parte imprescindible de vender mañana.',
    bullets: [
      'Las operaciones tardan en construirse; la constancia sostiene el ciclo comercial.',
      'El negocio llega por acumulación de conversaciones, relaciones y aprendizaje.',
      'La reputación y la confianza terminan siendo el verdadero activo del asesor.',
    ],
    sections: [
      {
        title: 'Este negocio no se gana en un mes',
        paragraphs: [
          'El negocio inmobiliario no es un trabajo de resultados inmediatos.',
          'Entre la primera conversación con un propietario y la firma en notaría pueden pasar semanas, meses o incluso más tiempo.',
          'Por eso uno de los errores más frecuentes de los agentes nuevos es esperar resultados demasiado rápidos.',
          'Cuando esos resultados no llegan inmediatamente, muchos creen que algo está fallando, cuando en realidad suele faltar tiempo y constancia.',
        ],
      },
      {
        title: 'La acumulación de conversaciones',
        paragraphs: [
          'En inmobiliaria existe una regla muy sencilla: cuantas más conversaciones relevantes tiene un asesor, más oportunidades aparecen.',
          'Pero esas conversaciones no siempre producen resultados inmediatos.',
        ],
        bullets: [
          'una visita dentro de unos meses',
          'una recomendación',
          'una captación futura',
        ],
      },
      {
        title: 'La paciencia profesional',
        paragraphs: [
          'Un asesor inmobiliario debe desarrollar paciencia profesional.',
          'Eso significa entender que el negocio funciona en ciclos: primero conversaciones, después oportunidades, después captaciones y después operaciones.',
          'Si un asesor deja de hablar con personas porque todavía no hay ventas, el ciclo se rompe.',
          'Si mantiene la actividad, el negocio termina llegando.',
        ],
      },
      {
        title: 'La constancia diaria',
        paragraphs: [
          'La diferencia entre un asesor que permanece en el sector y uno que lo abandona suele estar en la constancia.',
          'Los asesores que permanecen hacen lo mismo cada semana: hablan con personas, trabajan su zona, realizan visitas y mantienen relaciones.',
          'No dependen de la inspiración. Dependen de la disciplina.',
        ],
      },
      {
        title: 'Aprender del mercado',
        paragraphs: [
          'El mercado inmobiliario es una escuela constante.',
          'Cada conversación con un propietario enseña algo. Cada visita con un comprador aporta información. Cada negociación mejora la experiencia.',
          'Los asesores que crecen suelen tener una actitud de aprendizaje continuo. No buscan tener siempre la razón; buscan entender mejor el mercado.',
        ],
      },
      {
        title: 'Construir relaciones a largo plazo',
        paragraphs: [
          'Una de las mayores ventajas del negocio inmobiliario es que las relaciones se acumulan.',
          'Un cliente satisfecho puede recomendar al asesor durante muchos años.',
          'Un vecino con el que se habló hoy puede convertirse en cliente dentro de dos años.',
          'Por eso el asesor no debe pensar solo en la operación inmediata. Debe pensar en construir una red de relaciones de confianza.',
        ],
      },
      {
        title: 'La reputación del asesor',
        paragraphs: [
          'Con el tiempo, el activo más importante de un asesor inmobiliario no son las viviendas que tiene en cartera. Es su reputación.',
          'Cuando las personas perciben que un asesor trabaja con honestidad, conoce el mercado, cumple su palabra y trata bien a los clientes, empiezan a recomendarlo.',
          'Y cuando llegan las recomendaciones, el negocio se vuelve mucho más estable.',
        ],
      },
      {
        title: 'El papel del tiempo',
        paragraphs: [
          'Muchos asesores experimentados coinciden en algo: los primeros años del negocio se construyen sembrando.',
          'Se habla con personas, se generan relaciones y se aprende del mercado.',
          'Con el tiempo, esas relaciones empiezan a producir oportunidades de forma natural.',
          'La clave no es correr. La clave es permanecer y construir.',
        ],
      },
      {
        title: 'El asesor como profesional de confianza',
        paragraphs: [
          'Cuando un asesor trabaja durante años con criterio, ocurre algo muy valioso.',
          'Las personas empiezan a verlo como alguien de confianza para decisiones importantes.',
          'No solo para vender una vivienda, también para comprar, invertir o recomendar a familiares y amigos.',
          'En ese momento el asesor deja de perseguir operaciones. Las operaciones empiezan a llegar a él.',
        ],
      },
      {
        title: 'Idea final del playbook',
        paragraphs: [
          'El negocio inmobiliario no trata de vender viviendas.',
          'Trata de ayudar a las personas a tomar decisiones importantes sobre sus viviendas.',
          'Un asesor que trabaja con honestidad, constancia y criterio termina construyendo algo mucho más valioso que una operación puntual: confianza en el mercado.',
          'Y la confianza es el verdadero motor de este negocio.',
        ],
      },
    ],
    mistake: 'Abandonar el método o perder la fe en el proceso porque las primeras semanas o meses todavía no han dado una venta visible.',
    testPrompt: '¿Qué sostiene de verdad una carrera sólida en inmobiliaria?',
    testOptions: [
      { id: 'a', label: 'Esperar resultados rápidos para saber si uno vale o no' },
      { id: 'b', label: 'Constancia, aprendizaje y relaciones de confianza a largo plazo', correct: true },
      { id: 'c', label: 'Publicar muchos inmuebles aunque no haya base relacional' },
    ],
    successNote: 'En inmobiliaria se gana permaneciendo, aprendiendo y construyendo confianza durante mucho tiempo.',
  },
  {
    id: 'relaciones-y-conversaciones',
    order: 12,
    chapterLabel: 'Capítulo 12',
    title: 'Cómo generar relaciones y conversaciones',
    intro: [
      'El negocio inmobiliario empieza mucho antes de una vivienda en venta.',
      'Empieza cuando alguien se plantea cambiar de casa, escucha que un vecino quiere vender o piensa en un asesor cuando surge una necesidad.',
      'Por eso el trabajo del asesor no consiste solo en buscar pisos.',
      'Consiste en estar presente en la mente de las personas adecuadas para que, cuando aparezca una oportunidad, piensen en él.',
    ],
    objective: 'Entender cómo trabajar zona y círculo de confianza para construir presencia mental, conversaciones útiles y una red de prescriptores reales.',
    whyItMatters: 'Las captaciones más sólidas nacen de relaciones bien trabajadas. Quien entiende esto deja de perseguir pisos y empieza a construir un sistema relacional que genera negocio de forma repetible.',
    bullets: [
      'El objetivo no es hablar con todo el mundo, sino estar en el top of mind de las personas adecuadas.',
      'La repetición convierte presencia en recuerdo, y recuerdo en oportunidad.',
      'Sin CRM, las conversaciones se pierden; con CRM, se convierten en capital comercial acumulado.',
    ],
    sections: [
      {
        title: 'El objetivo real no es hablar con todo el mundo',
        paragraphs: [
          'Uno de los errores más comunes es pensar que hacer zona consiste en hablar con muchas personas sin criterio.',
          'No se trata de socializar por socializar.',
          'Se trata de construir presencia, generar reconocimiento, crear confianza, detectar información útil y activar prescriptores.',
          'El objetivo real es crear una red de relaciones que haga que el asesor esté en el top of mind del barrio y de su círculo de confianza.',
        ],
      },
      {
        title: 'Qué significa estar en el top of mind',
        paragraphs: [
          'Top of mind significa que cuando una persona piensa en vender una vivienda, tu nombre aparece primero en su cabeza.',
          'Eso ocurre cuando te han visto varias veces, saben a qué te dedicas, te perciben activo en la zona y les has generado buena impresión.',
          'Cuando alguien oye “mi vecino quiere vender” o “han heredado un piso”, suele recordar al asesor que tiene más presente.',
          'Por eso trabajar zona no consiste en perseguir captaciones: consiste en ganar presencia mental en un entorno concreto.',
        ],
      },
      {
        title: 'Por qué la zona debe ser concreta',
        paragraphs: [
          'Para estar en el top of mind no se puede trabajar una zona demasiado grande.',
          'Si el asesor intenta abarcar demasiado, repite poco, genera poco reconocimiento y no construye familiaridad.',
          'La zona tiene que ser lo bastante pequeña como para repetir calles, entrar varias veces en los mismos negocios, cruzarte con vecinos conocidos y detectar cambios.',
          'La presencia repetida convierte al asesor en alguien del barrio, no en alguien que pasó un día.',
        ],
      },
      {
        title: 'Relacionarte no es venderte',
        paragraphs: [
          'Otro error habitual es pensar que generar relaciones consiste en explicar demasiado, vender demasiado o pedir demasiado rápido.',
          'Eso genera rechazo.',
          'La relación buena se construye al revés: primero presencia, luego reconocimiento, después familiaridad, luego confianza y finalmente oportunidad.',
          'La conversación debe ser natural, ligera, sencilla y sin presión.',
        ],
      },
      {
        title: 'Cómo hablar con vecinos',
        paragraphs: [
          'Con los vecinos funciona muy bien una apertura donde el asesor se presenta, se sitúa en la zona y pide ayuda.',
          'Pedir ayuda es poderoso porque coloca al vecino en una posición cómoda y no se siente atacado ni vendido.',
          'Lo importante no es la frase exacta, sino la lógica: presentarte, pedir ayuda y abrir conversación.',
          'Nunca conviene empezar pidiendo perdón por molestar. El asesor está trabajando con naturalidad en la zona.',
        ],
      },
      {
        title: 'Cómo hablar con conocidos',
        paragraphs: [
          'Con los conocidos la lógica cambia: primero va la relación.',
          'Hay que empezar por la persona, preguntar cómo está y conversar con naturalidad.',
          'Cuando la otra persona pregunta en qué andas, ese es el momento de explicar tu situación de forma corta, clara y atractiva.',
          'Aquí no pides de forma directa: colocas una idea en la cabeza del contacto.',
        ],
      },
      {
        title: 'Cómo relacionarte con negocios del barrio',
        paragraphs: [
          'Los negocios del barrio pueden ser excelentes prescriptores, pero solo si la relación se trabaja bien.',
          'El error más común es entrar en un negocio e intentar explicar demasiado o pedir demasiado en la primera visita.',
          'La relación con comercios debe construirse poco a poco: primero presentarte, luego volver y finalmente convertirte en una cara conocida.',
          'Cuando ya hay familiaridad, tiene sentido dejar claro que tienes movimiento, compradores y necesidad de producto.',
        ],
      },
      {
        title: 'No todos los contactos valen lo mismo',
        paragraphs: [
          'Ni en el barrio ni en el círculo de confianza se trata de dedicar el mismo tiempo a todo el mundo.',
          'Hay que priorizar a los mejores prescriptores: personas muy sociables, bien conectadas, con red, capacidad de influir y confianza social.',
          'En negocios, conviene centrarse en locales con mucha clientela local, conversación y arraigo en la zona.',
          'Es mejor tener buena relación con diez prescriptores potentes que una relación floja con cincuenta irrelevantes.',
        ],
      },
      {
        title: 'La relación se construye por repetición',
        paragraphs: [
          'La confianza rara vez nace de una sola interacción.',
          'Normalmente se construye porque la persona te ve varias veces, habla contigo en momentos distintos, te ubica y te asocia con el mercado.',
          'Poco a poco dejas de ser “un inmobiliario” y te conviertes en alguien conocido, alguien del barrio, alguien al que llamar cuando surge una necesidad.',
          'Por eso el trabajo relacional exige paciencia.',
        ],
      },
      {
        title: 'Qué debe hacer el asesor con toda esa información',
        paragraphs: [
          'Cada conversación útil debe convertirse en información organizada.',
          'No basta con hablar y olvidar.',
        ],
        bullets: [
          'quién es la persona',
          'qué relación tiene con la zona',
          'qué ha comentado',
          'si conoce a alguien que quiera vender',
          'si puede ser buen prescriptor',
          'cuándo conviene volver a hablar',
        ],
      },
      {
        title: 'Qué errores hay que evitar',
        paragraphs: [
          'En este tipo de trabajo hay varios errores muy frecuentes.',
        ],
        bullets: [
          'querer resultados inmediatos',
          'sonar comercial demasiado pronto',
          'hablar demasiado',
          'pedir demasiado pronto',
          'trabajar una zona demasiado amplia',
          'no priorizar prescriptores',
          'no registrar nada',
        ],
      },
      {
        title: 'Qué debe entender un asesor sobre este capítulo',
        paragraphs: [
          'Este capítulo no va de tener labia.',
          'Va de entender cómo se construyen las captaciones de verdad.',
          'Las captaciones no nacen solo de anuncios ni de portales. Nacen de presencia, repetición, confianza, conversaciones y relaciones bien trabajadas.',
          'Un buen asesor no intenta gustar a todo el mundo ni hablar con todo el mundo. Intenta estar presente en la mente de las personas adecuadas.',
        ],
      },
    ],
    mistake: 'Confundir trabajar relaciones con hablar mucho, pedir demasiado pronto o intentar sacar negocio inmediato de cada conversación.',
    testPrompt: '¿Qué significa de verdad trabajar la zona y el círculo de confianza?',
    testOptions: [
      { id: 'a', label: 'Hablar con mucha gente al azar hasta que salga un piso' },
      { id: 'b', label: 'Construir presencia mental y confianza para que te recuerden cuando surja una necesidad', correct: true },
      { id: 'c', label: 'Entrar fuerte en cada conversación para pedir captaciones cuanto antes' },
    ],
    successNote: 'El objetivo no es perseguir pisos, sino ser recordado por las personas adecuadas en el momento adecuado.',
  },
  {
    id: 'errores-del-junior',
    order: 13,
    chapterLabel: 'Capítulo 13',
    title: 'Los errores que arruinan a un agente inmobiliario junior',
    intro: [
      'Cuando un agente empieza en el sector suele llegar con ilusión, energía y ganas de hacerlo bien.',
      'El problema es que esa mezcla de entusiasmo, inseguridad y poca experiencia suele empujarle a cometer errores muy parecidos.',
      'No son errores raros. Son errores típicos, repetidos una y otra vez en el sector.',
      'Si se corrigen pronto, la curva de aprendizaje se acelera muchísimo. Si se arrastran, terminan descarrilando al asesor.',
    ],
    objective: 'Entender la secuencia más habitual por la que un agente junior se descarrila y aprender a corregirla desde el principio.',
    whyItMatters: 'Muchos agentes no fracasan por falta de capacidad, sino por insistir demasiado tiempo en hábitos que les alejan de las captaciones y de las ventas.',
    bullets: [
      'El fracaso del junior suele empezar mucho antes de no vender: empieza en su enfoque, su método y su mentalidad.',
      'Estar ocupado no significa estar construyendo negocio.',
      'Criterio, calle, escucha, seguimiento y responsabilidad son las bases que evitan el descarrilamiento.',
    ],
    sections: [
      {
        title: 'La secuencia real del fracaso de un agente junior',
        paragraphs: [
          'Normalmente el problema no empieza en que el agente no venda. Empieza en cómo piensa, cómo organiza su actividad, cómo habla con las personas y cómo interpreta lo que le está pasando.',
        ],
        bullets: [
          'quiere resultados rápidos',
          'confunde estar ocupado con generar negocio',
          'habla demasiado y escucha poco',
          'no detecta la motivación real del vendedor',
          'capta viviendas que no deberían entrar en cartera',
          'promete precios irreales para conseguir encargos',
          'no registra ni sigue bien las oportunidades',
          'trabaja sin foco ni zona concreta',
          'como no vende, baja su actividad',
          'termina creyendo que el problema era el mercado, cuando en realidad era el método',
        ],
      },
      {
        title: 'Error 1. Pensar que el negocio va a responder rápido solo porque has empezado',
        paragraphs: [
          'Muchos agentes nuevos creen que, por moverse bastante o estar en la oficina, la venta llegará enseguida.',
          'Cuando no ocurre, se frustran.',
          'En Legado hay sueldo desde el principio, y eso da estabilidad. Pero no cambia una realidad esencial: este es un trabajo donde la diferencia real la marcan la producción y las comisiones.',
          'La empresa invierte desde el día uno en salario, seguros sociales, formación, acompañamiento, estructura, herramientas, marca, oficina, CRM y soporte operativo.',
          'Por eso, aunque no se espera una venta la primera semana, sí se espera que en pocos meses aparezcan resultados o señales muy claras de negocio real.',
        ],
      },
      {
        title: 'Error 2. Confundir estar ocupado con construir negocio',
        paragraphs: [
          'Este error engaña mucho porque el agente siente que trabaja muchísimo.',
          'Pero si el negocio no avanza, esa ocupación es una trampa.',
          'Hay asesores que llenan su día con portales, papeles, tareas poco prioritarias, material innecesario y revisión de cosas sin impacto real.',
          'El cansancio no es prueba de productividad.',
          'Construir negocio significa hablar con personas, detectar propietarios, conseguir visitas de captación, captar viviendas, mover compradores reales y convertir oportunidades en cierres.',
        ],
      },
      {
        title: 'Error 3. Hablar demasiado y escuchar poco',
        paragraphs: [
          'Muchos agentes creen que para parecer profesionales tienen que explicar mucho.',
          'Por eso empiezan contando quiénes somos, cuántos años llevamos, qué portales usamos o qué servicios ofrecemos.',
          'La intención es buena, pero en una primera conversación suele ser un error.',
          'Al principio al propietario le importa mucho menos eso que sentir que la persona que tiene delante le va a ayudar de verdad.',
          'Eso no se consigue hablando mucho, sino escuchando bien.',
        ],
      },
      {
        title: 'La ley de Pareto aplicada a la conversación',
        paragraphs: [
          'En una buena conversación con un propietario debería ocurrir algo parecido a esto: el cliente habla el 80 % del tiempo y el asesor el 20 %.',
          'Eso no significa pasividad. Significa dirigir con preguntas y dejar que la información importante la ponga el cliente.',
          'La información clave no está en lo que tú cuentas. Está en lo que él te revela.',
        ],
      },
      {
        title: 'Cómo conseguir que el cliente hable',
        paragraphs: [
          'Se consigue con preguntas abiertas, preguntas que no se respondan con sí o no y que obliguen a explicar.',
        ],
        bullets: [
          '¿Qué le ha llevado a plantearse la venta?',
          '¿Cómo ha llegado a esta decisión?',
          '¿Qué le gustaría que ocurriera con esta vivienda?',
          '¿Qué cambio busca con esta operación?',
          '¿Dónde le gustaría estar después de vender?',
          '¿Qué plazo tiene en mente?',
          '¿Qué tendría que pasar para que esta venta fuera un éxito para usted?',
        ],
      },
      {
        title: 'La motivación real: la clave oculta de toda venta',
        paragraphs: [
          'Todos dicen “quiero vender”, pero eso no dice casi nada.',
          'La pregunta importante es por qué quiere vender.',
          'Sin motivación real, no hay venta.',
        ],
        bullets: [
          'divorcio o separación',
          'herencia',
          'hipoteca que aprieta',
          'cambio de ciudad o de barrio',
          'mejora o reducción de vivienda',
          'necesidad de liquidez',
          'reorganización familiar',
          'oportunidad de compra',
        ],
      },
      {
        title: 'Después de las abiertas, vienen las cerradas',
        paragraphs: [
          'Una vez que el asesor ya entiende el mapa del cliente, la conversación cambia.',
          'Primero comprender, luego concretar. Primero abrir, luego cerrar.',
        ],
        bullets: [
          '¿La vivienda está hipotecada?',
          '¿La nota simple está actualizada?',
          '¿La comunidad está al corriente?',
          '¿Podemos organizar visitas entre semana?',
          '¿Le encaja que preparemos la nota de encargo?',
          '¿Podríamos arrancar esta semana?',
        ],
      },
      {
        title: 'Error 4. No detectar la motivación real del vendedor',
        paragraphs: [
          'Hay agentes que oyen “quiero vender” y creen que ya tienen una captación.',
          'Pero eso solo es una frase.',
          'Lo importante es saber si esa persona necesita vender, quiere vender de verdad, está dispuesta a tomar decisiones, aceptará el mercado y moverá la operación si aparece un comprador.',
          'Muchos propietarios no venden: tantean, imaginan o intentan financiar una ilusión.',
        ],
      },
      {
        title: 'Error 5. Captar viviendas que no deberían entrar en cartera',
        paragraphs: [
          'Este error aparece cuando el agente no escucha bien, no detecta motivación real y se deja seducir por tener más producto.',
          'Acaba firmando encargos de propietarios sin urgencia, sin necesidad, sin realismo o sin voluntad de seguir una estrategia profesional.',
          'Desde fuera parece que tiene cartera. Desde dentro, tiene energía bloqueada, tiempo improductivo y frustración acumulada.',
          'Una buena cartera se mide por calidad de vendedores, no por número de inmuebles.',
        ],
      },
      {
        title: 'Error 6. Prometer precios irreales para conseguir el encargo',
        paragraphs: [
          'A veces el agente piensa: “Si le digo el precio alto que quiere oír, me firmará.”',
          'Y quizá firme. Pero luego llega el mercado.',
          'Si el precio está fuera de mercado, no hay llamadas de calidad, no hay visitas útiles, no hay ofertas reales, el inmueble se quema y la relación se deteriora.',
          'Un asesor serio no capta con fantasía. Capta con criterio.',
        ],
      },
      {
        title: 'Error 7. Pensar que se puede estar demasiado tiempo sin vender',
        paragraphs: [
          'En Legado el asesor tiene sueldo, y eso da estabilidad. Pero la estabilidad no elimina una verdad empresarial básica: este trabajo tiene que generar dinero.',
          'No se espera facturación en dos semanas, pero tampoco se puede eternizar el arranque.',
          'Si en menos de tres meses no empiezan a aparecer ventas o señales claras de negocio real, hay un problema de actividad, método o enfoque.',
          'La autonomía exige madurez: si la empresa invierte en ti, tú debes transformar esa inversión en negocio.',
        ],
      },
      {
        title: 'Error 8. No utilizar el CRM como sistema de trabajo',
        paragraphs: [
          'Muchos agentes registran poco, tarde o de forma superficial.',
          'Luego olvidan cosas, pierden seguimientos y sienten que tenían muchas conversaciones pero ya no saben con quién.',
          'El CRM no es una obligación administrativa: es el coach del asesor.',
          'Le dice si está sembrando suficiente, si está haciendo seguimiento, si tiene zona trabajada y si sus oportunidades avanzan o se enfrían.',
        ],
      },
      {
        title: 'Error 9. No hacer seguimiento',
        paragraphs: [
          'Muchas oportunidades no se cierran en el primer contacto.',
          'De hecho, una gran parte del negocio aparece después: después de una llamada, una visita o una conversación en zona.',
          'El agente malo interpreta un “ahora no” como pérdida. El bueno lo interpreta como seguimiento pendiente.',
          'Muchas ventas nacen de una oportunidad bien seguida.',
        ],
      },
      {
        title: 'Error 10. Trabajar sin una zona clara y sin foco',
        paragraphs: [
          'Cuando un asesor no tiene una zona concreta, nadie lo reconoce, nadie lo ubica y no está en el top of mind de nadie.',
          'Trabajar una zona grande o difusa no sirve.',
          'La zona debe ser concreta, repetible y reconocible para construir presencia mental.',
        ],
      },
      {
        title: 'Error 11. No priorizar a los mejores prescriptores',
        paragraphs: [
          'No todas las relaciones valen lo mismo.',
          'Tratar por igual a todos los conocidos, negocios y contactos es ineficiente.',
          'Hay que identificar quién tiene más capacidad de generar oportunidades y dedicar mejor el tiempo a esos perfiles.',
        ],
      },
      {
        title: 'Error 12. No aplicar mentalidad 10X',
        paragraphs: [
          'La mayoría de la gente subestima la cantidad de acción necesaria para lograr resultados grandes.',
          'En inmobiliaria esto se ve clarísimo: poca conversación, poco seguimiento, poca repetición y desánimo rápido.',
          'La mentalidad 10X no significa hacer locuras. Significa entender que para obtener resultados extraordinarios hay que elevar mucho el volumen de actividad útil.',
          'Más conversaciones. Más seguimientos. Más presencia. Más calle. Más repetición. Más constancia.',
        ],
      },
      {
        title: 'Filosofía Legado: libertad, madurez y responsabilidad',
        paragraphs: [
          'En Legado no trabajamos desde la persecución constante del asesor.',
          'Hay autonomía desde el primer día, y eso es una gran oportunidad.',
          'Pero la autonomía exige responsabilidad: la empresa pone método, formación, estructura, marca, herramientas, CRM y acompañamiento; el asesor tiene que poner calle, actividad, constancia, madurez y foco en resultados.',
        ],
      },
      {
        title: 'Conclusión del capítulo',
        paragraphs: [
          'Un agente junior no suele fracasar por una gran decisión equivocada.',
          'Suele fracasar por acumular pequeños errores de enfoque, actividad, criterio y mentalidad durante demasiado tiempo.',
          'En este negocio no gana el que más parece trabajar. Gana el que convierte su actividad en negocio real.',
          'Y para eso hace falta una mezcla muy concreta: criterio, calle, constancia, escucha, seguimiento y responsabilidad.',
        ],
      },
    ],
    mistake: 'Insistir durante demasiado tiempo en hábitos cómodos o equivocados y confundir esfuerzo desordenado con progreso real.',
    testPrompt: '¿Qué suele arruinar antes a un agente junior?',
    testOptions: [
      { id: 'a', label: 'Una única mala operación aislada' },
      { id: 'b', label: 'Acumular pequeños errores de enfoque, método y mentalidad durante demasiado tiempo', correct: true },
      { id: 'c', label: 'Tener demasiado CRM y demasiada estructura' },
    ],
    successNote: 'El junior suele descarrilarse por acumulación de errores repetidos, no por un fallo puntual.',
  },
  {
    id: 'kpi-logica-minima',
    order: 14,
    chapterLabel: 'Capítulo extra · KPI',
    title: 'La lógica mínima del negocio inmobiliario',
    intro: [
      'El negocio inmobiliario funciona con una cadena muy simple.',
      'Toques -> Visitas -> Captaciones -> Ventas.',
      'No todo se convierte en todo, y eso es completamente normal.',
      'Lo importante es entender qué volumen mínimo de actividad hace que el sistema funcione.',
      'Regla 4-2-2-10: 4 toques al día -> 2 visitas a la semana -> 2 captaciones al mes -> 10 ventas al año.',
    ],
    objective: 'Entender la cadena mínima del negocio y los KPI base que hacen viable la actividad de un asesor.',
    whyItMatters: 'Cuando un agente entiende esta lógica deja de trabajar por sensaciones. Puede leer dónde se rompe su embudo y corregir exactamente la fase que falla.',
    bullets: [
      'El negocio no se sostiene por intuición, sino por una cadena de conversiones muy simple.',
      'Los ratios aquí son prudentes: no hablan de máximos, hablan de mínimos razonables.',
      'Si sabes en qué tramo se rompe el embudo, sabes qué corregir.',
      'La regla que debe quedarte grabada es 4-2-2-10.',
    ],
    sections: [
      {
        title: 'Regla 4-2-2-10',
        paragraphs: [
          '4 toques al día -> 2 visitas a la semana -> 2 captaciones al mes -> 10 ventas al año.',
          'Si mantienes la actividad, el negocio aparece.',
        ],
      },
      {
        title: 'La lógica mínima del negocio inmobiliario',
        paragraphs: [
          'El negocio funciona con una cadena muy sencilla: toques, visitas, captaciones y ventas.',
          'Cada paso convierte una parte del anterior.',
          'No todos los toques se convierten en visitas, no todas las visitas en captaciones y no todas las captaciones terminan en venta.',
          'Eso no es un problema. Es la naturaleza del negocio.',
        ],
      },
      {
        title: 'El mínimo de actividad',
        paragraphs: [
          'Un asesor debería mantener aproximadamente 4 toques profesionales al día.',
          'Eso supone unos 80 toques al mes.',
          'Un toque no es cualquier mensaje: es una conversación real con potencial de negocio.',
        ],
        bullets: [
          'un propietario',
          'un posible vendedor',
          'un prescriptor',
          'un contacto relevante del barrio',
          'un seguimiento importante',
        ],
      },
      {
        title: 'De los toques salen las visitas',
        paragraphs: [
          'De esos 80 toques mensuales, solo una pequeña parte se convertirá en visitas.',
          'Si el asesor trabaja bien, una referencia razonable es 8 visitas al mes.',
          'Eso significa que solo el 10 % de los toques termina en una visita.',
          'Es una conversión muy prudente.',
        ],
      },
      {
        title: 'De las visitas salen las captaciones',
        paragraphs: [
          'No todas las visitas terminan en encargo. Eso también es normal.',
          'Un ratio muy razonable es 2 captaciones al mes.',
          'Eso significa que aproximadamente 1 de cada 4 visitas termina en captación.',
          'También es una conversión bastante conservadora.',
        ],
      },
      {
        title: 'De las captaciones salen las ventas',
        paragraphs: [
          'Si el asesor ha captado bien, una parte de esas viviendas terminará vendiéndose.',
          'Una referencia muy realista es 10 ventas al año.',
          'Eso significa que, de unas 24 captaciones anuales, se venden aproximadamente 10.',
          'Menos de la mitad. De nuevo, es una conversión prudente.',
        ],
      },
      {
        title: 'Lo importante que debes entender',
        paragraphs: [
          'Si miramos toda la cadena completa aparece una idea muy poderosa.',
          '80 toques al mes llevan a 8 visitas, 2 captaciones y 10 ventas al año.',
          'Las conversiones son bajas: 10 % de toques a visitas, 25 % de visitas a captaciones y menos del 50 % de captaciones a ventas.',
          'El sistema está calculado con márgenes muy conservadores.',
        ],
      },
      {
        title: 'Esto es un mínimo, no un máximo',
        paragraphs: [
          'Estos números no representan lo máximo que puede hacer un asesor.',
          'Representan el mínimo de actividad razonable para que el negocio funcione.',
          'Muchos asesores superan estas cifras cuando dominan el oficio.',
          'Más toques generan más visitas, más visitas generan más captaciones y más captaciones generan más ventas.',
        ],
      },
      {
        title: 'La conclusión es muy simple',
        paragraphs: [
          'El negocio inmobiliario no es complicado, pero exige constancia en la actividad.',
          'Hablar con personas, generar visitas, captar viviendas y mover compradores.',
          'Si el asesor mantiene esa cadena activa el tiempo suficiente, las ventas terminan llegando.',
          'En este negocio, la actividad sostenida termina convirtiéndose en operaciones.',
        ],
      },
      {
        title: 'Frase clave del equipo',
        paragraphs: [
          'Si después de 80 toques al mes no hay visitas, el problema es cómo tocas.',
          'Si hay visitas pero no hay captaciones, el problema es cómo diagnosticas.',
          'Si hay captaciones pero no hay ventas, el problema es cómo captas.',
          'Esa frase resume muy bien dónde mirar cuando un embudo no funciona.',
        ],
      },
    ],
    mistake: 'Mirar solo el resultado final de venta y no entender en qué tramo de la cadena se está rompiendo el negocio.',
    testPrompt: '¿Qué enseñan estos KPI mínimos al asesor?',
    testOptions: [
      { id: 'a', label: 'Que si no vende este mes, todo el sistema ha fallado' },
      { id: 'b', label: 'Que el negocio depende de sostener una cadena de actividad y conversiones prudentes', correct: true },
      { id: 'c', label: 'Que lo importante es captar muchas viviendas aunque no se conviertan' },
    ],
    successNote: 'La clave no es adivinar: es sostener la actividad y leer en qué tramo del embudo se rompe la conversión.',
  },
];

export const ADVISOR_GUIDE_TOTAL = ADVISOR_GUIDE_SECTIONS.length;

const allObjectives = ADVISOR_GUIDE_SECTIONS.map((section) => section.objective);
const allWhyItMatters = ADVISOR_GUIDE_SECTIONS.map((section) => section.whyItMatters);
const allMistakes = ADVISOR_GUIDE_SECTIONS.map((section) => section.mistake);
const allSuccessNotes = ADVISOR_GUIDE_SECTIONS.map((section) => section.successNote);
const allSectionTitles = ADVISOR_GUIDE_SECTIONS.flatMap((section) => section.sections?.map((item) => item.title) || []);
const allBullets = ADVISOR_GUIDE_SECTIONS.flatMap((section) => section.bullets);

const getBullet = (section: AdvisorGuideSection, index: number) =>
  section.bullets[index] || section.bullets[section.bullets.length - 1] || section.objective;

const getSectionTitle = (section: AdvisorGuideSection, index: number) =>
  section.sections?.[index]?.title || section.sections?.[section.sections.length - 1]?.title || section.title;

export const ADVISOR_GUIDE_PASS_SCORE = 9;

export const getAdvisorGuideExamQuestions = (section: AdvisorGuideSection): AdvisorGuideExamQuestion[] => {
  const currentSectionTitles = section.sections?.map((item) => item.title) || [];
  const bulletA = getBullet(section, 0);
  const bulletB = getBullet(section, 1);
  const bulletC = getBullet(section, 2);
  const sectionTitleA = getSectionTitle(section, 0);
  const sectionTitleB = getSectionTitle(section, 1);

  return [
    {
      id: `${section.id}-objective`,
      prompt: '¿Cuál describe mejor la idea central de este capítulo?',
      options: buildOptions(
        section.objective,
        pickDistractors(allObjectives, section.objective, [section.whyItMatters, section.mistake, section.successNote]),
      ),
    },
    {
      id: `${section.id}-why`,
      prompt: '¿Por qué importa este capítulo dentro del método comercial?',
      options: buildOptions(
        section.whyItMatters,
        pickDistractors(allWhyItMatters, section.whyItMatters, [section.objective, section.mistake, section.successNote]),
      ),
    },
    {
      id: `${section.id}-mistake`,
      prompt: '¿Qué error intenta corregir este capítulo?',
      options: buildOptions(
        section.mistake,
        pickDistractors(allMistakes, section.mistake, [bulletA, bulletB, bulletC]),
      ),
    },
    {
      id: `${section.id}-bullet-1`,
      prompt: '¿Cuál de estas ideas sí forma parte del método explicado en este capítulo?',
      options: buildOptions(
        bulletA,
        pickDistractors(allBullets, bulletA, [section.mistake, section.successNote, section.objective]),
      ),
    },
    {
      id: `${section.id}-bullet-2`,
      prompt: '¿Qué afirmación encaja con el enfoque correcto del capítulo?',
      options: buildOptions(
        bulletB,
        pickDistractors(allBullets, bulletB, [section.mistake, section.objective, section.whyItMatters]),
      ),
    },
    {
      id: `${section.id}-bullet-3`,
      prompt: '¿Qué idea debería quedarte grabada tras leer este bloque?',
      options: buildOptions(
        bulletC,
        pickDistractors(allBullets, bulletC, [section.mistake, section.successNote, section.objective]),
      ),
    },
    {
      id: `${section.id}-section-1`,
      prompt: '¿Qué bloque sí pertenece al desarrollo de este capítulo?',
      options: buildOptions(
        sectionTitleA,
        pickDistractors(allSectionTitles, sectionTitleA, currentSectionTitles),
      ),
    },
    {
      id: `${section.id}-section-2`,
      prompt: '¿Qué otro bloque forma parte del capítulo y no de otro tema de la guía?',
      options: buildOptions(
        sectionTitleB,
        pickDistractors(allSectionTitles, sectionTitleB, currentSectionTitles),
      ),
    },
    {
      id: `${section.id}-closing`,
      prompt: '¿Qué frase resume mejor el aprendizaje final de este capítulo?',
      options: buildOptions(
        section.successNote,
        pickDistractors(allSuccessNotes, section.successNote, [section.objective, section.whyItMatters, section.mistake]),
      ),
    },
    {
      id: `${section.id}-legacy`,
      prompt: section.testPrompt,
      options: section.testOptions,
    },
  ];
};
