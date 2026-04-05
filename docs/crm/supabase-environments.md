# Supabase Environment Policy

Estado decidido para este repo:

- Proyecto canonico: `edeprsrdumcnhixijlfu`
- Estado operativo: unico backend valido para este repo mientras no se haga una migracion completa y explicita

## Fuente de verdad

Los tres sitios siguientes deben apuntar siempre al mismo proyecto:

1. [`.env.local`](/C:/Users/Pedro%20Torres/OneDrive/Escritorio/legado%20crm/legadocrm-main/.env.local)
2. [`.env`](/C:/Users/Pedro%20Torres/OneDrive/Escritorio/legado%20crm/legadocrm-main/.env)
3. [`supabase/config.toml`](/C:/Users/Pedro%20Torres/OneDrive/Escritorio/legado%20crm/legadocrm-main/supabase/config.toml)

## Regla operativa

No trabajar con dos proyectos activos del mismo CRM a la vez.

Si existe otro proyecto parecido en Supabase:

- se considera legado o sandbox
- no se usa desde este repo
- no se despliega desde este repo
- no se valida la app contra el

## Antes de borrar el proyecto alternativo

1. Confirmar que el repo sigue apuntando a `edeprsrdumcnhixijlfu`.
2. Confirmar que las funciones y secrets utiles ya existen en el proyecto canonico.
3. Renombrar el proyecto alternativo para que no parezca principal.
4. Solo despues archivarlo o borrarlo.

## Criterio de migracion

Si algun dia quieres cambiar el proyecto canonico, no basta con cambiar un nombre en Supabase.
Hay que mover juntos:

- `.env.local`
- `.env`
- `supabase/config.toml`
- deploys de functions
- secrets
- cron jobs
- validacion funcional real
