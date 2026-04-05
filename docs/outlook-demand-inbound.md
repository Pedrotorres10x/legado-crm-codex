# Outlook -> Demandas CRM

Esta integración permite que un correo entrante en Outlook se convierta en:

- contacto nuevo o actualizado en `contacts`
- demanda en `demands`
- email registrado en `communication_logs`
- interacción en `interactions`
- notificación interna para revisión o seguimiento

## Endpoint

`POST /functions/v1/outlook-demand-inbound`

Header requerido:

- `x-outlook-key: <OUTLOOK_DEMAND_SECRET>`

## Payload recomendado desde Power Automate

```json
{
  "subject": "Busco piso en Benidorm",
  "body": "Hola, soy Ana. Busco piso de 2 habitaciones en Benidorm, hasta 250000€. Mi teléfono es 600123123.",
  "html": "<p>Hola...</p>",
  "from": "Ana Lopez <ana@email.com>",
  "from_name": "Ana Lopez",
  "sender_email": "ana@email.com",
  "attachments": [
    {
      "name": "preferencias.pdf",
      "contentType": "application/pdf",
      "size": 120030
    }
  ],
  "metadata": {
    "source_mailbox": "demandas@tuempresa.com",
    "outlook_message_id": "AAMkAD..."
  }
}
```

## Flujo recomendado en Power Automate

1. Trigger: `When a new email arrives (V3)`.
2. Condición opcional: solo carpeta o buzón de demandas.
3. Acción HTTP:
   - método: `POST`
   - URL: `https://<tu-proyecto>.supabase.co/functions/v1/outlook-demand-inbound`
   - header `x-outlook-key`
   - header `Content-Type: application/json`
4. Body: mapear asunto, remitente, cuerpo de texto/HTML y adjuntos.

### Body listo para Power Automate

```json
{
  "subject": "@{triggerOutputs()?['body/subject']}",
  "body": "@{triggerOutputs()?['body/bodyPreview']}",
  "html": "@{triggerOutputs()?['body/body']?['content']}",
  "from": "@{triggerOutputs()?['body/from']?['emailAddress']?['name']} <@{triggerOutputs()?['body/from']?['emailAddress']?['address']}>",
  "from_name": "@{triggerOutputs()?['body/from']?['emailAddress']?['name']}",
  "sender_email": "@{triggerOutputs()?['body/from']?['emailAddress']?['address']}",
  "metadata": {
    "source_mailbox": "demandas@tuempresa.com",
    "outlook_message_id": "@{triggerOutputs()?['body/id']}",
    "conversation_id": "@{triggerOutputs()?['body/conversationId']}"
  }
}
```

Si en tu flujo añades `Get attachments`, puedes ampliar el payload con `attachments`.

## Comportamiento

- Si el email no parece una demanda real, se ignora.
- Si hay dudas, la demanda se crea con marca de revisión:
  - tag `demanda-pendiente-revision`
  - `communication_logs.status = revision_manual`
  - `auto_match = false`
- Si la confianza es buena:
  - tag `demanda-outlook-procesada`
  - `communication_logs.status = clasificado`
  - `auto_match = true`

## Variable necesaria

Crear en Supabase:

- `OUTLOOK_DEMAND_SECRET`

## Alternativa sin Power Automate Premium

Si no tienes licencia Premium, usa reenvío de Outlook a una dirección de parsing en Brevo.

Flujo:

- Outlook recibe el correo
- Outlook lo reenvía automáticamente a `demandas@inbound.planhogar.es`
- Brevo Inbound Parsing llama a `POST /functions/v1/demand-email-inbound`
- Esa función reenvía internamente al extractor de demandas del CRM

Endpoint para Brevo:

`POST /functions/v1/demand-email-inbound`

Header requerido:

- `x-brevo-key: <BREVO_INBOUND_SECRET>`

Configuración recomendada:

1. En Outlook crea una regla:
   - condición: correos que lleguen a la carpeta o buzón de demandas
   - acción: reenviar a `demandas@inbound.planhogar.es`
2. En Brevo Inbound Parsing apunta `demandas@inbound.planhogar.es` a:
   - `https://edeprsrdumcnhixijlfu.supabase.co/functions/v1/demand-email-inbound`

Notas:

- Requiere que `inbound.planhogar.es` ya esté configurado en Brevo.
- Reutiliza la misma lógica de extracción que `outlook-demand-inbound`.
