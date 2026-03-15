-- Normalize values to lowercase
UPDATE public.contacts SET pipeline_stage = LOWER(TRIM(pipeline_stage)) WHERE pipeline_stage IS NOT NULL;

-- Map unknown values to 'nuevo'
UPDATE public.contacts SET pipeline_stage = 'nuevo' 
WHERE pipeline_stage IS NULL 
   OR pipeline_stage = '' 
   OR pipeline_stage NOT IN (
     'nuevo','contactado','en_seguimiento','cualificado','visitando',
     'visita_tasacion','visita_programada','mandato_firmado','mandato',
     'reunion','prospecto','activo','oferta','negociacion','reserva',
     'escritura','entregado','en_venta','en_cierre','cerrado',
     'sin_interes','clasificado','inactivo'
   );