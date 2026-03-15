
## ✅ COMPLETADO: Eliminación total de MultiChannel

Toda dependencia, referencia y lógica relacionada con el satélite MultiChannel ha sido eliminada.

### Eliminado
- Secretos `MULTICHANNEL_URL` y `MULTICHANNEL_WEBHOOK_SECRET` borrados
- Edge function `crm-multichannel-data` eliminada completamente
- Función `callGateway()` (crm-gateway externo) eliminada de `campaign-demand-enrich`
- Link a multichannel.lovable.app eliminado del sidebar
- Label "MultiChannel" eliminado de AdminErpDashboard
- Todas las referencias en comentarios limpiadas

### Refactorizado
- `campaign-demand-enrich` → genera mensajes AI localmente + envía via sendMessage
- `db-cleanup` → usa sendWhatsApp directo
- `multichannel-webhook` → auth solo por service key (sin secreto legacy)
- Comentarios actualizados en: erp-dispatch, erp-sync, greenapi-webhook, brevo-inbound, daily-match-sender, campaign-classify, campaign-qualify

### Arquitectura actual de envíos
- WhatsApp → `_shared/greenapi.ts` → Green API directo
- Email → `_shared/brevo.ts` → Brevo directo  
- Unificado → `_shared/send-message.ts` (abstrae canal)

---

## ✅ COMPLETADO: Sistema de Captación por WhatsApp (Prospecting)

Secuencia automatizada de 4 WhatsApp para convertir prospectos Statefox en clientes vendedores.

### Secuencia
| Paso | Timing | Contenido |
|------|--------|-----------|
| 0 | Día 0 | Texto conversacional, SIN links |
| 1 | Día 3 | Dato de demanda activa, SIN links |
| 2 | Día 7 | Link a landing de valoración gratuita |
| 3 | Día 14 | Último toque con link, despedida amable |

### Implementado
- **Tabla `prospecting_sequences`** con RLS (agente ve sus propios, admin/coord ve todo)
- **Edge function `prospecting-sequence`**: Motor de la secuencia (enroll + process_pending)
- **Edge function `prospecting-cron`**: Cron cada 2h que procesa pendientes
- **Landing `/valoracion`**: Página pública para solicitar valoración gratuita
- **Reply detection** en `greenapi-webhook`: Pausa automática + tarea urgente + notificación push al agente
- **Anti-bloqueo**: Respeta `wa_increment_daily`, delays aleatorios 2-5min entre envíos
- **Tarea de cierre**: Si se completan los 4 pasos sin respuesta → tarea de seguimiento al agente

### Cómo enrollar un contacto
```typescript
supabase.functions.invoke('prospecting-sequence', {
  body: { action: 'enroll', contact_id: 'uuid', agent_id: 'uuid' }
});
```
