/**
 * MERIT FEST — SPA router
 * Each page module exports `render(el, params)` and may return a cleanup fn.
 */
import { $$ } from './ui.js';
import './firebase.js';
import { recordVisit } from './store.js';

recordVisit();

const routes = {
  home: () => import('./pages/home.js'),
  checkin: () => import('./pages/checkin.js'),
  register: () => import('./pages/checkin.js'),
  ticket: () => import('./pages/checkin.js'),
  map: () => import('./pages/map.js'),
  polaroid: () => import('./pages/polaroid.js'),
  staff: () => import('./pages/staff.js'),
  schedule: () => import('./pages/schedule.js'),
  gift: () => import('./pages/soon.js').then(m => ({ render: (el) => m.render(el, 'gift') })),
  admin: () => import('./pages/staff.js'),
};

const app = document.getElementById('app');
let cleanup = null;
let navToken = 0;

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const name = path.split('/')[0] || 'home';
  return { name: routes[name] ? name : 'home', params: Object.fromEntries(new URLSearchParams(query)) };
}

async function navigate() {
  const my = ++navToken;
  const { name, params } = parseHash();
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.warn(e); } }
  cleanup = null;

  const routeKey = (name === 'register' || name === 'ticket') ? 'checkin' : name;
  $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === routeKey));
  document.body.dataset.route = routeKey;
  document.getElementById('main-nav')?.classList.remove('open');

  try {
    const mod = await routes[name]();
    if (my !== navToken) return;
    app.innerHTML = '';
    cleanup = await mod.render(app, params);
    window.scrollTo({ top: 0, behavior: 'instant' });
    app.focus({ preventScroll: true });
  } catch (err) {
    console.error(err);
    app.innerHTML = `<section class="page container"><div class="card"><h2>เกิดข้อผิดพลาด</h2><p>${err.message}</p></div></section>`;
  }
}

document.getElementById('menu-toggle')?.addEventListener('click', () =>
  document.getElementById('main-nav').classList.toggle('open'));

window.addEventListener('hashchange', navigate);
navigate();
