/**
 * jsdom smoke test for the Infuse button injection.
 *
 * Reproduces the real app.trakt.tv markup (taken from the trakt-web sources)
 * and asserts the Infuse buttons land in the right places for the extension
 * content script and for the Tampermonkey userscript.
 *
 * Usage:
 *   npm install        # once, installs jsdom
 *   npm test           # runs both targets
 *   TARGET=userscript node tests/injection.test.js   # single target
 */
const { spawnSync } = require('child_process');

if (!process.env.TARGET) {
  let failed = false;
  for (const target of ['extension', 'userscript']) {
    const result = spawnSync(process.execPath, [__filename], {
      stdio: 'inherit',
      env: { ...process.env, TARGET: target }
    });
    if (result.status !== 0) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is required: run `npm install` first.');
  process.exit(2);
}

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TARGET = process.env.TARGET || 'extension';
const SOURCE = TARGET === 'userscript'
  ? path.join(ROOT, 'userscript/Trakt2Infuse.user.js')
  : path.join(ROOT, 'extension/content.js');
const CONTENT_JS = fs.readFileSync(SOURCE, 'utf8');

const PAGE_URL = 'https://app.trakt.tv/shows/silo?season=3&view=episode&episode=2';

function card({ href, footer = true, title = 'x', subtitle = '', summary = false, seasonItem = false }) {
  const cover = `
      <div class="trakt-card-cover">
        <div class="trakt-card-cover-badge"></div>
        <div class="trakt-card-cover-image"><img src="poster.jpg" /></div>
      </div>`;
  const footerHtml = footer
    ? `<div class="trakt-card-footer">
          <div class="trakt-card-footer-information">
            <p class="trakt-card-title">${title}</p>
            <p class="trakt-card-subtitle">${subtitle}</p>
          </div>
          <div class="trakt-card-footer-action"><button class="native-watched">✓</button></div>
        </div>`
    : '';
  const inner = summary
    ? `<a class="trakt-link" href="${href}">
         <div class="trakt-summary-poster">${cover}</div>
         <div class="trakt-summary-card-titles"><p class="trakt-card-title">${title}</p></div>
       </a>`
    : `<a class="trakt-link" href="${href}">${cover}</a>${footerHtml}`;

  return `
  <div class="${seasonItem ? 'trakt-season-item' : 'trakt-season-episode-item'}">
    <div class="trakt-card ${summary ? 'trakt-summary-card trakt-summary-card-minimal' : ''}">
      <div class="trakt-card-content">${inner}</div>
    </div>
  </div>`;
}

const html = `<!doctype html><html><head></head><body>
<main>
  <div class="trakt-summary-container">
    <div class="trakt-summary-content">
      <div class="trakt-summary-main-content"></div>
      <div class="trakt-summary-actions">
        <div class="trakt-summary-actions-bar">
          <trakt-track-action><button class="trakt-action-button native-watched">✓</button></trakt-track-action>
          <div class="trakt-popup-menu-button"><button>⋮</button></div>
        </div>
      </div>
    </div>
  </div>

  <!-- season row on the page -->
  ${card({ href: '/shows/silo?season=0', seasonItem: true, title: '特别篇', subtitle: '' })}
  ${card({ href: '/shows/silo?season=3', seasonItem: true, title: '第 3 季', subtitle: '' })}

  <!-- current season episode list -->
  ${card({ href: '/shows/silo?view=episode&season=3&episode=1', subtitle: '第 3 季 • 第 1 集' })}
  ${card({ href: '/shows/silo?view=episode&season=3&episode=2', subtitle: '第 3 季 • 第 2 集' })}
  ${card({ href: '/shows/silo?view=episode&season=3&episode=3', footer: false, subtitle: '第 3 季 • 第 3 集' })}

  <!-- a card whose show is not cached yet -->
  ${card({ href: '/shows/unknown-show?view=episode&season=1&episode=1', subtitle: '第 1 季 • 第 1 集' })}
  <!-- a calendar-style card linking to the episode and its show -->
  <div class="trakt-season-episode-item">
    <div class="trakt-card trakt-summary-card trakt-summary-card-minimal">
      <div class="trakt-card-content">
        <a class="trakt-link" href="/shows/silo?view=episode&season=2&episode=5">
          <div class="trakt-summary-poster">
            <div class="trakt-card-cover"><div class="trakt-card-cover-image"><img src="x.jpg" /></div></div>
          </div>
        </a>
        <div class="trakt-summary-card-titles">
          <a class="trakt-link" href="/shows/silo"><p class="trakt-card-title">Silo</p></a>
          <p class="trakt-card-subtitle">第 2 季 • 第 5 集</p>
        </div>
      </div>
    </div>
  </div>
</main>

<!-- seasons drawer, portaled to body -->
<div class="trakt-drawer" data-size="large">
  <div class="trakt-drawer-header">
    <div class="trakt-drawer-title-container"><div class="trakt-drawer-title"><h1>Silo</h1></div></div>
    <div class="trakt-drawer-actions"><button class="drawer-close">✕</button></div>
  </div>
  <div class="trakt-drawer-content">
    <div class="seasons-section">
      ${card({ href: '/shows/silo?season=1', seasonItem: true, title: '第 1 季' })}
      ${card({ href: '/shows/silo?season=2', seasonItem: true, title: '第 2 季' })}
    </div>
    <div class="season-episodes-tab">
      ${card({ href: '/shows/silo?view=episode&season=1&episode=1', summary: true, title: '第 1 集', subtitle: '第 1 季 • 第 1 集' })}
      ${card({ href: '/shows/silo?view=episode&season=1&episode=2', summary: true, title: '第 2 集', subtitle: '第 1 季 • 第 2 集' })}
    </div>
  </div>
</div>

<!-- episode drawer -->
<div class="trakt-drawer trakt-episode-drawer" data-size="large">
  <div class="trakt-drawer-header">
    <div class="trakt-drawer-title-container"><div class="trakt-drawer-title"><h1>Silo</h1>
      <p class="episode-title-meta-info">第 3 季 • 第 2 集 - 标题</p></div></div>
    <div class="trakt-drawer-actions"><button class="drawer-close">✕</button></div>
  </div>
  <div class="trakt-drawer-content">
    <div class="episode-info-actions">
      <div class="episode-info-actions-content">
        <div class="trakt-summary-actions-bar">
          <trakt-track-action><button class="trakt-action-button native-watched">✓</button></trakt-track-action>
          <div class="trakt-popup-menu-button"><button>⋮</button></div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;

const dom = new JSDOM(html, {
  url: PAGE_URL,
  runScripts: 'outside-only',
  pretendToBeVisual: true
});

const { window } = dom;

// --- environment shims -------------------------------------------------------
window.chrome = { runtime: { getURL: (p) => `chrome-extension://test/${p}` } };
window.GM_addStyle = () => {};

const showPayload = { slug: 'unknown-show', title: 'Unknown', ids: { trakt: 9, slug: 'unknown-show', tmdb: 777, imdb: 'tt777' } };
const fetchCalls = [];
window.fetch = async (url) => {
  fetchCalls.push(String(url));
  if (String(url).includes('unknown-show')) {
    return { ok: true, json: async () => showPayload };
  }
  return { ok: false, json: async () => ({}) };
};

window.localStorage.setItem(
  'trakt2infuse_media_cache',
  JSON.stringify({
    silo: { tmdb: 12345, imdb: 'tt123', slug: 'silo', type: 'show', title: 'Silo' }
  })
);

// --- run the content script --------------------------------------------------
window.eval(CONTENT_JS);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL: ' + message);
    process.exitCode = 1;
  } else {
    console.log('ok  - ' + message);
  }
}

(async () => {
  await wait(400);

  const doc = window.document;
  const href = (el) => el && el.getAttribute('href');

  // 1. hero bar button sits next to the native ✓
  const heroBar = doc.querySelector('.trakt-summary-container .trakt-summary-actions-bar');
  const heroBtn = heroBar.querySelector('.infuse-summary-btn');
  assert(!!heroBtn, 'hero: button injected');
  assert(heroBtn.previousElementSibling === null && heroBtn.nextElementSibling.tagName === 'TRAKT-TRACK-ACTION',
    'hero: button placed immediately before the ✓ track action');
  assert(href(heroBtn) === 'infuse://series/12345-3', `hero: season deep link (${href(heroBtn)})`);

  // 2. episode drawer button sits in the drawer action bar, not next to ✕
  const epDrawer = doc.querySelector('.trakt-episode-drawer');
  const drawerBar = epDrawer.querySelector('.trakt-summary-actions-bar');
  const drawerBtn = drawerBar.querySelector('.infuse-summary-btn');
  assert(!!drawerBtn, 'episode drawer: button injected into action bar');
  assert(href(drawerBtn) === 'infuse://series/12345-3-2', `episode drawer: episode deep link (${href(drawerBtn)})`);
  assert(drawerBtn.nextElementSibling.tagName === 'TRAKT-TRACK-ACTION', 'episode drawer: button is left of the ✓');
  assert(!epDrawer.querySelector('.trakt-drawer-actions .infuse-icon-injected'),
    'episode drawer: nothing injected next to the close ✕');
  assert(!doc.querySelector('.trakt-drawer').querySelector('.trakt-drawer-actions .infuse-icon-injected'),
    'seasons drawer: nothing injected next to the close ✕');

  // 3. season cards get a floating badge with the right season
  const seasonCards = doc.querySelectorAll('.trakt-season-item');
  assert(seasonCards.length === 4, `found ${seasonCards.length} season cards`);
  const seasonLinks = [...seasonCards].map((c) => href(c.querySelector('.infuse-poster-floating-btn')));
  assert(seasonLinks[0] === 'infuse://series/12345-0', `specials -> season 0 (${seasonLinks[0]})`);
  assert(seasonLinks[1] === 'infuse://series/12345-3', `current season 3 (${seasonLinks[1]})`);
  assert(seasonLinks[2] === 'infuse://series/12345-1', `drawer season 1 (${seasonLinks[2]})`);
  assert(seasonLinks[3] === 'infuse://series/12345-2', `drawer season 2 (${seasonLinks[3]})`);

  // 4. every episode card (page list + seasons drawer summary cards) has a badge
  const episodeItems = [...doc.querySelectorAll('.trakt-season-episode-item')];
  const episodeLinks = episodeItems.map((c) => href(c.querySelector('.infuse-poster-floating-btn')));
  assert(episodeLinks.length === 7, `found ${episodeLinks.length} episode items`);
  assert(episodeLinks[0] === 'infuse://series/12345-3-1', `episode 3x01 (${episodeLinks[0]})`);
  assert(episodeLinks[1] === 'infuse://series/12345-3-2', `episode 3x02 (${episodeLinks[1]})`);
  assert(episodeLinks[2] === 'infuse://series/12345-3-3', `episode 3x03 without footer action (${episodeLinks[2]})`);
  assert(episodeLinks[3] === 'infuse://series/777-1-1', `uncached show episode resolved via fallback (${episodeLinks[3]})`);
  assert(episodeLinks[4] === 'infuse://series/12345-2-5', `episode+show card keeps the episode (${episodeLinks[4]})`);
  assert(episodeLinks[5] === 'infuse://series/12345-1-1', `drawer episode 1x01 (${episodeLinks[5]})`);
  assert(episodeLinks[6] === 'infuse://series/12345-1-2', `drawer episode 1x02 (${episodeLinks[6]})`);

  // 4b. a card linking to both the episode and its show keeps the episode link
  const mixed = [...doc.querySelectorAll('.trakt-season-episode-item')]
    .find((c) => c.querySelectorAll('a[href*="/shows/silo"]').length === 2);
  assert(!!mixed, 'mixed episode+show card exists in fixture');
  assert(href(mixed.querySelector('.infuse-poster-floating-btn')) === 'infuse://series/12345-2-5',
    `episode link wins over the show link (${href(mixed.querySelector('.infuse-poster-floating-btn'))})`);

  // 5. native footer action is untouched
  const footers = [...doc.querySelectorAll('.trakt-card-footer-action')];
  assert(footers.length > 0, `found ${footers.length} native footer actions`);
  assert(footers.every((f) => f.children.length === 1 && f.querySelector('.native-watched')),
    'native "mark as watched" ✓ button preserved in every card footer');
  assert(!doc.querySelector('.infuse-icon-btn'), 'no legacy footer button class used');

  // 6. exactly one badge per card
  const cards = [...doc.querySelectorAll('.trakt-card')];
  assert(cards.every((c) => c.querySelectorAll('.infuse-icon-injected').length <= 1),
    'at most one injected button per card');
  assert(cards.filter((c) => c.querySelector('.infuse-poster-floating-btn')).length === 11,
    '11 cards received a poster badge');

  // 7. unknown show: no badge yet, fallback fetch issued
  const unknownCard = [...doc.querySelectorAll('.trakt-season-episode-item')].find((c) => c.textContent.includes('第 1 季 • 第 1 集') && c.querySelector('a[href*="unknown-show"]'));
  assert(!!unknownCard, 'unknown-show card exists in fixture');
  assert(fetchCalls.some((u) => u.includes('unknown-show')), `fallback fetch issued (${fetchCalls[0]})`);
  assert(!!unknownCard.querySelector('.infuse-poster-floating-btn'),
    'unknown show got its badge after the fallback lookup resolved');
  assert(href(unknownCard.querySelector('.infuse-poster-floating-btn')) === 'infuse://series/777-1-1',
    'unknown show deep link uses the fetched tmdb id');

  // 8. SvelteKit `__data.json` (devalue) payload is decoded
  const devalueData = [
    { show: 1 },
    { slug: 2, ids: 3 },
    'devalue-show',
    { tmdb: 555, slug: 4 },
    'devalue-show'
  ];
  window.dispatchEvent(new window.CustomEvent('Trakt2Infuse_Data', {
    detail: JSON.stringify({ type: 'data', nodes: [{ type: 'data', data: devalueData }] })
  }));
  const injected = window.document.createElement('div');
  injected.className = 'trakt-season-item';
  injected.innerHTML = card({ href: '/shows/devalue-show?season=2', seasonItem: true, title: '第 2 季' });
  doc.body.appendChild(injected);
  await wait(300);
  const devBtn = injected.querySelector('.infuse-poster-floating-btn');
  assert(!!devBtn && href(devBtn) === 'infuse://series/555-2',
    `devalue __data.json payload decoded (${devBtn && href(devBtn)})`);

  // 9. re-render resilience: wiping a card's content re-injects the badge
  const rerenderCard = episodeItems[1];
  const content = rerenderCard.querySelector('.trakt-card-content');
  const fresh = doc.createElement('div');
  fresh.className = 'trakt-card-content';
  fresh.innerHTML = content.innerHTML;
  content.replaceWith(fresh);
  await wait(300);
  assert(rerenderCard.querySelectorAll('.infuse-poster-floating-btn').length === 1,
    're-rendered card content gets the badge re-injected exactly once');

  // 10. the drawer button follows episode changes (same DOM node, new URL)
  window.history.replaceState({}, '', '/shows/silo?season=3&view=episode&episode=5');
  doc.body.appendChild(doc.createElement('div'));
  await wait(300);
  assert(href(drawerBar.querySelector('.infuse-summary-btn')) === 'infuse://series/12345-3-5',
    `drawer button follows the episode change (${href(drawerBar.querySelector('.infuse-summary-btn'))})`);
  assert(drawerBar.querySelectorAll('.infuse-summary-btn').length === 1,
    'drawer keeps exactly one button after the episode change');

  await wait(100);
  window.close();
  console.log(`[${TARGET}] ` + (process.exitCode === 1 ? 'RESULT: FAILURES' : 'RESULT: ALL PASS'));
  process.exit(process.exitCode === 1 ? 1 : 0);
})();
