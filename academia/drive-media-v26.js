(() => {
  const lessonHost = document.querySelector('[data-lesson-detail]');
  const adminRoot = document.querySelector('[data-content-admin-root]');

  function driveFileId(value = '') {
    try {
      const url = new URL(String(value), window.location.href);
      if (!/(^|\.)drive\.google\.com$/i.test(url.hostname)) return '';
      const filePath = url.pathname.match(/\/file\/d\/([^/]+)/i);
      if (filePath?.[1]) return filePath[1];
      return url.searchParams.get('id') || '';
    } catch {
      return '';
    }
  }

  function previewUrl(id) {
    return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
  }

  function enhanceLessonDriveVideo() {
    if (!lessonHost || lessonHost.closest('.hidden')) return;
    lessonHost.querySelectorAll('a[href*="drive.google.com"]').forEach((link) => {
      if (link.dataset.driveEnhanced === 'true') return;
      const id = driveFileId(link.href);
      if (!id) return;

      const shell = document.createElement('div');
      shell.className = 'video-shell drive-video-shell';
      shell.dataset.driveMediaId = id;
      shell.innerHTML = `<iframe src="${previewUrl(id)}" title="Video de la lección en Google Drive" loading="lazy" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      link.dataset.driveEnhanced = 'true';
      link.replaceWith(shell);
    });
  }

  function enhanceAdminHelp() {
    if (!adminRoot) return;
    const input = adminRoot.querySelector('input[name="video_url"]');
    if (!input || input.dataset.driveHelp === 'true') return;
    input.dataset.driveHelp = 'true';
    input.placeholder = 'YouTube, Vimeo o enlace externo heredado';

    const note = document.createElement('span');
    note.className = 'upload-note';
    note.textContent = 'Campo heredado. Para los nuevos videos de Método MES utiliza Cloudflare Stream en el bloque Video privado · Cloudflare Stream.';
    input.insertAdjacentElement('afterend', note);
  }

  function enhance() {
    enhanceLessonDriveVideo();
    enhanceAdminHelp();
  }

  function loadV28Script(src) {
    if (document.querySelector(`script[src*="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = `./${src}?v=28`;
    script.defer = true;
    document.head.appendChild(script);
  }

  const observer = new MutationObserver(() => window.requestAnimationFrame(enhance));
  if (lessonHost) observer.observe(lessonHost, { childList: true, subtree: true });
  if (adminRoot) observer.observe(adminRoot, { childList: true, subtree: true });

  loadV28Script('cloudflare-stream-v28.js');
  loadV28Script('cloudflare-stream-admin-v28.js');
  window.addEventListener('load', enhance, { once: true });
})();
