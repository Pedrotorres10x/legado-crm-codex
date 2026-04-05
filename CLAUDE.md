# Legado CRM — Contexto del proyecto

## ¿Qué es este proyecto?

CRM inmobiliario para **Legado Inmobiliaria**. Gestiona el ciclo completo de la operación: captación de propiedades, contactos compradores/vendedores, matching automático, visitas, ofertas, cierres y comunicaciones multicanal.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite (puerto **8080**) |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Estado | TanStack React Query 5 |
| Formularios | React Hook Form + Zod |
| Telefonía | Twilio Voice SDK |
| Email | Brevo |
| WhatsApp | Green API |
| Despliegue | Vercel (frontend) + Supabase (backend) |
| Móvil | Capacitor (Android) |

## Módulos principales

- **Contactos** — gestión completa de compradores, vendedores y colaboradores
- **Propiedades** — fichas, fotos, documentos, blind sheets, portales
- **Pipeline** — oportunidades de venta/alquiler por etapas
- **Matching** — cruce automático contacto-propiedad (cron diario)
- **Visitas y ofertas** — seguimiento y cierre con firma digital
- **Campañas** — email/WhatsApp/SMS multicanal con segmentación
- **Portales** — sync con Fotocasa y otros portales inmobiliarios
- **Comunicaciones** — llamadas Twilio, email Brevo, WhatsApp Green API
- **IA** — 74 Edge Functions: extracción de datos, resumen de llamadas, scoring, matching, búsqueda semántica
- **Admin** — KPIs, evaluación de agentes, radar legal, salud del ecosistema

## Estructura de directorios

```
src/
├── pages/          # 30+ páginas (Dashboard, Contacts, Properties, Matches…)
├── components/     # Componentes por módulo (contacts/, properties/, admin/…)
├── hooks/          # Custom hooks de React Query y lógica de negocio
├── lib/            # Utilidades, modelos de evaluación, helpers
├── contexts/       # AuthContext, etc.
└── integrations/supabase/  # Cliente y tipos generados

supabase/
├── functions/      # 74 Edge Functions en Deno/TypeScript
├── migrations/     # Migraciones de esquema PostgreSQL
└── config.toml     # Configuración de funciones (verify_jwt)
```

## Convenciones

- **Autenticación**: JWT via Supabase Auth. Las Edge Functions protegidas verifican el token en código y usan cliente user-scoped para respetar RLS.
- **RLS**: Aislamiento por `agent_id = auth.uid()` con override para rol `admin` y `coordinadora`.
- **Edge Functions**: Las que acceden a datos de todos los agentes (service_role) deben verificar rol admin/coordinadora explícitamente.
- **Queries**: Siempre filtrar por `agent_id` en DB, nunca cargar toda la tabla y filtrar en memoria.
- **HTML externo**: Siempre sanitizar con `DOMPurify.sanitize()` antes de `dangerouslySetInnerHTML`.

## Variables de entorno clave

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (frontend) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (frontend, pública) |
| `ALLOWED_ORIGIN` | Origen permitido en CORS de Edge Functions (producción) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo en Edge Functions, nunca en frontend |

## Comandos frecuentes

```bash
npm run dev          # Dev server en puerto 8080
npm run build        # Build de producción
npm run test         # Tests con Vitest
supabase db push     # Aplicar migraciones pendientes
supabase functions deploy <nombre>  # Desplegar una Edge Function
```

## Workflow con IA

Este proyecto usa dos agentes de IA en combinación:

- **Claude Code** (este agente) — auditorías, refactors complejos, PRs, debugging profundo, migraciones, seguridad
- **Codex CLI** (copiloto) — generación rápida de features, componentes, boilerplate

### Codex CLI

Ejecutable disponible en:
```
C:/Users/Pedro Torres/AppData/Local/npm-cache/_npx/c8ab89660c602c20/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/codex/codex.exe
```

Uso no interactivo (desde Claude Code):
```bash
"$CODEX" exec -C <dir> --sandbox workspace-write "<prompt>"
```

Config en `~/.codex/config.toml` — modelo `gpt-5.4`, approval_policy `never`.

**Cuándo delegar a Codex:**
- Generar un componente nuevo desde cero
- Scaffolding de features con spec clara
- Boilerplate repetitivo

**Cuándo actúa Claude Code directamente:**
- Seguridad y auditorías
- Refactors con contexto amplio
- Debugging complejo
- Migraciones de BD y Edge Functions
- Decisiones de arquitectura

## Permisos bash (sin confirmación)

`git`, `gh`, `npm`, `npx`, `node`, `ls`, `cat`, `grep`, `find`, `mkdir`, `mv`, `touch`, `curl`

## Lo que NO hacer

- No leer `.env` ni `.env.*` — contienen credenciales de producción
- No ejecutar `rm` sin confirmación explícita del usuario
- No usar `sudo`
- No hacer `git push --force` a `main`
- No desplegar Edge Functions sin revisar que tienen `verify_jwt` correcto en `config.toml`
