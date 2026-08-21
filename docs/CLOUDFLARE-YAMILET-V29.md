# Academia Yamilet v29 · Cloudflare Stream media-only

## Arquitectura vigente

- GitHub Pages: publica landing y Academia Yamilet.
- Supabase: Auth, cursos, módulos, lecciones, alumnas, inscripciones, progreso, ES/IT y permisos.
- Cloudflare Stream: únicamente almacena/procesa/reproduce videos.
- Google Drive: fallback heredado para enlaces existentes.

La URL `workers.dev` no forma parte del acceso de alumnas y no se requiere para reproducir los videos.

## Flujo de video

1. Entrar a Cloudflare → Media → Stream → Videos.
2. Subir el MP4.
3. Mantener `Require Signed URLs` desactivado en este modelo.
4. Recomendado: limitar `Allowed Origins` al dominio donde se publique la Academia.
5. Copiar el Video UID, URL del video o URL del iframe.
6. En Academia Yamilet → Contenido → editar lección → Video · Cloudflare Stream.
7. Pegar el UID/enlace y guardar.
8. La Academia guarda `lessons.stream_video_uid` en Supabase y reproduce con el Stream Player oficial.

## Customer subdomain

`customer-l4ebvl2tw1zhwagv.cloudflarestream.com`

## Protección práctica sin Worker

Mientras la Academia esté en GitHub Pages, puede configurarse `rujumagil.github.io` como Allowed Origin en cada video. Cuando se conecte el dominio personal, sustituir/agregar el dominio definitivo de Academia Yamilet.

## Estado de v28

La infraestructura Worker/Static Assets de v28 queda fuera del flujo vigente. Sus archivos se conservan únicamente como referencia/rollback técnico y no son cargados por `academia/index.html`.
