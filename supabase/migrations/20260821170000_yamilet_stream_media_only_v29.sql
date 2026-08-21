-- Academia Yamilet v29
-- Cloudflare Stream se usa únicamente como biblioteca/reproductor de video.
-- La Academia continúa publicada en GitHub Pages y Supabase conserva Auth/datos/progreso.

alter table public.lessons
  alter column stream_require_signed_urls set default false;
