# Yamilet Pérez · Entrega Supabase

## Objetivo
Dejar `yamiletperez.com` como landing pública y `academia.yamiletperez.com` como acceso de Academia MES, utilizando Supabase sin mezclar datos con otros clientes.

## Arquitectura prevista

Landing Yamilet → Edge Function `capture-yamilet-lead` → workspace Yamilet en Aula Compás → contactos / alumnos / cursos / progreso.

Cuando corresponda, el mismo evento podrá reenviarse a Compás One desde servidor. La landing nunca debe contener claves privadas.

## Infraestructura compatible verificada
El proyecto Supabase `aula-compas` ya cuenta con tablas para:
- `workspaces` y `workspace_members`
- `profiles`
- `courses`, `modules`, `lessons`
- `enrollments`, `lesson_progress`
- `products`, `orders`, `student_access`
- `contacts` y canales/notas/etiquetas
- `academy_notifications`
- `academy_integration_events`

También existen políticas RLS para aislar workspaces, cursos, contactos y acceso de alumnos.

## Identidad prevista
- Workspace slug: `yamilet-mes`
- Landing: `https://www.yamiletperez.com`
- Academia: `https://academia.yamiletperez.com`
- Idiomas: `es` e `it`

## Estado de integración
La página funciona sin Supabase. `integration-config.js` mantiene las integraciones desactivadas hasta la entrega. Para activar:
1. Crear el workspace Yamilet en Supabase y asignar administradora.
2. Cargar cursos, productos y contenidos de Academia MES.
3. Desplegar la Edge Function pública con validación anti-bot y CORS.
4. Colocar la URL de la función en `leadCapture.endpoint` y cambiar `enabled` a `true`.
5. Cambiar `academy.enabled` a `true` cuando el subdominio esté operativo.
6. Configurar los secretos únicamente en Supabase/Vercel/Cloudflare, nunca en GitHub.
7. Probar ES e IT, alta de lead, autenticación, inscripción, progreso y separación por workspace.

## Contrato de lead
La landing enviará JSON con campos compatibles y no sensibles:
- `email` (obligatorio)
- `display_name` (opcional)
- `phone` (opcional)
- `locale`: `es` o `it`
- `source`: `yamilet-landing`
- `form_type`: por ejemplo `newsletter` o `free_class`
- `page_url`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `consent` booleano

La Edge Function resolverá el workspace del lado servidor y guardará el contacto bajo ese workspace.

## Seguridad
- Nunca usar `service_role` en navegador.
- El formulario público debe pasar por Edge Function.
- CORS restringido a dominios autorizados.
- Validación de email, tamaño de payload y anti-bot antes de insertar.
- RLS permanece habilitado para operaciones autenticadas.
- Integración con Compás One únicamente desde servidor usando secretos.

## Pruebas de aceptación para entrega
- Landing carga sin variables privadas.
- Botón Academia MES abre el subdominio correcto.
- Registro ES conserva `locale=es`; italiano conserva `locale=it`.
- Lead aparece solo en el workspace Yamilet.
- Una alumna solo ve sus cursos e inscripciones.
- Progreso de lecciones persiste correctamente.
- Compra/aprobación otorga `student_access` sin acceso cruzado.
- Notificaciones se asocian a la usuaria correcta.
- Ninguna clave privada aparece en HTML, JS público o historial Git.
