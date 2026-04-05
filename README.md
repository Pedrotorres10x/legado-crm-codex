# Legado CRM
[![Check](https://github.com/Pedrotorres10x/legado-crm-codex/actions/workflows/check.yml/badge.svg?branch=main)](https://github.com/Pedrotorres10x/legado-crm-codex/actions/workflows/check.yml)

CRM operativo para la inmobiliaria Legado. El proyecto cubre gestión de contactos, propiedades, demandas, cruces, tareas, comunicaciones, importaciones, firma digital y panel de administración.

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase (Auth, Postgres, Storage, Edge Functions)
- Brevo / Green API / integraciones de portales

## Entornos

- Proyecto canonico del repo: `edeprsrdumcnhixijlfu`
- Estado decidido: este repo debe operar contra un solo Supabase. Cualquier otro proyecto homonimo o paralelo se considera legado hasta archivarlo o borrarlo.
- Fuente de verdad: [`.env.local`](/C:/Users/Pedro%20Torres/OneDrive/Escritorio/legado%20crm/legadocrm-main/.env.local), [`.env`](/C:/Users/Pedro%20Torres/OneDrive/Escritorio/legado%20crm/legadocrm-main/.env) y [`supabase/config.toml`](/C:/Users/Pedro%20Torres/OneDrive/Escritorio/legado%20crm/legadocrm-main/supabase/config.toml) deben apuntar siempre al mismo proyecto.

El arranque local incluye un bloqueo de seguridad que evita abrir la app en `localhost` si el `.env` apunta al proyecto Supabase de producción.

## Desarrollo local

1. Instala dependencias:

```sh
npm install
```

2. Configura `.env.local` con el proyecto canonico o con el entorno temporal que hayas decidido conscientemente.
   Si cambias de proyecto Supabase, cambia tambien `supabase/config.toml` al mismo tiempo o la CLI seguira enlazada al anterior.

```env
VITE_SUPABASE_PROJECT_ID="TU_PROJECT_ID_DEV"
VITE_SUPABASE_URL="https://TU_PROJECT_ID_DEV.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="TU_ANON_KEY_DEV"
VITE_ALLOW_PROD_BACKEND_ON_LOCAL="false"
```

3. Arranca la app:

```sh
npm run dev
```

4. Antes de subir cambios o generar build, pasa la verificación completa:

```sh
npm run check
```

`npm run build` ya ejecuta esta validación automáticamente mediante `prebuild`.

## Comandos útiles

```sh
npm run dev
npm run build
npm run check
npm run typecheck
npm run test
npm run lint
```

## Notas operativas

- No mezclar pruebas locales con un backend distinto del enlazado en `supabase/config.toml`.
- No mantener dos proyectos activos del mismo CRM sin una razon tecnica fuerte y una convencion de nombres clara.
- Antes de borrar un proyecto Supabase alternativo, compara funciones, secrets, cron y datos reales y confirma que el repo ya no apunta a el.
- Las Edge Functions públicas y los webhooks deben revisarse siempre antes de desplegar cambios.
- Google Auth debe configurarse por entorno en Supabase y Google Cloud.
- Recomendación de GitHub: proteger `main` y exigir el workflow `Check` antes de mergear.
