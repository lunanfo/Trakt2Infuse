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
    for (const mode of ['app', 'tvtime', 'og']) {
      const result = spawnSync(process.execPath, [__filename], {
        stdio: 'inherit',
        env: {
          ...process.env,
          TARGET: target,
          ...(mode === 'tvtime' ? { TVTIME: '1' } : {}),
          ...(mode === 'og' ? { OG: '1' } : {})
        }
      });
      if (result.status !== 0) failed = true;
    }
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

const HOST = process.env.OG
  ? 'https://og.trakt.tv'
  : (process.env.TVTIME ? 'https://tvtime.trakt.tv' : 'https://app.trakt.tv');
const PAGE_URL = process.env.OG
  ? `${HOST}/dashboard`
  : (process.env.TVTIME
    ? `${HOST}/shows/silo`
    : `${HOST}/shows/silo?season=3&view=episode&episode=2`);

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

/**
 * Real og.trakt.tv ("Trakt OG Redux") markup: every media card owns a native
 * `.quick-icons` strip (✓ / list / … | ❤ rating). The poster is a plain image
 * link, and schedule cards / calendar week rows carry no strip at all.
 */
const OG_FIXTURE = `
<div class="poster-grid">
  <div>
    <div class="on-deck-card">
      <article class="poster-card framed with-icons">
        <div class="poster-wrapper">
          <a class="poster poster" href="/shows/black-doves/seasons/2/episodes/4" tabindex="-1" aria-hidden="true">
            <img class="image" src="https://media.trakt.tv/shows/204762/thumb/poster.webp" alt="" />
          </a>
        </div>
        <div class="quick-icons small">
          <div class="actions">
            <div class="tools">
              <div class="watch-control card small">
                <button type="button" class="watch-trigger" aria-label="Add to watched history">✓</button>
              </div>
              <div class="list-control card small">
                <button type="button" class="trigger" aria-label="Add to list">☰</button>
              </div>
            </div>
            <div class="more-group">
              <button type="button" class="action more" aria-label="More">⋯</button>
            </div>
          </div>
          <button type="button" class="rating-trigger card locked" aria-label="Rate Black Doves 2x04">
            <span class="percentage"><span class="heart">♥</span><span class="value">83%</span></span>
          </button>
        </div>
        <div class="titles detached-progress">
          <a class="titles-link" href="/shows/black-doves/seasons/2/episodes/4">
            <h3 data-trakt-og-key="episode:black-doves:2:4" data-trakt-og-original="2x04 The Opportunity to Become Savage">2x04 野性觉醒的机会</h3>
          </a>
          <div class="show-line">
            <a class="show-link" href="/shows/black-doves" data-trakt-og-key="show:black-doves">黑鸽</a>
          </div>
        </div>
      </article>
    </div>
  </div>

  <article class="poster-card framed with-icons">
    <div class="poster-wrapper">
      <a class="poster poster" href="/shows/black-doves">
        <img class="image" src="https://media.trakt.tv/shows/204762/thumb/poster.webp" alt="" />
      </a>
    </div>
    <div class="quick-icons small">
      <div class="actions">
        <button type="button" class="action watch-now" aria-label="Watch now">▶</button>
      </div>
      <button type="button" class="rating-trigger card locked" aria-label="Rate Black Doves">
        <span class="percentage"><span class="heart">♥</span><span class="value">78%</span></span>
      </button>
    </div>
    <div class="titles">
      <a class="titles-link" href="/shows/black-doves">
        <h3 data-trakt-og-key="show:black-doves">黑鸽</h3>
      </a>
    </div>
  </article>

  <article class="poster-card framed with-icons">
    <div class="poster-wrapper">
      <a class="poster poster" href="/movies/deadpool-2016">
        <img class="image" src="https://media.trakt.tv/movies/190430/thumb/poster.webp" alt="" />
      </a>
    </div>
    <div class="quick-icons small">
      <div class="actions"></div>
      <button type="button" class="rating-trigger card locked" aria-label="Rate Deadpool">
        <span class="percentage"><span class="heart">♥</span><span class="value">81%</span></span>
      </button>
    </div>
    <div class="titles">
      <a class="titles-link" href="/movies/deadpool-2016">
        <h3 data-trakt-og-key="movie:deadpool-2016">死侍</h3>
      </a>
    </div>
  </article>

  <article class="fanart-card framed with-icons">
    <div class="fanart fanart">
      <a class="image-link" href="/shows/black-doves/seasons/2/episodes/3">
        <img class="image" src="https://media.trakt.tv/episodes/14520576/thumb/screenshot.webp" alt="" />
      </a>
      <div class="titles">
        <a class="titles-link small-title" href="/shows/black-doves">Black Doves</a>
        <h3 data-trakt-og-key="episode:black-doves:2:3"><a href="/shows/black-doves/seasons/2/episodes/3">P 表示毒药</a></h3>
      </div>
    </div>
    <div class="quick-icons">
      <div class="actions">
        <button type="button" class="action watch-now" aria-label="Watch now">▶</button>
      </div>
      <button type="button" class="rating-trigger card" aria-label="Rate P Is for Poison">
        <span class="percentage"><span class="heart">♥</span><span class="value">81%</span></span>
      </button>
    </div>
  </article>
</div>

<article class="spotlight" aria-labelledby="spotlight-1">
  <div class="body">
    <h3 data-trakt-og-key="show:black-doves"><a href="/shows/black-doves">黑鸽</a><span class="year">2024</span></h3>
    <div class="actions">
      <button type="button" class="glass-action tinted">Add to Watchlist</button>
      <button type="button" class="glass-action">Watch now</button>
      <span class="rating"><button type="button" class="rating-trigger card locked">♥ 84%</button></span>
    </div>
  </div>
</article>

<section class="chart-hero">
  <div class="inner">
    <h2 data-trakt-og-key="show:black-doves"><a href="/shows/black-doves">黑鸽</a></h2>
    <div class="art">
      <div class="tools">
        <div class="quick-icons">
          <div class="actions"></div>
          <button type="button" class="rating-trigger card"><span class="heart">♥</span> 84%</button>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="hero discover-hero">
  <div class="inner">
    <h2 class="name" data-trakt-og-key="show:black-doves"><a href="/shows/black-doves">黑鸽</a></h2>
    <div class="actions">
      <a class="button primary" href="/shows/black-doves">More info</a>
      <a class="button secondary" href="https://www.youtube.com/watch?v=test">Trailer</a>
    </div>
  </div>
</section>

<section class="comments discover-comments">
  <article class="poster-card framed with-icons">
    <div class="poster-wrapper">
      <a class="poster poster" href="/shows/black-doves/seasons/2/episodes/7">
        <img class="image" src="https://media.trakt.tv/episodes/14520579/thumb/screenshot.webp" alt="" />
      </a>
    </div>
    <div class="quick-icons small">
      <div class="actions"></div>
      <button type="button" class="rating-trigger card locked">
        <span class="percentage"><span class="heart">♥</span><span class="value">80%</span></span>
      </button>
    </div>
    <div class="titles">
      <a class="titles-link" href="/shows/black-doves/seasons/2/episodes/7">
        <h3 data-trakt-og-key="episode:black-doves:2:7">2x07 评论中的海报卡</h3>
      </a>
    </div>
  </article>
</section>

<article class="card schedule-card">
  <img class="poster" src="https://media.trakt.tv/shows/204762/thumb/poster.webp" alt="" />
  <div class="text">
    <h4><a href="/shows/black-doves" data-trakt-og-key="show:black-doves">黑鸽</a></h4>
    <div class="episodes">
      <div class="line"><a href="/shows/black-doves/seasons/2/episodes/5"><b class="number">2x05</b> 下一步</a></div>
    </div>
    <span class="tags"><span class="card-tag primary">09:00</span></span>
    <button type="button" class="watch-now">Watch Now</button>
  </div>
</article>

<article class="poster-card framed with-icons" id="uncached-card">
  <div class="poster-wrapper">
    <a class="poster poster" href="/shows/severance">
      <img class="image" src="https://media.trakt.tv/shows/155534/thumb/poster.webp" alt="" />
    </a>
  </div>
  <div class="quick-icons small">
    <div class="actions"></div>
    <button type="button" class="rating-trigger card locked">
      <span class="percentage"><span class="heart">♥</span><span class="value">88%</span></span>
    </button>
  </div>
  <div class="titles"><h3 data-trakt-og-key="show:severance">人生切割术</h3></div>
</article>

<ul class="week">
  <li class="row">
    <img class="poster" src="https://media.trakt.tv/shows/204762/thumb/poster.webp" alt="" />
    <span class="text">
      <a class="show" href="/shows/black-doves" data-trakt-og-key="show:black-doves">黑鸽</a>
      <div class="line"><a href="/shows/black-doves/seasons/2/episodes/6"><b class="number">2x06</b> TBA</a></div>
      <span class="tags"><span class="card-tag primary">16:00</span></span>
    </span>
  </li>
</ul>
`;

const html = `<!doctype html><html><head></head><body>${process.env.OG ? OG_FIXTURE : ''}
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
  ${process.env.TVTIME ? '' : card({ href: '/shows/silo?season=0', seasonItem: true, title: '特别篇', subtitle: '' })}
  ${card({ href: '/shows/silo?season=3', seasonItem: true, title: '第 3 季', subtitle: '' })}

  <!-- current season episode list -->
  ${process.env.TVTIME ? '' : card({ href: '/shows/silo?view=episode&season=3&episode=1', subtitle: '第 3 季 • 第 1 集' })}
  ${process.env.TVTIME ? '' : card({ href: '/shows/silo?view=episode&season=3&episode=2', subtitle: '第 3 季 • 第 2 集' })}
  ${process.env.TVTIME ? '' : card({ href: '/shows/silo?view=episode&season=3&episode=3', footer: false, subtitle: '第 3 季 • 第 3 集' })}

  <!-- a card whose show is not cached yet -->
  ${process.env.TVTIME ? '' : card({ href: '/shows/unknown-show?view=episode&season=1&episode=1', subtitle: '第 1 季 • 第 1 集' })}
  ${process.env.TVTIME ? '' : `<div class="trakt-season-episode-item">
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
`}

  ${process.env.TVTIME ? '' : `<!-- releases/calendar WEEK view: CalendarPosterTile, not a .trakt-card -->
  <section class="trakt-calendar-week">
    <div class="week-days">
      <div class="week-day">
        <div class="week-day-items">
          <div class="trakt-calendar-poster-tile">
            <a class="trakt-link" href="/shows/silo?view=episode&season=3&episode=4">
              <div class="tile-poster" style="position:relative;overflow:hidden">
                <img class="tile-poster-image" src="week-ep.jpg" />
                <div class="tile-overlay"><span class="trakt-tag">19:00</span></div>
              </div>
              <span class="tile-title bold ellipsis">Silo</span>
              <span class="tile-subtitle secondary ellipsis"><bdi dir="ltr">第 3 季 • 第 4 集</bdi></span>
            </a>
          </div>
          <div class="trakt-calendar-poster-tile">
            <a class="trakt-link" href="/movies/some-movie">
              <div class="tile-poster" style="position:relative;overflow:hidden">
                <img class="tile-poster-image" src="week-movie.jpg" />
              </div>
              <span class="tile-title bold ellipsis">Some Movie</span>
              <span class="tile-subtitle secondary ellipsis">电影</span>
            </a>
          </div>
          <!-- a media link without a poster image must not get a badge -->
          <a class="trakt-link" href="/shows/silo">Silo</a>
          <!-- transient snackbar thumbnails are left alone -->
          <div class="trakt-snackbar">
            <a class="trakt-link" href="/shows/silo?view=episode&season=1&episode=9">
              <div class="toast-poster" style="position:relative;overflow:hidden">
                <img src="toast.jpg" />
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
`}
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
${process.env.TVTIME ? `<div class="summary-page">
  <div class="summary-content summary-split">
    <div class="summary-main">
      <div class="summary-header">
        <img class="summary-header-poster" src="poster.jpg" />
        <div class="summary-info">
          <h1 class="summary-title">Silo</h1>
          <div class="summary-meta"><span>Sci-Fi</span></div>
        </div>
      </div>
      <div class="summary-actions-row">
        <button type="button" class="watched-pill">✓ Watched</button>
        <button type="button" class="watchlist-btn">＋ Watchlist</button>
      </div>
    </div>
    <aside class="summary-aside">
      <img class="summary-aside-poster" src="aside.jpg" />
      <dl class="media-details"></dl>
    </aside>
  </div>
</div>
<div class="poster-grid" role="list">
  <div class="poster-card">
    <div class="poster-frame">
      <a href="/shows/silo"><img class="trakt-fly-to-tab" src="card-show.jpg" /></a>
      <button type="button" class="action-btn">＋</button>
    </div>
    <p class="poster-title">Silo</p>
  </div>
  <div class="poster-card">
    <div class="poster-frame">
      <a href="/movies/some-movie"><img class="trakt-fly-to-tab" src="card-movie.jpg" /></a>
      <button type="button" class="action-btn">＋</button>
    </div>
    <p class="poster-title">Some Movie</p>
  </div>
</div>` : ''}
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
const fetchOptions = [];
window.fetch = async (url, options) => {
  fetchCalls.push(String(url));
  fetchOptions.push({ url: String(url), options });
  if (String(url).includes('unknown-show')) {
    return { ok: true, json: async () => showPayload };
  }
  if (String(url).includes('severance')) {
    return { ok: true, json: async () => ({ ids: { trakt: 155534, slug: 'severance', tmdb: 95396, imdb: 'tt11280740' } }) };
  }
  return { ok: false, json: async () => ({}) };
};

window.localStorage.setItem(
  'trakt2infuse_media_cache',
  JSON.stringify({
    silo: { tmdb: 12345, imdb: 'tt123', slug: 'silo', type: 'show', title: 'Silo' },
    'some-movie': { tmdb: 4242, imdb: 'tt4242', slug: 'some-movie', type: 'movie', title: 'Some Movie' },
    // og.trakt.tv fixture titles
    'black-doves': { tmdb: 218313, imdb: 'tt2901718', slug: 'black-doves', type: 'show', title: 'Black Doves' },
    'deadpool-2016': { tmdb: 293660, imdb: 'tt1431045', slug: 'deadpool-2016', type: 'movie', title: 'Deadpool' }
  })
);
// Mirrors the real OG page. The authority contains colons, so taking the third
// segment of this key would incorrectly produce "//auth.trakt.tv".
window.localStorage.setItem(
  'oidc.user:https://auth.trakt.tv:trakt-web',
  JSON.stringify({ access_token: 'test-token-must-not-be-used-for-metadata' })
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

  if (process.env.OG) {
    // og.trakt.tv: the button lives in the card's own action strip and the
    // poster is never covered.
    const strips = [...doc.querySelectorAll('.quick-icons')];
    assert(strips.length === 7, `og: found ${strips.length} quick-icons strips`);

    const cardOf = (hrefSelector) => [...doc.querySelectorAll('.poster-card, .fanart-card')]
      .find((c) => c.querySelector(hrefSelector));

    const episodeCard = cardOf('a[href="/shows/black-doves/seasons/2/episodes/4"]');
    const episodeBtn = episodeCard && episodeCard.querySelector('.quick-icons .infuse-quick-btn');
    assert(!!episodeBtn, 'og: up-next card gets a glyph in the action strip');
    assert(episodeBtn && href(episodeBtn) === 'infuse://series/218313-2-4',
      `og: episode deep link from the structured key (${episodeBtn && href(episodeBtn)})`);
    assert(episodeBtn && episodeBtn.nextElementSibling &&
      episodeBtn.nextElementSibling.classList.contains('rating-trigger'),
      'og: glyph sits immediately left of the ❤️ rating');

    const showCard = cardOf('a[href="/shows/black-doves"]:not(.show-link)');
    const showBtn = showCard && showCard.querySelector('.infuse-quick-btn');
    assert(showBtn && href(showBtn) === 'infuse://series/218313',
      `og: show card deep link (${showBtn && href(showBtn)})`);

    const movieCard = cardOf('a[href="/movies/deadpool-2016"]');
    const movieBtn = movieCard && movieCard.querySelector('.infuse-quick-btn');
    assert(movieBtn && href(movieBtn) === 'infuse://movie/293660',
      `og: movie card deep link (${movieBtn && href(movieBtn)})`);

    const fanartCard = cardOf('.image-link');
    const fanartBtn = fanartCard && fanartCard.querySelector('.infuse-quick-btn');
    assert(fanartBtn && href(fanartBtn) === 'infuse://series/218313-2-3',
      `og: fanart card keeps episode specificity (${fanartBtn && href(fanartBtn)})`);

    const chartHeroBtn = doc.querySelector('.chart-hero .quick-icons .infuse-quick-btn');
    assert(chartHeroBtn && href(chartHeroBtn) === 'infuse://series/218313',
      `og: hero chart finds the title in a sibling wrapper (${chartHeroBtn && href(chartHeroBtn)})`);
    assert(!doc.querySelector('.chart-hero .infuse-glass-btn'),
      'og: chart hero does not get a duplicate action-row button');

    assert(!doc.querySelector('.infuse-poster-floating-btn'),
      'og: no badge is ever placed on a poster');
    assert(strips.every((s) => s.parentElement.querySelectorAll('.quick-icons .infuse-quick-btn').length <= 1),
      'og: at most one glyph per action strip');

    const heroRow = doc.querySelector('article.spotlight .actions');
    const heroBtn = heroRow && heroRow.querySelector('.infuse-glass-btn');
    assert(!!heroBtn, 'og: recommendation spotlight gets a hero button');
    assert(heroBtn && href(heroBtn) === 'infuse://series/218313',
      `og: spotlight deep link (${heroBtn && href(heroBtn)})`);
    assert(heroBtn && heroBtn.nextElementSibling && heroBtn.nextElementSibling.classList.contains('rating'),
      'og: spotlight button sits before the rating');

    const discoverHeroBtn = doc.querySelector('.discover-hero .actions .infuse-glass-btn');
    assert(discoverHeroBtn && href(discoverHeroBtn) === 'infuse://series/218313',
      `og: text-only discover hero gets an Infuse button (${discoverHeroBtn && href(discoverHeroBtn)})`);
    assert(discoverHeroBtn && discoverHeroBtn.previousElementSibling &&
      discoverHeroBtn.previousElementSibling.classList.contains('secondary'),
      'og: discover hero button follows its native text actions');

    const commentsBtn = doc.querySelector('.discover-comments .infuse-quick-btn');
    assert(commentsBtn && href(commentsBtn) === 'infuse://series/218313-2-7',
      `og: media card inside Discover's comments section is not skipped (${commentsBtn && href(commentsBtn)})`);

    const scheduleCard = doc.querySelector('article.schedule-card');
    const scheduleMini = scheduleCard && scheduleCard.querySelector('.tags .infuse-mini-btn');
    assert(!!scheduleMini, 'og: schedule card glyph appended to its tag row');
    assert(scheduleMini && href(scheduleMini) === 'infuse://series/218313-2-5',
      `og: schedule card deep link (${scheduleMini && href(scheduleMini)})`);
    const scheduleWatchNow = scheduleCard && scheduleCard.querySelector('.watch-now');
    const watchNowSibling = scheduleWatchNow && scheduleWatchNow.previousElementSibling;
    assert(scheduleWatchNow && !scheduleWatchNow.querySelector('.infuse-icon-injected') &&
      !(watchNowSibling && watchNowSibling.classList.contains('infuse-icon-injected')),
      'og: "Watch Now" CTA is left untouched');

    const weekRow = doc.querySelector('ul.week li.row');
    const weekMini = weekRow && weekRow.querySelector('.tags .infuse-mini-btn');
    assert(!!weekMini, 'og: calendar week row glyph appended to the tag row');
    assert(weekMini && href(weekMini) === 'infuse://series/218313-2-6',
      `og: week row deep link (${weekMini && href(weekMini)})`);
    assert(!weekRow.querySelector('.poster .infuse-icon-injected'),
      'og: week row poster stays clean');

    // Uncached title: the id must come from the API fallback, and the scheduler
    // must not re-fire it on every 2s injection pass.
    await wait(500);
    const uncachedBtn = doc.querySelector('#uncached-card .infuse-quick-btn');
    assert(!!uncachedBtn, 'og: uncached card resolves through the API fallback');
    assert(uncachedBtn && href(uncachedBtn) === 'infuse://series/95396',
      `og: uncached card deep link (${uncachedBtn && href(uncachedBtn)})`);
    const severanceCalls = fetchCalls.filter((u) => u.includes('severance'));
    assert(severanceCalls.length === 1,
      `og: one lookup per uncached title, no retry storm (${severanceCalls.length})`);
    assert(severanceCalls[0] && severanceCalls[0].includes('apiz.trakt.tv'),
      `og: apiz is tried first (${severanceCalls[0]})`);
    const severanceOptions = fetchOptions.find((call) => call.url.includes('severance'));
    const authHeaders = severanceOptions && severanceOptions.options && severanceOptions.options.headers;
    assert(authHeaders && /^[a-f0-9]{64}$/i.test(authHeaders['trakt-api-key'] || ''),
      'og: valid API key is used instead of the OIDC authority/client label');
    assert(authHeaders && !authHeaders.Authorization,
      'og: metadata lookup does not send the OIDC access token');

    await wait(100);
    window.close();
    console.log(`[${TARGET}:og] ` + (process.exitCode === 1 ? 'RESULT: FAILURES' : 'RESULT: ALL PASS'));
    process.exit(process.exitCode === 1 ? 1 : 0);
  }

  if (process.env.TVTIME) {
    // tvtime.trakt.tv: hero action row + poster-card badges
    const tvHeroBtn = doc.querySelector('.summary-actions-row .infuse-summary-btn');
    assert(!!tvHeroBtn, 'tvtime: hero button injected into the summary action row');
    assert(tvHeroBtn && tvHeroBtn.previousElementSibling === null,
      'tvtime: hero button is the first control in the row');
    assert(href(tvHeroBtn) === 'infuse://series/12345',
      `tvtime: show deep link (${tvHeroBtn && href(tvHeroBtn)})`);

    const tvCards = [...doc.querySelectorAll('.poster-card')];
    assert(tvCards.length === 2, `tvtime: found ${tvCards.length} poster cards`);
    const tvShowCard = tvCards.find((c) => c.querySelector('a[href="/shows/silo"]'));
    const tvMovieCard = tvCards.find((c) => c.querySelector('a[href="/movies/some-movie"]'));
    const tvShowBtn = tvShowCard && tvShowCard.querySelector('.infuse-poster-floating-btn');
    const tvMovieBtn = tvMovieCard && tvMovieCard.querySelector('.infuse-poster-floating-btn');
    assert(!!tvShowBtn && tvShowBtn.parentElement.classList.contains('poster-frame'),
      'tvtime: show badge anchored on the poster frame');
    assert(!!tvShowBtn && href(tvShowBtn) === 'infuse://series/12345',
      `tvtime: show card deep link (${tvShowBtn && href(tvShowBtn)})`);
    assert(!!tvMovieBtn && href(tvMovieBtn) === 'infuse://movie/4242',
      `tvtime: movie card deep link (${tvMovieBtn && href(tvMovieBtn)})`);
    assert(tvCards.every((c) => c.querySelectorAll('.infuse-icon-injected').length <= 1),
      'tvtime: at most one injected button per poster card');
    assert(!tvShowCard.querySelector('.action-btn .infuse-icon-injected') &&
      [...tvShowCard.querySelectorAll('.action-btn')].every((b) => b.children.length === 0),
      'tvtime: native watchlist/favorite action button untouched');

    await wait(100);
    window.close();
    console.log(`[${TARGET}:tvtime] ` + (process.exitCode === 1 ? 'RESULT: FAILURES' : 'RESULT: ALL PASS'));
    process.exit(process.exitCode === 1 ? 1 : 0);
  }

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

  // 4c. week view tiles (no .trakt-card) get a badge too
  const weekTiles = [...doc.querySelectorAll('.trakt-calendar-poster-tile')];
  assert(weekTiles.length === 2, `found ${weekTiles.length} week poster tiles`);
  const weekEpisodeBtn = weekTiles[0].querySelector('.infuse-poster-floating-btn');
  const weekMovieBtn = weekTiles[1].querySelector('.infuse-poster-floating-btn');
  assert(!!weekEpisodeBtn && href(weekEpisodeBtn) === 'infuse://series/12345-3-4',
    `week tile: episode deep link (${weekEpisodeBtn && href(weekEpisodeBtn)})`);
  assert(!!weekMovieBtn && href(weekMovieBtn) === 'infuse://movie/4242',
    `week tile: movie deep link (${weekMovieBtn && href(weekMovieBtn)})`);
  assert(weekEpisodeBtn && weekEpisodeBtn.parentElement.classList.contains('tile-poster'),
    'week tile: badge is placed on the poster, not the tile wrapper');
  const posterless = [...doc.querySelectorAll('.week-day-items > a.trakt-link')];
  assert(posterless.length === 1 && !posterless[0].querySelector('.infuse-icon-injected'),
    'media link without a poster image gets no badge');
  assert(!doc.querySelector('.trakt-snackbar .infuse-icon-injected'),
    'snackbar thumbnails are skipped');

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
