# Portal Cohort Alicante 50

## Estado

Definido y aprobado a nivel funcional. Aun no implementado.

## Objetivo

Seleccionar exactamente 50 inmuebles del snapshot actual de HabiHub para publicarlos en un portal como cohorte editorial de captacion.

La cohorte debe maximizar:

- calidad visual y editorial
- cobertura territorial real del feed actual
- variedad de rangos de precio
- captacion de interesados por distintas zonas de Alicante
- minima concentracion por zona o ciudad

No se debe optimizar por volumen de stock en una sola zona.
No se debe sesgar la muestra hacia ticket medio o bajo por una regla artificial.

## Nombre estable

- tag tecnica: `portal_cohort_alicante_50`
- badge visible: `Muestra Alicante 50`
- filtro visible: `Muestra Alicante 50`

## Fuente de datos

Tabla base: `properties`

Solo se trabajara con inmuebles que cumplan:

- `source = 'habihub'`
- `source_feed_name = 'HabiHub · Blanca Cálida'`
- `province = 'Alicante'`
- `status = 'disponible'`
- `price` informado
- `latitude` y `longitude` informadas
- `zone` o `city` informado
- minimo 6 fotos validas
- `title` no vacio
- `description` no vacia
- `property_type` informado

## Regla geografica

No inventar ciudades ni zonas.

La geografia debe salir siempre del feed actual de HabiHub.

Reglas:

- `zone_key = zone` si existe
- si `zone` esta vacio, `zone_key = city`
- `city_key = city`
- solo se permite normalizacion minima de formato:
  - trim
  - mayusculas/minusculas
  - acentos
  - variantes obvias

No crear agrupaciones manuales como criterio principal.

## Restriccion principal

La cohorte final debe contener exactamente 50 inmuebles.

Ademas:

- objetivo preferido: 35-50 zonas distintas
- minimo aceptable: 28 zonas distintas
- debe incluir variedad visible de tramos de precio
- maximo normal: 2 inmuebles por zona
- maximo excepcional: 3 inmuebles por zona solo para cerrar 50 exactas

## Regla de precio

No existe limite superior de precio para esta cohorte.

El precio se usa como variable de diversidad comercial, no como filtro excluyente.

La muestra final debe evitar quedar dominada por un solo escalon de precio.

Objetivo editorial:

- captar compradores de entrada
- captar compradores medios
- captar compradores altos
- captar compradores premium internacional

Tramos orientativos para evaluar equilibrio:

- hasta `250000`
- `250000-500000`
- `500000-1000000`
- `1000000+`

Estos tramos no son cupos rigidos, pero la cohorte no debe colapsar en uno solo.

## Filosofia de seleccion

Cada inmueble publicado funciona como puerta de entrada para captar demanda en su zona.

Por tanto:

- se prioriza cobertura territorial
- se prioriza tambien amplitud comercial de precios
- se penaliza concentracion
- una zona con mucho stock no debe comerse la cohorte

Regla editorial complementaria:

> un inmueble excelente no debe entrar automaticamente si empeora mucho la variedad de zonas o la variedad de precios

Regla editorial clave:

> un segundo inmueble de una zona ya cubierta solo puede entrar si compensa claramente perder cobertura territorial

## Algoritmo

La seleccion no debe hacerse con un simple `ORDER BY score DESC LIMIT 50`.

Debe implementarse como una seleccion iterativa greedy con penalizacion dinamica.

### 1. Score de calidad

Cada inmueble obtiene un `quality_score` de 0 a 100:

- `media_score`: 40
- `completeness_score`: 25
- `commercial_score`: 20
- `confidence_score`: 15

#### Media score

- 6-7 fotos: 8
- 8-9 fotos: 12
- 10-14 fotos: 18
- 15 o mas fotos: 22
- plano: +6
- video: +4
- tour virtual: +5
- portada valida: +3

#### Completeness score

- descripcion >= 700 caracteres: 8
- descripcion >= 400 caracteres: 6
- superficie informada: 4
- dormitorios informados: 3
- banos informados: 3
- zona o ciudad clara: 2
- precio informado: 3
- coordenadas validas: 2

#### Commercial score

- residencial fuerte: +6
- estudio: +4
- rango de precio representativo para abrir demanda: hasta +5
- rango premium bien presentado: hasta +4
- buena relacion tipo/precio/presentacion: hasta +4
- extras vendibles: hasta +3

#### Confidence score

- geo correcta: +4
- tipo coherente: +3
- sin incoherencias de ficha: +4
- media accesible: +2
- ubicacion consistente: +2

### 2. Ranking interno por zona

Primero se rankea dentro de cada `zone_key`:

- `zone_rank = 1`: mejor candidato de la zona
- `zone_rank = 2`: segundo mejor
- `zone_rank = 3`: tercero

### 3. Score de seleccion dinamico

En cada iteracion:

`selection_score = quality_score + coverage_bonus + price_diversity_bonus - concentration_penalty - price_concentration_penalty`

#### Coverage bonus

- zona nueva: +30
- ciudad nueva: +10

#### Price diversity bonus

- tramo de precio aun no representado: +18
- tramo poco representado: +8

#### Price concentration penalty

- si el tramo ya esta muy sobrerrepresentado respecto al resto: -10 a -25
- si una nueva entrada empeora claramente el equilibrio global de precio: penalizacion adicional

#### Concentration penalty

- si la zona aun no esta representada: 0
- si ya hay 1 inmueble de esa zona: -25
- si ya hay 2 inmuebles de esa zona: -60
- si ya hay 3 o mas: prohibido
- si la ciudad ya tiene 2 o mas inmuebles: -15

### 4. Fases

#### Fase 1

Seleccionar solo `zone_rank = 1` y priorizar maxima cobertura territorial con una primera dispersion de precios razonable.

#### Fase 2

Si aun faltan plazas para llegar a 50, abrir `zone_rank = 2` manteniendo control de concentracion geografica y de precio.

#### Fase 3

Si aun faltan plazas, abrir `zone_rank = 3` como excepcion para cerrar 50 exactas sin romper en exceso el equilibrio.

## Desempates

Orden de desempate:

1. mayor `quality_score`
2. mayor numero de fotos
3. tiene plano
4. tiene tour virtual
5. descripcion mas completa
6. mejor aporte a la diversidad de precio
7. precio mas comercial

## Tipologias

En esta primera cohorte la preferencia es residencial publicable.

Prioridad alta:

- piso
- casa
- chalet
- adosado
- atico
- duplex
- estudio

Solo entraran otras tipologias si se decide de forma explicita en una iteracion futura.

## Salida esperada

La seleccion final debe poder producir una tabla con:

- `crm_reference`
- `title`
- `city`
- `zone`
- `property_type`
- `price`
- `photo_count`
- `has_floor_plan`
- `has_video`
- `has_virtual_tour`
- `quality_score`
- `selection_score`
- `zone_rank`
- `selection_reason`

## Visibilidad en CRM

Los inmuebles elegidos deberan quedar marcados para encontrarlos con facilidad:

- tag tecnica persistente: `portal_cohort_alicante_50`
- badge visible en listados: `Muestra Alicante 50`
- filtro visible en listados: `Muestra Alicante 50`

## Arranque por portal

La implantacion empieza por `Kyero`.

Regla operativa inicial:

- `Kyero` debe poder publicar solo los inmuebles etiquetados con `portal_cohort_alicante_50`
- no debe mezclar esa cohorte con el resto del stock general
- la configuracion debe vivir en `portal_feeds.filters` para que sea auditable y reversible
- la seleccion de la cohorte y la exportacion del portal deben quedar desacopladas

Eso significa:

- una capa calcula y marca la cohorte
- otra capa exporta a `Kyero` solo los inmuebles con ese tag

## Regla de implementacion

Cuando se implemente:

- no mezclar esta cohorte con toda la cartera
- no publicar mas de 50
- no sustituir el criterio geografico real del feed por zonas inventadas
- recalcular la cohorte completa sobre el snapshot actual de HabiHub cuando se lance el refresh
- aplicar siempre criterio `last snapshot wins`
- cualquier inmueble etiquetado en una version previa que no entre en el snapshot nuevo debe salir de la cohorte
- no introducir un limite superior de precio artificial
- controlar que `Kyero` exporta exclusivamente la cohorte etiquetada

## Nota

Este documento fija el criterio aprobado para la cohorte editorial de Alicante.

Si en el futuro se crean cohortes nuevas, deben definirse con su propia tag tecnica, badge visible y reglas de seleccion.
