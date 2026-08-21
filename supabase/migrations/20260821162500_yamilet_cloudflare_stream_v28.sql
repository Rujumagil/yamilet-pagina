-- Academia Yamilet v28 · Cloudflare Stream
-- Conserva video_url como fallback y agrega el identificador nativo de Stream.

alter table public.lessons
  add column if not exists stream_video_uid text,
  add column if not exists stream_require_signed_urls boolean not null default true;

comment on column public.lessons.stream_video_uid is
  'Cloudflare Stream video UID. El reproductor privado solicita un token firmado antes de reproducir.';

comment on column public.lessons.stream_require_signed_urls is
  'Indica que el video debe servirse mediante token firmado. Para Academia Yamilet se mantiene true por defecto.';

create index if not exists lessons_stream_video_uid_idx
  on public.lessons(stream_video_uid)
  where stream_video_uid is not null;
