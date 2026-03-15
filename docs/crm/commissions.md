# Modelo de comisiones

Ultima actualizacion: 2026-03-14

## Separacion de conceptos

En este CRM hay que separar tres cosas:

1. `Tramo`
2. `Bonus Horus`
3. `Comision cobrada en una operacion concreta`

No son lo mismo.

## Filosofia comercial del modelo

Este sistema no esta pensado para premiar que el agente espere negocio de la oficina.

La filosofia correcta es:

- el agente cobra por trabajar una operacion
- el agente sube de tramo por traer negocio
- el agente desbloquea bonus Horus por mantener disciplina comercial

En otras palabras:

- `campo` paga trabajo
- `origen` construye carrera comercial
- `tramo` premia negocio originado
- `Horus` premia actividad comercial sostenida

Esto existe para empujar:

1. prospeccion
2. seguimiento
3. captacion
4. arras firmadas
5. origen real de la oportunidad

Cualquier cambio futuro en calculos, copy o dashboards debe respetar esta filosofia.

## 1. Tramo

El tramo del agente se revisa por semestre natural:

- `1 enero -> 30 junio`
- `1 julio -> 31 diciembre`

No es rolling.

El tramo se calcula sumando **comision de agencia generada** en operaciones originadas por el agente.

Eso significa:

- si una operacion genera `10.000 EUR` de comision de agencia, esos `10.000 EUR` suman al tramo
- solo suman operaciones donde el agente trajo la operacion
- si el agente participa como campo en una operacion ajena, cobra su parte, pero esa operacion **no** suma para subir de tramo

En datos, eso corresponde a:

- `listing_origin_agent_id`
- `buying_origin_agent_id`

## 2. Bonus Horus

El bonus Horus es independiente del tramo.

Se activa por puntos Horus:

- objetivo: `500 puntos`
- ventana: `promedio rolling de los ultimos 3 meses`

El bonus no cambia el tramo.

## 3. Comision por operacion

En cada operacion:

1. se calcula la comision de agencia
2. sobre esa base se aplica el tramo del agente
3. si el bonus Horus esta activo en el promedio rolling, se suma el bonus
4. despues se reparte la operacion:
   - `60 / 40` entre captacion y comprador
   - `70 / 30` dentro de cada lado entre campo y origen

## Regla clave

Una operacion puede:

- pagar comision al agente
- pero no sumarle tramo

Eso pasa cuando el agente hace trabajo de campo en una operacion que no origino.

## Archivos clave

- `src/lib/commissions.ts`
- `src/components/PropertyCommission.tsx`
- `src/hooks/useProfileData.ts`
