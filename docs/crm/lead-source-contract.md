# Lead Source Contract

## Objetivo

Contrato tecnico comun para enviar leads al `CRM`.

`El Faro` deja de ser source valida del sistema activo.

## Regla principal

- el `CRM` define el contrato
- cada web lo rellena con su contexto nativo
- ningun proyecto crea variantes incompatibles

## Payload minimo obligatorio

```json
{
  "source_site": "string",
  "source_type": "string",
  "source_page": "string",
  "source_url": "string",
  "target_asset": "string",
  "journey": "string",
  "lead_intent": "string",
  "persona": "string",
  "language": "string",
  "municipality": "string",
  "region": "string",
  "referrer": "string",
  "utm_source": "string",
  "utm_medium": "string",
  "utm_campaign": "string",
  "gdpr_consent": true
}
```

## Valores canonicos vigentes

### source_site

- `costablanca-news`
- `legado-inmobiliaria`
- `legado-coleccion`

### source_type

- `editorial`
- `commercial`

### target_asset

- `legado-inmobiliaria`
- `legado-coleccion`

### journey

- `seller`
- `buyer`

### lead_intent

- `seller`
- `buyer`

### persona

- `owner`
- `buyer`

### region

- `marina-baixa`
- `alicante-provincia`

## Regla operativa

Si aparece `el-faro` en payloads, taxonomias, mappings o aliases, debe tratarse como legado y retirarse.
