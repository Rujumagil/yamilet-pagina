# Academia Yamilet v28 · Cloudflare

## Arquitectura objetivo

- GitHub: fuente de código y control de versiones.
- Cloudflare Workers + Static Assets: hosting de landing y Academia.
- Cloudflare Stream: videos de Método MES.
- Supabase: Auth, usuarios, cursos, módulos, lecciones, progreso, inscripciones y RLS.
- Google Drive: solo fallback temporal para material ya existente; no usar para nuevos videos.

## Motivo

La Academia necesita emitir tokens privados para videos de alumnas inscritas. El Worker valida la sesión de Supabase, verifica inscripción activa y únicamente entonces genera un token firmado de Cloudflare Stream.

## Worker

Nombre esperado en Cloudflare: `academia-yamilet`

Configuración: `wrangler.jsonc`

Assets publicados desde:

`./yamilet-perez-site-v2-verde-github`

Rutas Worker-first:

- `/api/health`
- `/api/stream-token?lesson_id=<uuid>`

## Variables y secretos que se deben configurar en Cloudflare

- `SUPABASE_URL` = URL del proyecto Supabase de Academia Yamilet.
- `SUPABASE_ANON_KEY` = anon key del mismo proyecto. Configurar como Secret para mantener la operación centralizada.
- `STREAM_CUSTOMER_CODE` = código `customer-...` de Cloudflare Stream, sin el prefijo `customer-`.

El binding `STREAM` está declarado en `wrangler.jsonc`.

## Seguridad de video

Para cada video de Stream:

1. Activar `Require Signed URLs`.
2. Vincular el UID en la lección (`lessons.stream_video_uid`).
3. No guardar tokens de reproducción en Supabase.
4. Los tokens se generan al vuelo desde `/api/stream-token`.
5. El endpoint requiere sesión válida y una inscripción `active` o `completed` para el curso.

## Flujo de publicación

1. Importar el repositorio `Rujumagil/yamilet-pagina` en Workers Builds.
2. Crear/importar un Worker llamado exactamente `academia-yamilet`.
3. Usar `main` como rama de producción cuando la v28 esté validada.
4. Configurar los secretos y habilitar Stream en la cuenta.
5. Hacer primero una prueba en `*.workers.dev`.
6. Probar login ES/IT, progreso y un video Stream privado.
7. Solo después cambiar el dominio o tráfico desde GitHub Pages.
8. Mantener GitHub Pages disponible durante la ventana inicial de rollback.

## Carga de videos

Fase 1: subir desde el dashboard de Cloudflare Stream y pegar el UID desde el Administrador de Contenido.

Fase 2: implementar Direct Creator Uploads para subir el archivo directamente desde la Academia. Para archivos mayores de 200 MB se deberá usar TUS/resumable upload.
