# Supabase · Academia MES / Yamilet

Este directorio contiene plantillas de integración. No modifica producción por sí solo.

## Estructura
- `functions/capture-yamilet-lead/`: endpoint público para leads de la landing.
- `sql/provision-yamilet-workspace.sql`: plantilla de provisión del workspace al momento de entrega.

## Decisión de arquitectura
Se reutiliza la arquitectura multi-workspace existente de Aula Compás. Yamilet debe tener un `workspace_id` propio y todos los cursos, productos y contactos deben quedar asociados a ese workspace cuando la tabla correspondiente lo soporte.

## Variables de servidor requeridas al desplegar la función
Configurar en el entorno de Supabase, no en archivos públicos:
- URL del proyecto Supabase.
- clave de servicio del proyecto.
- UUID del workspace Yamilet.
- lista de orígenes permitidos.
- secreto anti-bot, si se activa.
- endpoint y credencial de Compás One, solo si se habilita esa sincronización.

## Entrega
Antes de habilitar la landing contra producción ejecutar la lista de aceptación documentada en `/SUPABASE-HANDOFF.md` y revisar los Advisors de seguridad y rendimiento de Supabase.
