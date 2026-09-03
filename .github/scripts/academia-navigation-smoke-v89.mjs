import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const base = path.join(root, 'yamilet-perez-site-v2-verde-github', 'academia');
const read = name => fs.readFileSync(path.join(base, name), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const router = read('academy-hash-router-v70.js');
const admin = read('academy-admin.js');
const index = read('index.html');
const manifest = read('manifest.webmanifest');
const sw = read('sw.js');
const dashboard = read('academy-dashboard.js');
const visuals = read('academy-visuals-v91.css');
const legacyAdmin = read(path.join('admin', 'index.html'));

const publicRoutes = {
  home: 'home',
  courses: 'courses',
  resources: 'library',
  library: 'library',
  agenda: 'calendar',
  calendar: 'calendar',
  certificates: 'certificates',
  evaluations: 'evaluations',
  help: 'help',
  profile: 'profile',
  catalog: 'explore',
  admin: 'admin'
};

for (const [publicRoute, internalRoute] of Object.entries(publicRoutes)) {
  const pattern = new RegExp(`\\b${publicRoute}:\\s*['\"]${internalRoute}['\"]`);
  assert(pattern.test(router), `Missing public hash route #${publicRoute} -> ${internalRoute}`);
}

assert(router.includes("library: 'library'"), 'Canonical #library route is missing');
assert(router.includes("calendar: 'calendar'"), 'Canonical #calendar route is missing');
assert(router.includes("resources: 'library'"), 'Legacy #resources alias is missing');
assert(router.includes("agenda: 'calendar'"), 'Legacy #agenda alias is missing');
assert(router.includes("if (page === 'course')"), 'Deep course route is missing');
assert(router.includes("if (page === 'lesson')"), 'Deep lesson route is missing');
assert(router.includes("setHash('courses', { replace: true })"), 'Invalid deep-route fallback to courses is missing');

const adminSections = ['overview','courses','content','students','agenda','evaluations','certificates','support','operations','settings'];
for (const section of adminSections) {
  assert(admin.includes(`'${section}'`), `Missing admin route #admin/${section}`);
}

assert(admin.includes("id === 'operations' && currentRole === 'instructor'"), 'Instructor operations navigation guard is missing');
assert(admin.includes("section === 'operations' && ctx.role === 'instructor'"), 'Instructor direct operations route guard is missing');
assert(admin.includes("go('overview')"), 'Restricted admin route redirect is missing');

assert(index.includes('name="academy-build" content="v109-admin-routing"'), 'v109 build marker is missing');
assert(index.includes('manifest.webmanifest?v=108'), 'manifest cache-bust is missing');
assert(index.includes('academy-visuals-v91.css?v=108'), 'visual stylesheet cache-bust is missing');
assert(index.includes('academy-dashboard.js?v=108'), 'dashboard runtime cache-bust is missing');
assert(index.includes('academy-pwa-v57.js?v=109'), 'v109 PWA runtime cache-bust is missing');
assert(index.includes('academy-hash-router-v70.js?v=108'), 'router cache-bust is missing');
assert(!index.includes('academy-sales-admin.js'), 'Retired sales runtime is still loaded');
assert(!index.includes('academy-assessment-review.js'), 'Retired assessment review runtime is still loaded');
assert(!index.includes('tus-js-client@'), 'TUS must not load globally for students');
assert(!index.includes('academy-video-admin-v62.js'), 'Video admin must not load globally for students');
assert(!index.includes('academy-video-cloudflare-manual-v64.js'), 'Cloudflare admin helper must not load globally for students');
assert(index.includes('academy-content-runtime-v80.js'), 'Lazy content runtime loader is missing');

assert(manifest.includes('../imagenes-academia-yamilet-final/04-favicon.png'), 'PWA icon path must resolve from /academia');
assert(!manifest.includes('../../imagenes-academia-yamilet-final'), 'Manifest still contains an obsolete visual path');
assert(sw.includes('`${CACHE_PREFIX}v108`'), 'Service Worker cache baseline is not v108');
assert(sw.includes('academy-mobile-admin-certificates-support-v107.css?v=107'), 'Service Worker is missing current v107 visual assets');
assert(!dashboard.includes('../../imagenes-academia-yamilet-final'), 'Dashboard still contains obsolete visual paths');
assert(!visuals.includes('../../imagenes-academia-yamilet-final'), 'Visual stylesheet still contains obsolete visual paths');
assert(legacyAdmin.includes("target.hash = '#admin'"), 'Legacy admin route does not redirect to the official panel');
assert(!legacyAdmin.includes('admin-v34.js'), 'Legacy admin runtime is still active');

console.log(`Navigation smoke v109 passed: ${Object.keys(publicRoutes).length} public routes/aliases, ${adminSections.length} admin sections, deep routes, PWA baseline, legacy admin redirect, role guards and visual paths verified.`);
