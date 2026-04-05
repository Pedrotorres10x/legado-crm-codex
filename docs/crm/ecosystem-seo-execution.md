# Ecosystem SEO Execution

## Objetivo

Traducir el mapa vigente del ecosistema a una ejecucion simple y util.

`El Faro` queda fuera de esta ejecucion y no debe reintroducirse en backlog, enlaces ni taxonomias.

## Arquitectura activa

### Ruta seller local

- `Legado Inmobiliaria`
  capta negocio seller en `Marina Baixa`
- `CRM`
  recibe, clasifica y mueve ese lead a operativa

### Ruta buyer provincial

- `CostaBlanca News`
  capta interes editorial y buyer discovery en `Alicante`
- `Legado Coleccion`
  convierte esa atencion en demanda buyer
- `CRM`
  cruza la demanda con stock, asesor y seguimiento

## Clusters por activo

### Legado Inmobiliaria

- vender vivienda en Marina Baixa
- valoracion
- cuanto vale mi casa
- cambio de vivienda
- servicios para propietarios

### Legado Coleccion

- comprar vivienda en Alicante
- producto selecto
- compra por zonas
- segunda residencia
- compra internacional

### CostaBlanca News

- lifestyle provincial
- mejores zonas
- mercado
- segunda residencia
- inversion
- compra internacional

## Arquitectura de enlazado

- `CostaBlanca News` -> `Legado Coleccion`
- `Legado Coleccion` puede devolver autoridad y contexto hacia `CostaBlanca News`
- `Legado Inmobiliaria` enlaza a sus propias landings y servicios seller
- todas las rutas utiles deben aterrizar en el `CRM`

## Checklist operativa vigente

- medir `Costablanca -> Coleccion`
- medir `seller local -> CRM`
- mantener taxonomia limpia entre `buyer` y `seller`
- no reabrir rutas, assets o payloads ligados a `El Faro`
