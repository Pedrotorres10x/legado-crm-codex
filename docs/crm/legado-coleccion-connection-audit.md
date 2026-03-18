# Auditoria Ejecutiva: Legado Coleccion -> CRM Legado

Fecha: 2026-03-18

## Objetivo

Dejar una foto ejecutiva y accionable del estado de la conexion entre:

- `casa-wow-catalogo-main` (`Legado Coleccion`)
- `legadocrm-main` (`CRM Legado`)

La idea no es redescubrir la integracion, sino identificar:

- lo que ya funciona
- lo que sobra
- lo que hay que rehacer
- el orden correcto de limpieza

## Lo Que Funciona

- El frontal de `Legado Coleccion` ya apunta al CRM nuevo.
- El catalogo de propiedades consume el circuito publico del CRM nuevo.
- El formulario de leads envia a `public-lead` del CRM nuevo.
- El CRM guarda esos leads con origen `Legado Coleccion`, tags `legadocoleccion` y metadata de intencion.
- `public-lead` ya acepta tambien leads generales sin `property_id`.
- El panel `web-leads-admin` del CRM ya soporta el scope `legado`.
- El tracking web reconoce `legadocoleccion.es` y aterriza en CRM.

## Lo Que Sobra

- Defaults al CRM antiguo dentro de `Legado Coleccion`.
  - `supabase/functions/crm-proxy/index.ts`
  - `supabase/functions/refresh-featured/index.ts`
- El endpoint heredado `receive-lead` dentro del proxy.
- La arquitectura hibrida:
  - unas llamadas van directas al CRM nuevo
  - otras pasan por proxy
  - algunas piezas auxiliares conservan el CRM viejo
- La documentacion vieja que aun describe como pendiente la persistencia de metadata de intencion.

## Lo Que Falta

- Un contrato unico y explicito `Legado Coleccion -> CRM Legado`.
- Una sola estrategia de conexion:
  - o acceso directo al CRM nuevo
  - o proxy limpio y unico
- Identidad satelite explicita en CRM:
  - preferible `legadocoleccion`
  - evitar el genrico `legado` cuando el activo ya esta definido
- Definir si los leads generales deben quedarse con el tag `general-web-lead` actual o migrar a una identidad satelite mas especifica.

## Lo Que Hay Que Rehacer

### 1. Unificar targets

Todo `Legado Coleccion` debe apuntar al mismo CRM real.

No puede quedar esta mezcla:

- frontend -> CRM nuevo
- proxy/refresh -> CRM antiguo por defecto

### 2. Limpiar el proxy

`crm-proxy` debe quedar en uno de estos dos estados:

- reducido solo a endpoints privados/admin que de verdad necesiten proxy
- o eliminado si ya no aporta valor

Si se mantiene:

- sin `receive-lead`
- sin defaults al CRM antiguo
- sin rutas ambiguas

### 3. Rehacer `refresh-featured`

`refresh-featured` debe leer solo del CRM nuevo y asumir que `public-properties` es la fuente oficial.

### 4. Actualizar documentacion

Actualizar o archivar la documentacion de handoff de metadata para que refleje el estado real:

- CRM ya persiste intencion
- CRM ya la expone en admin

## Riesgo Principal

El riesgo no es que no haya conexion.

El riesgo es tener una conexion partida:

- una parte del sistema usa el CRM nuevo
- otra parte puede seguir leyendo del antiguo

Eso genera:

- verdad duplicada
- featured desalineados
- debug dificil
- confianza baja en el circuito

## Orden Recomendado De Limpieza

1. Confirmar y fijar CRM nuevo como unica base para `Legado Coleccion`.
2. Corregir `crm-proxy` y `refresh-featured` para eliminar defaults al CRM antiguo.
3. Eliminar `receive-lead` del circuito si ya no existe en el CRM actual.
4. Decidir si el proxy sigue vivo o si el satelite trabaja casi todo directo.
5. Dar identidad explicita a `legadocoleccion` dentro del CRM.
6. Decidir si `general-web-lead` se mantiene como tag operativo o se renombra.
7. Actualizar documentacion y cerrar deuda heredada.

## Conclusión

La base buena ya existe:

- propiedades
- leads
- tracking
- admin de leads

Lo pendiente no es "conectar mas".

Lo pendiente es limpiar y unificar para que `Legado Coleccion` quede colgado de una sola verdad: este CRM.
