# Auditoria de fuentes externas (2026-03-14)

Fuentes revisadas fuera del repo:

- `C:\Users\Pedro Torres\OneDrive\Escritorio\rk\Reparto_Comisiones_Asesores_PedroTorres10x.docx`
- `C:\Users\Pedro Torres\OneDrive\Escritorio\rk\Objetivos agentes (para trabajar con agentes).xlsx`
- `C:\Users\Pedro Torres\OneDrive\Escritorio\rk\Copia de Copia de Empleados vs autónomos.pptx`
- `C:\Users\Pedro Torres\OneDrive\Escritorio\rk\Copia de Copia de Politica retributiva asalariados.pptx`

## Lo que queda confirmado

### Reparto comercial

El documento de reparto confirma:

- `60% captacion / 40% venta`
- dentro de cada lado:
  - `70% origen`
  - `30% trabajo`
- regla clave:
  - si el asesor capta al propietario, se le reconoce tambien el lado de origen comprador aunque el comprador entre por portal o agencia

### Filosofia del sistema

Las presentaciones refuerzan el mismo principio:

- el sistema debe premiar `traer negocio`
- no debe ser facil de manipular agrupando operaciones
- el rappel/tramo semestral se justifica por equilibrio entre motivacion comercial y control financiero

### Tramos / rappel

La presentacion de politica retributiva confirma para 2025:

- `Tramo 1: 0 -> 32.500`
- `Tramo 2: 32.500 -> 47.500`
- `Tramo 3: 47.500+`

Y la comparativa de empleados/autonomos refuerza el corte semestral como regla base.

## Lo que aparece sobre Horus

Las presentaciones hablan de:

- `Puntos Horus`
- objetivo orientado a conseguir `2 captaciones`
- equivalencia:
  - `4 entrevistas de captacion por recomendacion ~= 500 puntos`
  - `10 entrevistas de captacion por prospeccion ~= 500 puntos`
- formula mostrada:
  - `100 puntos = 1%`
  - `500 puntos = 5%`
- y, muy importante:
  - una diapositiva dice explicitamente `Promedio ultimos 3 meses`

## Discrepancias detectadas con el modelo actual hablado/implementado

### Horus: mensual vs promedio rolling de 3 meses

En las conversaciones de producto recientes se ha fijado:

- bonus Horus `promedio rolling de 3 meses`
- objetivo `500`

La presentacion revisada sugiere:

- Horus ligado a `promedio ultimos 3 meses`
- con conversion `100 puntos = 1%`

Esta discrepancia ya queda resuelta a favor del modelo historico:

- Horus se calcula por `promedio ultimos 3 meses`
- objetivo `500`

### Horus: toques + entrevistas de captacion

Las diapositivas parecen poner mucho foco en:

- `Toques`
- `Entrevistas de captacion`

En el CRM actual hemos ampliado el modelo para incluir:

- toques
- visitas comprador
- captaciones
- arras firmadas

Eso puede ser una evolucion valida del modelo, pero no es necesariamente identico al material original.

### Politica retributiva: aparece "negociacion"

La presentacion de politica retributiva deja ver una tercera capa:

- `Origen contacto`
- `Trabajo`
- `Negociacion`

En la implementacion actual del CRM, el reparto visible/documentado se ha simplificado a:

- `origen`
- `trabajo`

La capa de `negociacion` no se ha modelado de forma explicita en la UI actual.

## Conclusiones operativas

1. El modelo de `60/40` y `70/30` si queda muy bien respaldado por las fuentes.
2. El papel del `origen` como motor de carrera comercial queda confirmado.
3. El material externo refuerza que Horus es una herramienta de habito y prediccion, no solo un bonus decorativo.
4. Hay una discrepancia importante pendiente de resolver:
   - si Horus se paga por `mes`
   - o por `promedio rolling de 3 meses`
5. Tambien queda por decidir si la implementacion moderna debe:
   - copiar exactamente el modelo antiguo
   - o mantener una version evolucionada mas conectada a visitas/captaciones/arras

## Recomendacion

No tocar mas la logica economica de Horus hasta cerrar expresamente estas dos decisiones:

1. ventana de calculo del bonus (`mes` vs `rolling 3 meses`)
2. tabla canonica de actividades que realmente puntuan para llegar al bonus
