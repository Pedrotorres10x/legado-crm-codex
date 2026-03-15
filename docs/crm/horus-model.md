# Modelo Horus y Rendimiento

Estado: reconstruccion en curso a partir del codigo legado del propio repo.

Ultima actualizacion: 2026-03-14

## Calibracion comercial base fijada el 14/03/2026

La oficina trabaja con esta referencia aproximada por agente:

- `4 toques diarios`
- `2 visitas de captacion semanales`
- `2 captaciones en exclusiva mensuales`
- `10 ventas / arras anuales`

Esta referencia sirve para dos cosas:

- calibrar objetivos KPI visibles para agente y admin
- calibrar el modelo Horus para que llegar a `500` no sea ni trivial ni imposible

La filosofia no es premiar ruido, sino un ritmo comercial que deberia generar negocio de forma constante.

## Objetivos KPI visibles

Para no deformar el modelo comercial, los KPI visibles quedan asi:

- `Toques Horus / dia`: `4`
- `Visitas de captacion / semana`: `2`
- `Captaciones en exclusiva / mes`: `2`
- `Arras / ano`: `10`

En las vistas de coaching y admin, el objetivo anual no se debe leer como un numero plano en enero, sino como ritmo esperado a fecha actual.

## Objetivo

Este documento fija el modelo de seguimiento de agentes para evitar que vuelva a quedar implicito o repartido entre varias pantallas.

Debe servir como fuente de verdad para:

- radar / spider chart de agente
- puntos Horus
- bonus Horus en comisiones
- embudo de conversion
- lectura admin de seguimiento
- proyeccion comercial del agente

## Regla de ventana temporal

Hay dos ventanas distintas y no se deben mezclar:

### Seguimiento / rendimiento

Ventana dinamica y rolling:

- `3 meses` hacia atras desde hoy
- opcionalmente `6 meses` hacia atras desde hoy

Se usa para:

- radar
- embudo
- lectura de rendimiento
- proyeccion comercial

### Bonus Horus

Ventana rolling:

- promedio de los ultimos `3 meses`

Se usa para:

- activar o no el bonus Horus
- mostrar al agente si llega o no al objetivo rolling

No se debe mezclar con trimestre natural salvo que una pantalla lo diga expresamente y use otra logica distinta.

## Ejes confirmados del radar

El radar historico del CRM trabaja con 4 ejes:

1. `Toques`
2. `Entrevistas`
3. `Captaciones`
4. `Facturacion`

Archivo de referencia:

- `src/components/performance/AgentRadarChart.tsx`

## Significado actual de cada eje

### 1. Toques

En el motor actual de rendimiento/Horus cuenta:

- `llamada`
- `whatsapp`
- `email`
- `cafe_comida`

Archivos:

- `src/hooks/useAgentPerformance.ts`
- `src/hooks/useAgentHorusStatus.ts`

### 2. Entrevistas

En el motor actual de rendimiento se usa como cuello de botella de captacion:

- `visita_tasacion`
- deduplicada por oportunidad, para que una captacion trabajada en dos visitas no cuente doble

Archivos:

- `src/hooks/useAgentPerformance.ts`

### 3. Captaciones

Cuenta inmuebles creados en la ventana rolling:

- propiedad creada por el agente

Archivos:

- `src/hooks/useAgentPerformance.ts`
- `src/hooks/useAgentHorusStatus.ts`

### 4. Facturacion

Regla fijada expresamente:

- `facturacion = arras firmadas`
- no `ventas en notaria`
- no `euros facturados`

Implementacion actual:

- propiedad con `arras_status = firmado`
- `arras_date` dentro de la ventana rolling

Archivos:

- `src/hooks/useAgentPerformance.ts`
- `src/hooks/useAgentHorusStatus.ts`

## Puntos Horus actuales

La puntuacion actual se calcula con pesos configurables en `settings.point_weights`.

Claves actuales esperadas:

- `toque`
- `entrevista`
- `captacion`
- `facturacion`
- `quarterly_target`

Compatibilidad legacy:

- si no existe `facturacion`, se usa `venta`

Tabla visible actual para el agente:

| Grupo | Actividades | Puntos por defecto |
| --- | --- | --- |
| Toques Horus | whatsapp | `1` |
| Toques Horus | email | `2` |
| Toques Horus | llamada | `3` |
| Toques Horus | cafe / comida | `5` |
| Toques Horus | reunion de peso / comida | `8` |
| Toques Horus | visita de captacion / tasacion | `8` |
| Visita comprador | sin resultado | `2` |
| Visita comprador | con resultado | `6` |
| Captaciones | captacion / mandato en exclusiva | `70` |
| Facturacion | arras firmadas | `100` |

Objetivo de bonus:

- `500 puntos` de promedio rolling en los ultimos 3 meses

## Criterio de calibracion de puntos

La tabla actual se calibra contra esta referencia aproximada por agente:

- `4 toques / dia`
- `2 visitas de captacion / semana`
- `2 captaciones exclusivas / mes`
- `10 arras / ano`

Hipotesis orientativa de mezcla mensual de toques:

- `35 WhatsApps`
- `20 emails`
- `20 llamadas`
- `10 cafes`
- `3 reuniones comida`

Con esa mezcla:

- toques: `35*1 + 20*2 + 20*3 + 10*5 + 3*8 = 209`
- visitas de captacion: `8*8 = 64`
- captaciones: `2*70 = 140`
- arras medias por mes: `0,8*100 ~= 80`

Total orientativo:

- `209 + 64 + 140 + 80 = 493`

Intencion del modelo:

- un agente sano y constante debe moverse alrededor de `500`
- no se debe poder llegar facil solo con toques blandos
- tampoco debe ser imposible si el agente genera negocio real de forma sostenida

Archivos:

- `src/hooks/useAgentPerformance.ts`
- `src/hooks/useAgentHorusStatus.ts`
- `src/lib/horus-model.ts`
- `src/components/performance/HorusScoringGuide.tsx`

## Embudo actual

El embudo actual del seguimiento queda asi:

1. `Toques`
2. `Visitas de captacion`
3. `Mandato`
4. `Arras firmadas`

Archivo:

- `src/hooks/useAgentPerformance.ts`

## Hallazgo importante del legado

Existe otra logica historica en `AgentActivityReport` que no coincide del todo con el motor actual.

Archivo:

- `src/components/AgentActivityReport.tsx`

Ese modulo cuenta como `Toques Horus`:

- `llamada`
- `email`
- `whatsapp`
- `cafe_comida`
- `reunion`

Y marca objetivo diario:

- `MINIMO_HORUS = 2`

Esto confirma una regla importante del modelo:

- `reunion` es `toque`
- no `entrevista`
- `visita` es la entrevista separada
- `visita_tasacion` o visita de captacion cuenta como toque de nivel alto, equivalente a comida
- si una captacion se trabaja en dos visitas, para Horus cuenta como `una sola visita de captacion` por oportunidad
- la visita comprador no debe pesar demasiado si no genera negocio
- una visita comprador con resultado comercial debe valer claramente mas que una sin resultado

## Regla actual para visitas comprador

Mientras el CRM no guarde un campo explicito de "visita con resultado compra", la implementacion actual usa esta inferencia:

- `visita comprador con resultado`:
  - si `visits.result` se marca como `oferta` o `reserva`, se toma como resultado fuerte explicito
  - y, si no hay resultado explicito, se infiere por existencia de una `offer` posterior sobre el mismo `contact_id + property_id`
- `visita comprador sin resultado`:
  - si `visits.result` se marca como `seguimiento`, `segunda_visita` o `realizada`, cuenta como entrevista de valor intermedio / bajo
  - o si no deriva en oferta posterior
- `cancelada` y `no_show`:
  - no suman como entrevista Horus

Resultados comerciales recomendados en `visits.result`:

- `seguimiento`
- `segunda_visita`
- `oferta`
- `reserva`
- `sin_interes`
- `cancelada`
- `no_show`

Esto respeta la filosofia comercial:

- una visita con comprador sirve
- pero no debe inflar Horus si no genera avance real
- lo que tiene que empujar el sistema es negocio, no volumen vacio de agenda

## Lo que esta confirmado

Esto ya queda fijado y no deberia volver a cambiarse sin decision explicita:

- la ventana de seguimiento es rolling de `3/6 meses`
- el bonus Horus usa promedio rolling de `3 meses`
- el radar tiene 4 ejes
- `facturacion` significa `arras firmadas`
- `captaciones` deben sumar al modelo Horus
- bonus Horus en comisiones debe leer el mismo motor

## Contraste con material externo revisado el 14/03/2026

El material de RRHH/comercial fuera del repo confirma varias cosas del modelo:

- una presentacion indica:
  - `100 puntos = 1%`
  - `500 puntos = 5%`
- y otra diapositiva habla explicitamente de:
  - `Promedio ultimos 3 meses`

Eso ya queda alineado con la decision de negocio fijada el `14/03/2026`:

- `bonus Horus` por promedio rolling de `3 meses`
- objetivo `500 puntos`

Y eso obliga a distinguir dos lecturas:

- `bonus`: comparar el **promedio mensual** de los ultimos 3 meses contra `500`
- `acumulado del periodo`: comparar el **total del trimestre rolling** contra `1500`

No se debe volver a comparar un total de 3 meses contra `500`, porque eso distorsiona la lectura real del agente.

Referencia:

- [source-audit-2026-03-14.md](./source-audit-2026-03-14.md)

## Lo que aun NO esta confirmado al 100%

Todavia no se puede afirmar que el modelo actual sea identico al CRM original en estos puntos:

1. si `reunion` debe puntuar como `toque` o como `entrevista`
2. si habia mas actividades puntuables aparte de los 4 ejes del radar
3. si el modelo original usaba exactamente los mismos pesos que `settings.point_weights`
4. si la proyeccion de agente tenia objetivos adicionales diarios/semanales aparte del radar
5. si `visita` y `entrevista` eran equivalentes o no en todas las pantallas originales

## Archivos clave a revisar antes de cerrar el modelo

- `src/components/AgentActivityReport.tsx`
- `src/components/performance/AgentRadarChart.tsx`
- `src/components/performance/AgentPointsAccumulator.tsx`
- `src/components/performance/AgentConversionFunnel.tsx`
- `src/hooks/useAgentPerformance.ts`
- `src/hooks/useAgentHorusStatus.ts`
- `src/components/AdminKpiBoard.tsx`
- `src/components/AdminExecutiveSummary.tsx`
- `src/components/PropertyCommission.tsx`

## Decision provisional de trabajo

Hasta reconstruir al 100% el modelo original, la referencia operativa actual queda asi:

- `toques`: whatsapp, email, llamada, cafe_comida, reunion, visita_tasacion
- `entrevistas`: visitas de captacion deduplicadas por oportunidad
- `captaciones`: inmuebles creados
- `facturacion`: arras firmadas
- `bonus Horus`: 500 puntos de promedio en los ultimos 3 meses
- `seguimiento`: lectura rolling a 3/6 meses

### Modulacion por situacion del agente

El objetivo de Horus no es empujar a todos en la misma direccion. El CRM debe modular el foco comercial segun la cartera activa del agente:

- `<5` propiedades disponibles: `captacion`
- `5-9` propiedades disponibles: todavia prima `captacion`
- `10-15` propiedades disponibles: zona optima
- `>15` propiedades disponibles: prima `venta`

Lectura de negocio:

- si no hay cartera, el agente debe construir producto
- si la cartera ya esta en zona sana, no tiene sentido seguir empujando captacion por sistema
- si la cartera se pasa de `15`, el problema no es falta de producto, sino exceso de gestion y falta de conversion

Por eso la tabla canonica de puntos se mantiene, pero el CRM expone un `foco comercial`:

- `captacion`
- `venta`
- `equilibrio`

## Semaforo de autonomia

La autonomia no se usa como castigo, sino como premio visible para el agente.

- `Rojo`: control estricto
- `Amarillo`: seguimiento ligero
- `Verde`: va a su aire

Lectura correcta:

- un agente en rojo necesita acompanamiento porque su actividad no esta alineada con el foco que le toca
- un agente en amarillo ya puede trabajar con bastante libertad, pero conviene revisar ritmo y direccion
- un agente en verde se ha ganado autonomia porque esta empujando negocio real donde mas conviene

El semaforo debe leer:

1. foco comercial del agente (`captacion / venta / equilibrio`)
2. cartera disponible
3. toques
4. visitas de captacion
5. captaciones
6. ofertas / traccion compradora

Importante:

- los puntos Horus siguen siendo canónicos e iguales para todos
- lo que cambia por agente no es el valor del punto, sino la interpretacion de si esta empujando donde mas conviene a la oficina

Y cualquier ajuste futuro debe actualizar:

1. radar
2. puntos Horus
3. bonus Horus
4. embudo
5. documentacion

## Siguiente paso serio

Antes de tocar mas la capa de seguimiento, hay que cerrar la tabla canonica de actividades Horus del modelo original:

- actividad
- eje del radar
- si suma puntos
- peso
- objetivo asociado
- periodicidad

Cuando esa tabla quede cerrada, este documento debe pasar de "reconstruccion en curso" a "modelo canonico".
