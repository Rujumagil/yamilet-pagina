-- Yamilet Academy P1.5 · Tipos de archivo permitidos para recursos privados
-- Se mantiene el bucket privado y el límite existente de 50 MB.

update storage.buckets
set allowed_mime_types = array[
  'text/html',
  'application/pdf',
  'application/epub+zip',
  'application/zip',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'digital-products';
