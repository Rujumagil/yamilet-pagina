# Academia Yamilet v28 · Cloudflare

## Arquitectura objetivo

- GitHub: fuente de código y control de versiones.
- Cloudflare Workers + Static Assets: hosting de landing y Academia.
- Cloudflare Stream: videos privados de Método MES.
- Supabase: Auth, usuarios, cursos, módulos, lecciones, progreso, inscripciones y RLS.
- Google Drive: solo fallback temporal para material ya existente; no usar para nuevos videos.

## Biblioteca Stream compartida

Por ahora Academia Yamilet utilizará la biblioteca de Cloudflare Stream ya activa en la cuenta actual. No se crea una cuenta de Stream separada.

Cada carga creada por el Worker se etiqueta con metadatos de aislamiento:

- `project = yamilet`
- `academy = yamilet`
- `workspace_slug = yamilet-mes`
- `course_id`
- `lesson_id`
- título de curso y lección
- nombre del archivo original

El nombre visible se genera como `YAMILET · <curso> · <lección>` para distinguirlo de ETERNI y otros proyectos.

## Motivo

La Academia necesita emitir tokens privados para videos de alumnas inscritas. El Worker valida la sesión de Supabase, limita las operaciones al workspace `yamilet-mes`, verifica inscripción activa o permisos de staff y únicamente entonces genera un token firmado de Cloudflare Stream.

## Worker

Nombre esperado en Cloudflare: `academia-yamilet`

Configuración: `wrangler.jsonc`

Assets publicados desde:

`./yamilet-perez-site-v2-verde-github`

Rutas Worker-first:

- `/api/health`
- `/api/stream-token?lesson_id=<uuid>`
- `/api/stream-upload`

## Variables y secretos que se deben configurar en Cloudflare

- `SUPABASE_URL` = URL del proyecto Supabase de Academia Yamilet.
- `SUPABASE_ANON_KEY` = anon key del mismo proyecto.
- `STREAM_CUSTOMER_CODE` = código del subdominio de Cloudflare Stream, sin `customer-` y sin `.cloudflarestream.com`.

El binding `STREAM` está declarado en `wrangler.jsonc`; no se necesita exponer un API Token de Cloudflare al navegador.

## Seguridad de video

Para cada video de Stream:

1. Se crea con `requireSignedURLs = true`.
2. El UID se vincula en `lessons.stream_video_uid`.
3. No se guardan tokens de reproducción en Supabase.
4. Los tokens se generan al vuelo desde `/api/stream-token`.
5. El endpoint requiere una sesión válida y una inscripción `active`/`completed`, o permisos administrativos para vista de staff.
6. El Worker rechaza cursos que no pertenezcan al workspace `yamilet-mes`.

## Carga directa desde Academia

La v28 ya soporta Direct Creator Uploads desde el administrador:

1. La administradora abre una lección existente.
2. Selecciona un video de hasta 200 MB.
3. La Academia solicita `/api/stream-upload` usando la sesión Supabase.
4. El Worker valida que la cuenta sea `owner`, `admin` o `instructor` del workspace.
5. Cloudflare genera una URL de carga de un solo uso mediante el binding `STREAM`.
6. El navegador envía el archivo directamente a Stream; el archivo no atraviesa Supabase ni el Worker.
7. Al finalizar, la Academia guarda automáticamente el UID en la lección.
8. Stream procesa el video y el reproductor privado queda disponible cuando termina la codificación.

Para archivos mayores de 200 MB se utilizará TUS/resumable upload en una fase posterior. Mientras tanto pueden subirse desde el dashboard de Stream y vincular el UID manualmente.

## Flujo de publicación

1. En Cloudflare crear/importar un Worker llamado exactamente `academia-yamilet`.
2. Conectar `Rujumagil/yamilet-pagina` mediante Workers Builds.
3. Para la primera validación usar la rama `feature/yamilet-cloudflare-stream-v28` como rama de producción temporal o habilitar builds de ramas no productivas.
4. El deploy command puede quedar en el valor predeterminado `npx wrangler deploy`.
5. Configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `STREAM_CUSTOMER_CODE` como variables runtime.
6. Confirmar que el binding `STREAM` esté activo.
7. Probar primero en `*.workers.dev`.
8. Validar `/api/health`, login ES/IT, carga de un video, reproducción privada y progreso.
9. Solo después fusionar PR #33 y cambiar el dominio o tráfico desde GitHub Pages.
10. Mantener GitHub Pages como rollback durante la transición inicial.
