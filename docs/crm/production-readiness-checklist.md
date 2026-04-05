# Production Readiness Checklist

Fecha: 2026-03-18

## Objetivo

Cerrar la salida a produccion del CRM con una lista breve, accionable y ligada al estado real del proyecto.

La PWA queda explicitamente fuera de esta fase.

## Estado General

El CRM esta muy avanzado y el nucleo operativo ya funciona:

- contactos migrados
- taxonomia de contactos saneada
- portales principales funcionando
- Legado Coleccion colgado del CRM actual
- catalogo y media desenganchados del CRM viejo

Lo que falta antes de considerar la salida a produccion como cerrada no es producto nuevo, sino cierre operativo y verificacion final.

## Checklist

### 1. CRM viejo

- [x] contactos legacy importados al proyecto actual
- [x] taxonomia conflictiva (`comprador_cerrado`, `vendedor_cerrado`, `statefox`) normalizada
- [x] catalogo actual sin dependencia viva del storage del CRM viejo
- [x] verificar y conservar las 12 propiedades legacy sensibles con su estado real
- [x] retirar la ultima dependencia operativa de importacion al CRM viejo
- [ ] confirmar si queda alguna relacion historica imprescindible antes de apagar el CRM viejo
- [ ] decidir fecha de cierre del CRM viejo

### 2. Datos

- [x] etiquetas legacy conservadas en contactos
- [x] `contact_type`, `status` y `pipeline_stage` importados
- [x] reglas de importacion preparadas para no reintroducir taxonomia sucia
- [ ] revisar duplicados comerciales de alto impacto
- [ ] revisar si hace falta remapear `agent_id` historico en una segunda fase

### 3. Portales

- [x] `Fotocasa` operativa con API valida
- [x] `Pisos.com`, `TodoPisos` y `1001 Portales` regenerando feed desde el CRM actual
- [x] mensajes de UI mas honestos sobre estado real de publicacion
- [ ] prueba funcional final con varias referencias reales en cada portal
- [ ] verificar ultima pasada de cartera completa en `Fotocasa`

### 4. Webs y satelites

- [x] `Legado Coleccion` conectado al CRM actual
- [x] leads publicos entrando por `public-lead`
- [x] tracking web apuntando al proyecto actual
- [ ] prueba real desde web publica:
  - listado
  - ficha
  - lead desde ficha
  - lead general
  - visualizacion en admin

### 5. Entorno y despliegue

- [x] funciones criticas desplegadas en `edeprsrdumcnhixijlfu`
- [x] `.env` local alineado con el proyecto actual
- [ ] revisar secrets de produccion y documentar los imprescindibles
- [ ] confirmar que no queda ningun job o integracion apuntando al CRM viejo

### 6. Operativa real

- [ ] prueba completa de punta a punta con uso diario:
  - crear contacto
  - editar contacto
  - abrir ficha de inmueble
  - publicar en portales
  - recibir lead
  - trabajar lead desde admin
- [ ] validacion con al menos un admin y un comercial
- [ ] anotar fricciones reales antes de dar el salto definitivo

### 7. Seguridad y rollback

- [ ] export final de seguridad de contactos
- [ ] export final de seguridad de propiedades
- [ ] definir punto de rollback si aparece una incidencia en los primeros dias

## Prioridad Real

Orden recomendado para cerrar la salida a produccion:

1. verificar propiedades legacy sensibles
2. hacer prueba funcional real de punta a punta
3. validar web publica y leads
4. revisar entorno/secrets
5. preparar backup final
6. apagar CRM viejo

## Queda Explicitamente Para Despues

- PWA
- mejoras cosmeticas
- nuevas cohortes editoriales
- nuevas capas de automatizacion comercial no criticas

## Criterio De Cierre

Se puede considerar "listo para produccion" cuando:

- no quede dependencia viva del CRM viejo
- los flujos operativos principales funcionen de punta a punta
- los portales esten verificados con datos reales
- las webs satelite entren y salgan del CRM correctamente
- exista backup y plan de rollback
