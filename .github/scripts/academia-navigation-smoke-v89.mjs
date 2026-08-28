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

const publicRoutes = {
  home: 'home',
  courses: 'courses',
  resources: 'library',
  agenda: 'calendar',
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

assert(index.includes('name="academy-build" content="v89-hardening"'), 'v89 build marker is missing');
assert(!index.includes('academy-sales-admin.js'), 'Retired sales runtime is still loaded');
assert(!index.includes('academy-assessment-review.js'), 'Retired assessment review runtime is still loaded');
assert(!index.includes('tus-js-client@'), 'TUS must not load globally for students');
assert(!index.includes('academy-video-admin-v62.js'), 'Video admin must not load globally for students');
assert(!index.includes('academy-video-cloudflare-manual-v64.js'), 'Cloudflare admin helper must not load globally for students');
assert(index.includes('academy-content-runtime-v80.js'), 'Lazy content runtime loader is missing');

console.log(`Navigation smoke v89 passed: ${Object.keys(publicRoutes).length} public routes, ${adminSections.length} admin sections, deep course/lesson fallbacks and role guards verified.`);
