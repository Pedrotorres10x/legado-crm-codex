# Legado CRM

CRM operativo para la inmobiliaria Legado. El proyecto cubre gestión de contactos, propiedades, demandas, cruces, tareas, comunicaciones, importaciones, telefonía Twilio, firma digital y panel de administración.

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase (Auth, Postgres, Storage, Edge Functions)
- Twilio Voice
- Brevo / Green API / integraciones de portales

## Entornos

- Producción: proyecto Supabase real del CRM
- Desarrollo local: debe usar un proyecto Supabase de pruebas

El arranque local incluye un bloqueo de seguridad que evita abrir la app en `localhost` si el `.env` apunta al proyecto Supabase de producción.

## Desarrollo local

1. Instala dependencias:

```sh
npm install
```

2. Configura `.env.local` con un Supabase de pruebas:

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

## Comandos útiles

```sh
npm run dev
npm run build
npm run test
npm run lint
```

## Notas operativas

- No mezclar pruebas locales con el backend de producción.
- Las Edge Functions públicas y los webhooks deben revisarse siempre antes de desplegar cambios.
- Google Auth debe configurarse por entorno en Supabase y Google Cloud.
