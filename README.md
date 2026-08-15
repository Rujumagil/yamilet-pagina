# Yamilet Pérez — Sitio bilingüe ES/IT · V2 Verde

Base estática lista para GitHub, Cloudflare Pages, GitHub Pages, Netlify o Vercel.

## Estructura
- `/index.html`: detecta automáticamente el idioma guardado o el idioma del navegador.
- `/es/`: versión española.
- `/it/`: versión italiana.
- `styles.css`: diseño responsive.
- `app.js`: navegación móvil, preferencia de idioma y placeholder del newsletter.
- `robots.txt` y `sitemap.xml`: base SEO.
- Páginas legales en ambos idiomas como borradores estructurales.

## Traducción
No usa Google Translate ni API externa. La web mantiene dos versiones editoriales reales en español e italiano. El selector ES/IT guarda la preferencia en el navegador.

Esto mejora control de calidad, velocidad, privacidad y SEO. Si más adelante se agrega un CMS, se recomienda mantener esta misma arquitectura de URLs.

## Imágenes
Todos los espacios visuales están intencionalmente vacíos y marcados como `imagen pendiente`. Reemplazar cada `.placeholder`, `.cover` o `.thumb` por la imagen oficial cuando esté disponible.

## Antes de publicar
1. Reemplazar imágenes.
2. Sustituir enlaces de CTA por URLs reales de clase/cursos/contacto.
3. Conectar newsletter/CRM.
4. Completar datos legales y validar privacidad/cookies.
5. Confirmar títulos y portadas de libros.
6. Configurar dominio `yamiletperez.com`.


## Cambios V2
- Identidad visual principal migrada a verde bosque / verde salvia.
- Fondo crema y detalles dorados suaves.
- Sección de libros ampliada para mostrar portadas completas.
- Portadas con mayor altura y mejor presencia visual en desktop y móvil.
- Conserva selector ES/IT y detección automática de idioma.
