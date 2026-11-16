/**
 * Trakt to Infuse - Content Script
 * Resolves TMDB / IMDb IDs and injects Infuse deep links on Trakt.tv,
 * app.trakt.tv, the new TV Time web app (tvtime.trakt.tv) and the classic
 * "Trakt OG Redux" theme (og.trakt.tv).
 *
 * Injection model:
 *  - Episode / season drawers: button lives in the drawer's own summary action
 *    bar, immediately left of the purple "mark as watched" ✓ button.
 *  - Media cards (shows, movies, seasons, episodes): floating badge on the
 *    top-left corner of the poster / episode still.
 *  - og.trakt.tv never covers artwork: the button is an extra glyph inside the
 *    card's native `.quick-icons` action strip, immediately left of the ❤️
 *    rating (see the og.trakt.tv section further down).
 *  - The native `.trakt-card-footer-action` (the ✓ button) is never modified.
 */

(function () {
  'use strict';

  const INFUSE_ICON_URL = chrome.runtime.getURL('icons/infuse-mark.png');
  const CACHE_KEY = 'trakt2infuse_media_cache';
  const DEFAULT_CLIENT_ID = '201dc70c5ec6af530f12f079ea1922733f6e1085ad7b02f36d8e011b75bcea7d';
  // The TV Time web app ships its own Trakt API key; without it the fallback
  // lookup below would hit api.trakt.tv with the wrong client id.
  const TVTIME_CLIENT_ID = 'ab84b6e356dcef9c0a32130b7043d1d33aa961b63df937dd6bdb8d211048ebc2';

  const SAVE_DEBOUNCE_MS = 1500;
  const RESCAN_INTERVAL_MS = 2000;
  const INJECT_DEBOUNCE_MS = 60;
  // Safety valve for very large API payloads (e.g. full history sync).
  const PAYLOAD_NODE_BUDGET = 200000;

  // In-memory cache: slug -> { tmdb, imdb, slug, type, title }
  let mediaCache = {};
  // slug -> timestamp of the in-flight fallback request
  const pendingFetches = new Map();
  // A real API key captured from the page's own Trakt requests. This stays in
  // memory only and is never written to the media cache or console.
  let capturedTraktApiKey = null;

  // Load persistent cache from localStorage
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      mediaCache = JSON.parse(saved) || {};
    }
  } catch (e) {}

  let saveTimer = null;
  function saveCache() {
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(mediaCache));
      } catch (e) {}
    }, SAVE_DEBOUNCE_MS);
  }

  function saveCacheNow() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(mediaCache));
    } catch (e) {}
  }

  window.addEventListener('pagehide', saveCacheNow);
  window.addEventListener('beforeunload', saveCacheNow);

  // Blacklisted subpaths (not movies or shows)
  const BLACKLISTED_SLUGS = new Set([
    'trending', 'popular', 'recommended', 'anticipated', 'collected', 'watched',
    'updates', 'boxoffice', 'new', 'premieres', 'calendar', 'people', 'actors',
    'search', 'genres', 'networks', 'years', 'lists', 'users', 'history', 'ratings',
    'settings', 'vip', 'home', 'discover', 'me'
  ]);

  // tvtime.trakt.tv is the new TV Time web app. It shares the Trakt design
  // tokens but uses a different markup (poster-card / summary-page).
  function isTvTimeHost() {
    return window.location.hostname === 'tvtime.trakt.tv';
  }

  function isTraktApiKey(value) {
    return typeof value === 'string' && /^[a-f0-9]{32,}$/i.test(value);
  }

  /**
   * Resolve the Trakt API key used for metadata lookups.
   *
   * OIDC storage keys have the form "oidc.user:<authority>:<client_id>".
   * The authority itself contains colons, so splitting on ":" and taking the
   * third segment used to produce values such as "//auth.trakt.tv". That made
   * every apiz.trakt.tv request return 403 on og.trakt.tv.
   */
  function getTraktAuth() {
    const fallback = isTvTimeHost() ? TVTIME_CLIENT_ID : DEFAULT_CLIENT_ID;
    if (capturedTraktApiKey) {
      return { clientId: capturedTraktApiKey };
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('oidc.user:')) {
          const lastColon = key.lastIndexOf(':');
          const storedClientId = lastColon >= 0 ? key.slice(lastColon + 1) : '';
          if (isTraktApiKey(storedClientId)) {
            return { clientId: storedClientId };
          }
        }
      }
    } catch (e) {}

    return { clientId: fallback };
  }

  function toInt(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function episodeKey(showSlug, season, episode) {
    return `${showSlug}-s${season}e${episode}`;
  }

  /**
   * Parse a media link into { kind, slug, season, episode }.
   * Supports both the modern query style (?season=3&episode=2&view=episode)
   * and the legacy path style (/shows/:slug/seasons/3/episodes/2).
   */
  function parseMediaRef(href) {
    if (!href) return null;

    let url;
    try {
      url = new URL(href, window.location.origin);
    } catch (e) {
      return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    const path = url.pathname;
    const match = path.match(/^\/(shows|movies)\/([^/]+)/);
    if (!match) return null;

    let slug = match[2];
    try {
      slug = decodeURIComponent(slug);
    } catch (e) {}
    if (!slug || BLACKLISTED_SLUGS.has(slug)) return null;

    let season = toInt(url.searchParams.get('season'));
    let episode = toInt(url.searchParams.get('episode'));

    const episodePath = path.match(/\/seasons\/(\d+)\/episodes\/(\d+)/);
    if (episodePath) {
      season = parseInt(episodePath[1], 10);
      episode = parseInt(episodePath[2], 10);
    } else {
      const seasonPath = path.match(/\/seasons\/(\d+)/);
      if (seasonPath && season === null) {
        season = parseInt(seasonPath[1], 10);
      }
    }

    return {
      kind: match[1] === 'shows' ? 'show' : 'movie',
      slug,
      season,
      episode
    };
  }

  /**
   * Extract "第 3 季 • 第 2 集" / "S03E02" / "Season 3 Episode 2" from text.
   */
  function parseSeasonEpisodeFromText(text) {
    if (!text) return { season: null, episode: null };

    let m = text.match(/第\s*(\d+)\s*季[^\d]{0,8}?第\s*(\d+)\s*集/);
    if (m) return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };

    m = text.match(/\bS(\d{1,3})\s*[·•.\-–—xX\s/]*E(\d{1,4})\b/i) ||
        text.match(/\b(\d{1,2})\s*x\s*(\d{1,4})\b/);
    if (m) return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };

    m = text.match(/(?:Season|Staffel|Saison|Temporada|Stagione|シーズン)\s*(\d{1,3})[^\d]{0,12}?(?:Episode|Folge|Épisode|Episodio|エピソード)\s*(\d{1,4})/i);
    if (m) return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };

    return { season: parseSeasonFromText(text), episode: null };
  }

  /**
   * Extract a season number from text. Specials resolve to season 0.
   */
  function parseSeasonFromText(text) {
    if (!text) return null;

    let m = text.match(/第\s*(\d+)\s*季/);
    if (m) return parseInt(m[1], 10);

    m = text.match(/\bS(\d{1,3})\b/);
    if (m && !/\bS\d{1,3}E\d{1,4}\b/i.test(text)) return parseInt(m[1], 10);

    m = text.match(/(?:Season|Staffel|Saison|Temporada|Stagione|シーズン)\s*(\d{1,3})\b/i);
    if (m) return parseInt(m[1], 10);

    if (/特别篇|特辑|特集|Specials?\b|Extras?\b/i.test(text)) return 0;

    return null;
  }

  function isDetailPage() {
    if (isTvTimeHost()) {
      return /^\/(shows|movies)\/[^/]+/.test(window.location.pathname);
    }
    const p = window.location.pathname;
    return /^\/(shows|movies)\/[^/]+(?:\/seasons\/\d+(?:\/episodes\/\d+)?)?\/?$/.test(p);
  }

  /**
   * Build Infuse deep link based on type, season, and episode
   * Formats:
   * - Episode: infuse://series/{show_id}-{season}-{episode}
   * - Season:  infuse://series/{show_id}-{season}
   * - Series:  infuse://series/{show_id}
   * - Movie:   infuse://movie/{movie_id}
   */
  function buildInfuseLink(info) {
    if (!info) return null;

    if (info.type === 'episode') {
      const showId = info.showTmdb || info.tmdb || info.showImdb || info.imdb;
      if (!showId) return null;
      const s = info.season !== null && info.season !== undefined ? info.season : 1;
      const e = info.episode !== null && info.episode !== undefined ? info.episode : 1;
      return `infuse://series/${showId}-${s}-${e}`;
    }

    if (info.type === 'season') {
      const showId = info.showTmdb || info.tmdb || info.showImdb || info.imdb;
      if (!showId) return null;
      const s = info.season !== null && info.season !== undefined ? info.season : 1;
      return `infuse://series/${showId}-${s}`;
    }

    if (info.type === 'show') {
      const showId = info.showTmdb || info.tmdb || info.showImdb || info.imdb;
      if (!showId) return null;
      return `infuse://series/${showId}`;
    }

    if (info.type === 'movie') {
      const movieId = info.tmdb || info.imdb;
      if (!movieId) return null;
      return `infuse://movie/${movieId}`;
    }

    return null;
  }

  function buildTooltip(info) {
    if (!info) return '在 Infuse 中播放';

    if (info.type === 'episode') {
      return `在 Infuse 中播放 (S${pad2(info.season)}E${pad2(info.episode)})`;
    }
    if (info.type === 'season') {
      return info.season === 0
        ? '在 Infuse 中播放 (特别篇)'
        : `在 Infuse 中播放 (第 ${info.season} 季)`;
    }
    if (info.type === 'show') {
      return '在 Infuse 中播放 (整部剧集)';
    }
    if (info.type === 'movie') {
      return '在 Infuse 中播放 (电影)';
    }
    return '在 Infuse 中播放';
  }

  /**
   * The native "mark as watched" control of the TV Time summary action row.
   */
  function findTvTimeTrackAction(container) {
    return container.querySelector('.watched-pill, .watched-btn');
  }

  /**
   * Inject the hero bar button on tvtime.trakt.tv. The summary action row is
   * rendered per media type, so accept both parents of the ✓ control.
   */
  function injectTvTimeDetailPageHeader(ctx) {
    if (!isTvTimeHost() || !isDetailPage()) return;

    // Single episode pages only render an "Add to history" button, so they
    // do not offer a native action row to sit next to.
    if (/\/seasons\/\d+\/episodes\/\d+/.test(window.location.pathname)) return;

    const info = resolveHeroInfo(ctx);
    if (!info) return;
    const deepLink = buildInfuseLink(info);
    if (!deepLink) return;

    const bars = document.querySelectorAll('.summary-actions-row, .summary-aside');
    for (const bar of bars) {
      if (bar.closest(SKIP_CONTAINER_SELECTOR)) continue;
      const isActionRow = bar.classList.contains('summary-actions-row');
      ensureButton(
        bar,
        findTvTimeTrackAction(bar),
        isActionRow ? 'infuse-summary-btn' : 'infuse-tvtime-aside-btn',
        deepLink,
        buildTooltip(info)
      );
      return;
    }
  }

  /**
   * Create the injected anchor button.
   */
  function createInfuseButton(deepLink, className, tooltipText) {
    const a = document.createElement('a');
    a.className = `${className} infuse-icon-injected`;
    a.href = deepLink;
    a.title = tooltipText || '在 Infuse 中播放';
    a.setAttribute('aria-label', tooltipText || '在 Infuse 中播放');
    a.dataset.infuseLink = deepLink;
    a.innerHTML = `<img src="${INFUSE_ICON_URL}" alt="Infuse" />`;

    // Keep the click away from the card link / drawer handlers underneath.
    a.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    a.addEventListener('mousedown', (e) => e.stopPropagation());
    a.addEventListener('mouseup', (e) => e.stopPropagation());
    a.addEventListener('mouseenter', (e) => e.stopPropagation());

    return a;
  }

  function updateInfuseButton(btn, deepLink, tooltipText) {
    if (btn.dataset.infuseLink === deepLink && btn.title === tooltipText) return false;
    btn.href = deepLink;
    btn.title = tooltipText;
    btn.setAttribute('aria-label', tooltipText);
    btn.dataset.infuseLink = deepLink;
    return true;
  }

  /**
   * Insert (or refresh) a button inside `container`, before `beforeNode`.
   */
  function ensureButton(container, beforeNode, className, deepLink, tooltipText) {
    const existing = container.querySelector(`.${className}.infuse-icon-injected`);
    if (existing) {
      updateInfuseButton(existing, deepLink, tooltipText);
      return existing;
    }

    const btn = createInfuseButton(deepLink, className, tooltipText);
    if (beforeNode && beforeNode.parentElement === container) {
      container.insertBefore(btn, beforeNode);
    } else {
      container.insertBefore(btn, container.firstChild);
    }
    return btn;
  }

  /**
   * The native purple "mark as watched" control of an action bar.
   */
  function findTrackAction(container) {
    return container.querySelector('trakt-track-action, .trakt-track-action, .trakt-mark-as-watched-button');
  }

  /**
   * Universal recursive parser for any Trakt API or SSR payload
   */
  function processTraktPayload(payload) {
    if (!payload) return;

    let count = 0;
    let budget = PAYLOAD_NODE_BUDGET;

    function store(entry) {
      if (!entry || !entry.slug) return;
      mediaCache[entry.slug] = entry;
      if (entry.trakt) mediaCache[`trakt-${entry.trakt}`] = entry;
    }

    function extractAndStore(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (budget-- <= 0) return;

      const tmdb = obj.tmdb || (obj.ids && obj.ids.tmdb);
      const imdb = obj.imdb || (obj.ids && obj.ids.imdb);
      const slug = obj.slug || (obj.ids && obj.ids.slug) || (obj.plex && obj.plex.slug);
      const trakt = obj.trakt || (obj.ids && obj.ids.trakt);
      const explicitType = obj.type ||
        (obj.seasons ? 'show' : (obj.aired_episodes ? 'show' : (obj.released && !obj.aired_episodes ? 'movie' : null)));

      // Only index entries that carry a real external id. Episode objects have
      // their own tmdb id which must never be mistaken for a show id, so they
      // are skipped here and handled by the nested/season branches below.
      const looksLikeEpisode = obj.season !== undefined &&
        (obj.number !== undefined || obj.episode !== undefined);

      if (slug && (tmdb || imdb) && !looksLikeEpisode) {
        store({
          tmdb: tmdb || null,
          imdb: imdb || null,
          slug: slug,
          trakt: trakt || null,
          type: explicitType || null,
          title: obj.title || slug
        });
        count++;
      }

      // Handle nested movie
      if (obj.movie) {
        const m = obj.movie;
        const mSlug = m.slug || (m.ids && m.ids.slug);
        const mTmdb = m.tmdb || (m.ids && m.ids.tmdb);
        const mImdb = m.imdb || (m.ids && m.ids.imdb);
        if (mSlug && (mTmdb || mImdb)) {
          store({
            tmdb: mTmdb || null,
            imdb: mImdb || null,
            slug: mSlug,
            type: 'movie',
            title: m.title || mSlug
          });
          count++;
        }
      }

      // Handle nested show
      if (obj.show) {
        const s = obj.show;
        const sSlug = s.slug || (s.ids && s.ids.slug);
        const sTmdb = s.tmdb || (s.ids && s.ids.tmdb);
        const sImdb = s.imdb || (s.ids && s.ids.imdb);
        if (sSlug && (sTmdb || sImdb)) {
          store({
            tmdb: sTmdb || null,
            imdb: sImdb || null,
            slug: sSlug,
            type: 'show',
            title: s.title || sSlug
          });
          count++;
        }
      }

      // Handle a nested episode with its parent show present
      if (obj.episode && typeof obj.episode === 'object') {
        const ep = obj.episode;
        const show = obj.show || (ep.show && typeof ep.show === 'object' ? ep.show : null);
        if (show) {
          const showSlug = show.slug || (show.ids && show.ids.slug);
          const showTmdb = show.tmdb || (show.ids && show.ids.tmdb);
          const showImdb = show.imdb || (show.ids && show.ids.imdb);
          const season = ep.season !== undefined ? ep.season : obj.season;
          const episode = ep.number !== undefined ? ep.number : (obj.number !== undefined ? obj.number : ep.episode);

          if (showSlug && season !== undefined && episode !== undefined) {
            mediaCache[episodeKey(showSlug, season, episode)] = {
              type: 'episode',
              showSlug,
              season,
              episode,
              showTmdb: showTmdb || null,
              showImdb: showImdb || null,
              tmdb: showTmdb || null,
              imdb: showImdb || null
            };
            count++;
          }
        }
      }

      // Recurse into child arrays and objects
      for (const key of Object.keys(obj)) {
        if (budget <= 0) break;
        const value = obj[key];
        if (Array.isArray(value)) {
          value.forEach(extractAndStore);
        } else if (typeof value === 'object' && value !== null) {
          extractAndStore(value);
        }
      }
    }

    if (Array.isArray(payload)) {
      payload.forEach(extractAndStore);
    } else {
      extractAndStore(payload);
    }

    if (count > 0) {
      saveCache();
      scheduleInject(0);
    }
  }

  /**
   * Minimal devalue decoder for SvelteKit `__data.json` payloads.
   * devalue flattens the graph into a single array: nested values are indices
   * into that array while their actual content lives at that index.
   */
  function decodeDevalue(root) {
    if (!Array.isArray(root)) return root;

    const seen = new Map();

    function resolve(value) {
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        value >= root.length
      ) {
        return value;
      }

      if (seen.has(value)) return seen.get(value);

      const raw = root[value];
      if (Array.isArray(raw)) {
        const arr = [];
        seen.set(value, arr);
        for (const item of raw) arr.push(resolve(item));
        return arr;
      }

      if (raw && typeof raw === 'object') {
        const obj = {};
        seen.set(value, obj);
        for (const key of Object.keys(raw)) obj[key] = resolve(raw[key]);
        return obj;
      }

      return raw;
    }

    return resolve(0);
  }

  /**
   * Feed any intercepted / SSR payload into the cache. Handles plain Trakt API
   * JSON as well as SvelteKit's devalue-encoded `__data.json` responses.
   */
  function ingestPayload(payload) {
    if (!payload) return;

    if (!Array.isArray(payload) && Array.isArray(payload.nodes)) {
      for (const node of payload.nodes) {
        if (node && Array.isArray(node.data)) {
          processTraktPayload(decodeDevalue(node.data));
        }
      }
      return;
    }

    processTraktPayload(payload);
  }

  // Receive intercepted API data from MAIN world
  window.addEventListener('Trakt2Infuse_Data', (event) => {
    try {
      const data = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
      ingestPayload(data);
    } catch (e) {}
  });

  // Capture only the public API key from real page requests. Tokens and other
  // authorization headers are deliberately ignored.
  window.addEventListener('Trakt2Infuse_Headers', (event) => {
    try {
      const headers = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
      if (!headers || typeof headers !== 'object') return;
      for (const [name, value] of Object.entries(headers)) {
        if (name.toLowerCase() === 'trakt-api-key' && isTraktApiKey(value)) {
          capturedTraktApiKey = value;
          return;
        }
      }
    } catch (e) {}
  });

  /**
   * Ask the MAIN world interceptor to replay everything it captured before
   * this content script started listening.
   */
  function requestInterceptedBuffer() {
    try {
      window.dispatchEvent(new CustomEvent('Trakt2Infuse_RequestBuffer'));
    } catch (e) {}
  }

  /**
   * Background fallback fetch using valid client-id and auth token.
   * The slug is always released afterwards so a later pass can retry.
   */
  // Lookup scheduler.
  //
  // A poster grid can hold 30-50 uncached titles. Firing one request per title
  // per injection pass (the pass runs every 2 s) floods the API: Cloudflare
  // answers the burst with 403/429 and then *every* remaining title fails, which
  // looks like "only the first few cards ever get a button". So lookups are
  // queued, spaced out, retried with exponential backoff and de-duplicated.
  const LOOKUP_CONCURRENCY = 6;
  const LOOKUP_MIN_GAP_MS = 80;
  const LOOKUP_TIMEOUT_MS = 10000;
  const LOOKUP_QUEUE_LIMIT = 300;
  // Retry delay per failure count (then stay at the last value).
  const LOOKUP_BACKOFF_MS = [5000, 30000, 120000];

  const lookupState = { active: 0, lastStart: 0 };
  const lookupQueue = [];          // { type, slug, priority }
  const lookupFailures = new Map(); // slug -> { count, at }

  function lookupBackoffActive(slug) {
    const fail = lookupFailures.get(slug);
    if (!fail) return false;
    const delay = LOOKUP_BACKOFF_MS[Math.min(fail.count, LOOKUP_BACKOFF_MS.length) - 1];
    return Date.now() - fail.at < delay;
  }

  function noteLookupFailure(slug) {
    const prev = lookupFailures.get(slug);
    lookupFailures.set(slug, { count: prev ? prev.count + 1 : 1, at: Date.now() });
  }

  function clearLookupFailure(slug) {
    lookupFailures.delete(slug);
  }

  function hasMediaIds(slug) {
    const entry = mediaCache[slug] || mediaCache[`trakt-${slug}`];
    return !!(entry && (entry.tmdb || entry.imdb));
  }

  /**
   * Queue an id lookup for a slug (no-op when already cached, queued, in flight
   * or backing off). Visible cards are queued first so the fold resolves first.
   */
  function requestMediaLookup(type, slug, priority) {
    if (!slug || BLACKLISTED_SLUGS.has(slug)) return;
    if (hasMediaIds(slug)) return;
    if (pendingFetches.has(slug)) return;
    if (lookupBackoffActive(slug)) return;

    const queued = lookupQueue.find(job => job.slug === slug);
    if (queued) {
      if (priority && !queued.priority) {
        lookupQueue.splice(lookupQueue.indexOf(queued), 1);
        queued.priority = true;
        lookupQueue.unshift(queued);
      }
      return;
    }
    if (lookupQueue.length >= LOOKUP_QUEUE_LIMIT) return;

    const job = { type, slug, priority: !!priority };
    if (job.priority) lookupQueue.unshift(job);
    else lookupQueue.push(job);
    pumpLookups();
  }

  function pumpLookups() {
    while (lookupState.active < LOOKUP_CONCURRENCY && lookupQueue.length) {
      const wait = LOOKUP_MIN_GAP_MS - (Date.now() - lookupState.lastStart);
      if (wait > 0) {
        setTimeout(pumpLookups, wait);
        return;
      }

      const job = lookupQueue.shift();
      lookupState.active++;
      lookupState.lastStart = Date.now();
      pendingFetches.set(job.slug, lookupState.lastStart);

      runLookup(job)
        .catch(() => {})
        .then(() => {
          lookupState.active--;
          pendingFetches.delete(job.slug);
          setTimeout(pumpLookups, 0);
          scheduleInject(120);
        });
    }
  }

  /**
   * fetch() with an abort-based timeout. Some environments reject an
   * AbortSignal that comes from another realm (it has happened with the page's
   * own AbortController), so a rejected signal is retried without one instead of
   * losing the lookup.
   */
  async function timedFetch(url, options) {
    let controller = null;
    if (typeof AbortController === 'function') {
      try { controller = new AbortController(); } catch (e) { controller = null; }
    }
    const timer = controller
      ? setTimeout(() => { try { controller.abort(); } catch (e) {} }, LOOKUP_TIMEOUT_MS)
      : null;

    try {
      const withSignal = controller
        ? Object.assign({}, options, { signal: controller.signal })
        : options;
      return await fetch(url, withSignal);
    } catch (err) {
      const message = (err && err.message) || '';
      if (controller && /signal|abort/i.test(message)) {
        return fetch(url, options);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Extension requests go through the background worker, which is not subject
   * to the page's CORS policy. This also keeps api.trakt.tv fallbacks quiet.
   */
  function requestBackgroundLookup(type, slug, clientId) {
    return new Promise((resolve) => {
      if (
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        typeof chrome.runtime.sendMessage !== 'function'
      ) {
        resolve(null);
        return;
      }

      try {
        chrome.runtime.sendMessage({
          action: 'lookupTraktMetadata',
          type,
          slug,
          clientId
        }, (response) => {
          // Reading lastError prevents Chrome from logging an unchecked-runtime
          // error when the service worker was reloaded mid-request.
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * Userscript fallback. Tampermonkey can use GM_xmlhttpRequest to bypass CORS
   * in the same way that the extension uses its background service worker.
   */
  function gmFetchJson(url, headers) {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        resolve(null);
        return;
      }

      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          headers,
          timeout: LOOKUP_TIMEOUT_MS,
          onload(response) {
            if (response.status >= 200 && response.status < 300) {
              try {
                resolve({ ok: true, status: response.status, data: JSON.parse(response.responseText) });
              } catch (e) {
                resolve({ ok: false, status: response.status, data: null });
              }
              return;
            }
            resolve({ ok: false, status: response.status, data: null });
          },
          onerror() {
            resolve({ ok: false, status: 0, data: null });
          },
          ontimeout() {
            resolve({ ok: false, status: 0, data: null });
          }
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * One lookup: apiz first (the endpoint the Trakt web apps use and the only one
   * that is reliably reachable), then the public API as a fallback.
   */
  async function runLookup(job) {
    const path = job.type === 'movie' ? 'movies' : 'shows';
    const { clientId } = getTraktAuth();

    const backgroundResult = await requestBackgroundLookup(job.type, job.slug, clientId);
    if (backgroundResult) {
      if (backgroundResult.ok && backgroundResult.data) {
        processTraktPayload(backgroundResult.data);
        if (hasMediaIds(job.slug)) {
          clearLookupFailure(job.slug);
          return;
        }
      }
      if (backgroundResult.status === 404) return;
      noteLookupFailure(job.slug);
      return;
    }

    const endpoints = [
      `https://apiz.trakt.tv/${path}/${encodeURIComponent(job.slug)}`,
      `https://api.trakt.tv/${path}/${encodeURIComponent(job.slug)}`
    ];
    const headers = {
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    };

    for (const endpoint of endpoints) {
      try {
        if (typeof GM_xmlhttpRequest === 'function') {
          const gmResult = await gmFetchJson(endpoint, headers);
          if (gmResult && gmResult.ok && gmResult.data) {
            processTraktPayload(gmResult.data);
            if (hasMediaIds(job.slug)) {
              clearLookupFailure(job.slug);
              return;
            }
          }
          if (gmResult && gmResult.status === 404) break;
          continue;
        }

        const res = await timedFetch(endpoint, { headers, credentials: 'omit' });
        if (!res) continue;
        // 404 means the slug itself is wrong: the other host will agree.
        if (res.status === 404) break;
        if (!res.ok) continue;

        const data = await res.json();
        processTraktPayload(data);
        if (hasMediaIds(job.slug)) {
          clearLookupFailure(job.slug);
          return;
        }
      } catch (e) {
        // Network error / timeout: fall through to the next endpoint.
      }
    }

    noteLookupFailure(job.slug);
  }

  /**
   * Backwards-compatible wrapper used by the id resolvers.
   */
  function fetchMediaIdFallback(type, slug, priority) {
    requestMediaLookup(type, slug, priority);
  }

  function lookupShow(slug) {
    return mediaCache[slug] || mediaCache[`/shows/${slug}`] || null;
  }

  function lookupMovie(slug) {
    return mediaCache[slug] || mediaCache[`/movies/${slug}`] || null;
  }

  /**
   * Show ids from the cache, the current page context, or an episode entry.
   */
  function resolveShowIds(slug, ctx, season, episode) {
    const show = lookupShow(slug);
    let tmdb = (show && show.tmdb) || null;
    let imdb = (show && show.imdb) || null;

    if (!tmdb && !imdb && ctx && ctx.ref && ctx.ref.kind === 'show' && ctx.ref.slug === slug) {
      tmdb = ctx.tmdb;
      imdb = ctx.imdb;
    }

    if (!tmdb && !imdb && season !== null && episode !== null) {
      const epEntry = mediaCache[episodeKey(slug, season, episode)];
      if (epEntry) {
        tmdb = epEntry.showTmdb || null;
        imdb = epEntry.showImdb || null;
      }
    }

    return {
      tmdb,
      imdb,
      title: (show && show.title) || slug
    };
  }

  function resolveMovieIds(slug, ctx) {
    const movie = lookupMovie(slug);
    let tmdb = (movie && movie.tmdb) || null;
    let imdb = (movie && movie.imdb) || null;

    if (!tmdb && !imdb && ctx && ctx.ref && ctx.ref.kind === 'movie' && ctx.ref.slug === slug) {
      tmdb = ctx.tmdb;
      imdb = ctx.imdb;
    }

    return {
      tmdb,
      imdb,
      title: (movie && movie.title) || slug
    };
  }

  /**
   * Resolves media info given a URL/path, optional card text and page context.
   */
  function resolveMediaInfo(urlOrPath, cardText = '', ctx = null, priority = false) {
    const ref = parseMediaRef(urlOrPath);
    if (!ref) return null;

    let season = ref.season;
    let episode = ref.episode;

    // Card links on app.trakt.tv always carry season/episode query params;
    // fall back to the visible text for legacy markup only.
    if (season === null || episode === null) {
      const fromText = parseSeasonEpisodeFromText(cardText);
      if (season === null) season = fromText.season;
      if (episode === null) episode = fromText.episode;
    }

    if (ref.kind === 'movie') {
      const ids = resolveMovieIds(ref.slug, ctx);
      if (!ids.tmdb && !ids.imdb) {
        fetchMediaIdFallback('movie', ref.slug, priority);
        return null;
      }
      return {
        type: 'movie',
        slug: ref.slug,
        tmdb: ids.tmdb,
        imdb: ids.imdb,
        title: ids.title
      };
    }

    const ids = resolveShowIds(ref.slug, ctx, season, episode);
    if (!ids.tmdb && !ids.imdb) {
      fetchMediaIdFallback('show', ref.slug, priority);
      return null;
    }

    const base = {
      showSlug: ref.slug,
      showTmdb: ids.tmdb,
      showImdb: ids.imdb,
      tmdb: ids.tmdb,
      imdb: ids.imdb,
      title: ids.title
    };

    if (season !== null && episode !== null) {
      return Object.assign({ type: 'episode', season, episode }, base);
    }
    if (season !== null) {
      return Object.assign({ type: 'season', season }, base);
    }
    return Object.assign({ type: 'show' }, base);
  }

  /**
   * Extract external IDs from DOM links on media detail page
   */
  let domIdsCache = { at: 0, tmdbId: null, imdbId: null };

  function extractDomExternalIds() {
    const now = Date.now();
    if (now - domIdsCache.at < 1500 && (domIdsCache.tmdbId || domIdsCache.imdbId)) {
      return domIdsCache;
    }

    let tmdbId = null;
    let imdbId = null;

    const tmdbLinks = document.querySelectorAll('a[href*="themoviedb.org/movie/"], a[href*="themoviedb.org/tv/"]');
    for (const link of tmdbLinks) {
      // Never trust a link that belongs to a recommendation card.
      if (link.closest('.trakt-card, .mini_card, .grid-item, [data-card]')) continue;
      const m = (link.getAttribute('href') || '').match(/themoviedb\.org\/(?:movie|tv)\/(\d+)/);
      if (m) {
        tmdbId = m[1];
        break;
      }
    }

    const imdbLinks = document.querySelectorAll('a[href*="imdb.com/title/"]');
    for (const link of imdbLinks) {
      if (link.closest('.trakt-card, .mini_card, .grid-item, [data-card]')) continue;
      const m = (link.getAttribute('href') || '').match(/imdb\.com\/title\/(tt\d+)/);
      if (m) {
        imdbId = m[1];
        break;
      }
    }

    domIdsCache = { at: now, tmdbId, imdbId };
    return domIdsCache;
  }

  /**
   * Page-level context: the media this URL points at.
   */
  function getPageContext() {
    const ref = parseMediaRef(window.location.pathname + window.location.search);
    if (!ref) return null;

    const dom = extractDomExternalIds();
    const entry = ref.kind === 'show' ? lookupShow(ref.slug) : lookupMovie(ref.slug);

    return {
      ref,
      tmdb: (entry && entry.tmdb) || dom.tmdbId || null,
      imdb: (entry && entry.imdb) || dom.imdbId || null
    };
  }

  /**
   * Resolve the show/episode shown in the episode slide-over drawer.
   */
  function resolveDrawerEpisodeInfo(ctx, drawer) {
    let ref = parseMediaRef(window.location.pathname + window.location.search);

    // Legacy episode route has no query params at all.
    if (!ref) return null;
    if (ref.kind !== 'show') return null;

    let season = ref.season;
    let episode = ref.episode;

    if ((season === null || episode === null) && drawer) {
      const meta = drawer.querySelector('.episode-title-meta-info') ||
        drawer.querySelector('.trakt-drawer-title');
      const fromText = parseSeasonEpisodeFromText(meta ? meta.textContent : '');
      if (season === null) season = fromText.season;
      if (episode === null) episode = fromText.episode;
    }

    if (season === null || episode === null) {
      const switcher = drawer ? drawer.querySelector('.episode-info-switcher') : null;
      const fromText = parseSeasonEpisodeFromText(switcher ? switcher.textContent : '');
      if (season === null) season = fromText.season;
      if (episode === null) episode = fromText.episode;
    }

    if (season === null || episode === null) return null;

    const ids = resolveShowIds(ref.slug, ctx, season, episode);
    if (!ids.tmdb && !ids.imdb) {
      fetchMediaIdFallback('show', ref.slug);
      return null;
    }

    return {
      type: 'episode',
      showSlug: ref.slug,
      season,
      episode,
      showTmdb: ids.tmdb,
      showImdb: ids.imdb,
      tmdb: ids.tmdb,
      imdb: ids.imdb,
      title: ids.title
    };
  }

  /**
   * Hero / detail header button target.
   */
  function resolveHeroInfo(ctx) {
    if (!ctx || !ctx.ref) return null;
    const ref = ctx.ref;

    if (ref.kind === 'movie') {
      const ids = resolveMovieIds(ref.slug, ctx);
      if (!ids.tmdb && !ids.imdb) {
        fetchMediaIdFallback('movie', ref.slug);
        return null;
      }
      return {
        type: 'movie',
        slug: ref.slug,
        tmdb: ids.tmdb,
        imdb: ids.imdb,
        title: ids.title
      };
    }

    const ids = resolveShowIds(ref.slug, ctx, ref.season, ref.episode);
    if (!ids.tmdb && !ids.imdb) {
      fetchMediaIdFallback('show', ref.slug);
      return null;
    }

    const base = {
      showSlug: ref.slug,
      showTmdb: ids.tmdb,
      showImdb: ids.imdb,
      tmdb: ids.tmdb,
      imdb: ids.imdb,
      title: ids.title
    };

    // When the season/episode drawer is open the hero keeps acting on the
    // season, while the drawer button plays the single episode.
    const hasViewParam = new URLSearchParams(window.location.search).has('view');

    if (ref.episode !== null && !hasViewParam) {
      return Object.assign({ type: 'episode', season: ref.season, episode: ref.episode }, base);
    }
    if (ref.season !== null) {
      return Object.assign({ type: 'season', season: ref.season }, base);
    }
    return Object.assign({ type: 'show' }, base);
  }

  /**
   * Inject the hero bar button of the detail page.
   */
  function injectDetailPageHeader(ctx) {
    if (isTvTimeHost()) return;

    if (!isDetailPage()) return;

    const info = resolveHeroInfo(ctx);
    if (!info) return;
    const deepLink = buildInfuseLink(info);
    if (!deepLink) return;

    const bars = document.querySelectorAll('.trakt-summary-actions-bar');
    for (const bar of bars) {
      if (bar.closest('.trakt-drawer')) continue;
      ensureButton(bar, findTrackAction(bar), 'infuse-summary-btn', deepLink, buildTooltip(info));
      return;
    }

    // Legacy trakt.tv action container
    const actionContainer = document.querySelector(`
      .action-buttons,
      ul.actions,
      #summary-wrapper .sidebar,
      .main-info .actions,
      div[class*="action-buttons"],
      div.watch-now
    `);

    if (!actionContainer || actionContainer.querySelector('.infuse-detail-btn')) return;

    const btn = document.createElement('a');
    btn.className = 'infuse-detail-btn infuse-icon-injected';
    btn.href = deepLink;
    btn.title = buildTooltip(info);
    btn.dataset.infuseLink = deepLink;
    btn.innerHTML = `
      <img src="${INFUSE_ICON_URL}" alt="Infuse" />
      <span>在 Infuse 中打开</span>
    `;
    btn.addEventListener('click', (e) => e.stopPropagation());
    actionContainer.prepend(btn);
  }

  /**
   * Inject the button into a drawer's own summary action bar, right next to
   * the purple "mark as watched" button.
   */
  function injectEpisodeDrawer(ctx) {
    if (isTvTimeHost()) return;

    const drawer = document.querySelector('.trakt-episode-drawer');
    if (!drawer) return;

    // The action bar only exists once the episode entry has loaded; the
    // mutation observer retries until it appears.
    const bar = drawer.querySelector('.trakt-summary-actions-bar');
    if (!bar) return;

    const info = resolveDrawerEpisodeInfo(ctx, drawer);
    if (!info) return;

    const deepLink = buildInfuseLink(info);
    if (!deepLink) return;

    ensureButton(bar, findTrackAction(bar), 'infuse-summary-btn', deepLink, buildTooltip(info));
  }

  function coverHostFor(card) {
    const cover = card.querySelector('.trakt-card-cover');
    if (cover) return cover;

    const img = card.querySelector('img');
    if (!img) return null;

    const wrapper = img.closest('picture') || img;
    return wrapper.parentElement || null;
  }

  /**
   * Inject the floating poster badge on a media card.
   */
  function injectCardBadge(card, info, preferredHost) {
    const deepLink = buildInfuseLink(info);
    if (!deepLink) return false;

    const host = preferredHost || coverHostFor(card);
    if (!host) return false;

    const existing = card.querySelector('.infuse-poster-floating-btn');
    if (existing) {
      updateInfuseButton(existing, deepLink, buildTooltip(info));
      return true;
    }

    if (host !== card.querySelector('.trakt-card-cover')) {
      const position = window.getComputedStyle(host).position;
      if (position === 'static') host.style.position = 'relative';
    }

    host.appendChild(createInfuseButton(deepLink, 'infuse-poster-floating-btn', buildTooltip(info)));
    return true;
  }

  /**
   * Media card containers (app.trakt.tv and the legacy trakt.tv markup).
   */
  const CARD_SELECTOR = '.trakt-card, .mini_card, .grid-item, [data-card]';

  /**
   * TV Time poster card. The frame holds the poster and the native ✓ button;
   * the badge anchors to it so it stays on the artwork even when the layout
   * wraps.
   */
  const TVTIME_CARD_SELECTOR = '.poster-card';

  /**
   * How specific a card link is: episode > season > show / movie. A card that
   * links to both an episode and its show must always produce the episode link.
   */
  function refSpecificity(ref) {
    if (!ref) return -1;
    if (ref.episode !== null && ref.episode !== undefined) return 3;
    if (ref.season !== null && ref.season !== undefined) return 2;
    return 1;
  }

  /**
   * Card-centric media card injection.
   * Every media card gets exactly one floating badge on its poster.
   */
  function injectAllMediaCards(ctx) {
    document.querySelectorAll(CARD_SELECTOR).forEach(card => {
      if (card.closest(SKIP_CONTAINER_SELECTOR)) return;

      // Already handled. The badge is re-created automatically whenever Svelte
      // remounts the card content (the check is by presence, not a flag).
      if (card.querySelector('.infuse-poster-floating-btn')) return;

      // Find the most specific valid media link inside THIS card
      const mediaLinks = card.querySelectorAll('a[href*="/shows/"], a[href*="/movies/"]');
      if (!mediaLinks.length) return;

      let bestRank = -1;
      for (const link of mediaLinks) {
        const rank = refSpecificity(parseMediaRef(link.getAttribute('href')));
        if (rank > bestRank) bestRank = rank;
      }
      if (bestRank < 0) return;

      const cardText = card.textContent || '';

      for (const link of mediaLinks) {
        const href = link.getAttribute('href');
        if (!href) continue;
        if (refSpecificity(parseMediaRef(href)) !== bestRank) continue;

        const info = resolveMediaInfo(href, cardText, ctx);
        // The id may still be loading: skip this pass instead of falling back
        // to a less specific link (a show link would lose season/episode).
        if (!info) return;

        if (injectCardBadge(card, info)) return;
      }
    });
  }

  /**
   * TV Time poster cards: every card gets one floating badge on its artwork,
   * exactly like the app.trakt.tv cards above.
   */
  function injectTvTimeMediaCards(ctx) {
    if (!isTvTimeHost()) return;

    document.querySelectorAll(TVTIME_CARD_SELECTOR).forEach(card => {
      if (card.querySelector('.infuse-poster-floating-btn')) return;

      const frame = card.querySelector('.poster-frame');
      if (!frame) return;

      const mediaLinks = [...card.querySelectorAll('a[href]')].filter(link =>
        parseMediaRef(link.getAttribute('href'))
      );
      if (!mediaLinks.length) return;

      let bestRank = -1;
      for (const link of mediaLinks) {
        const rank = refSpecificity(parseMediaRef(link.getAttribute('href')));
        if (rank > bestRank) bestRank = rank;
      }
      if (bestRank < 0) return;

      const cardText = card.textContent || '';

      for (const link of mediaLinks) {
        const href = link.getAttribute('href');
        if (refSpecificity(parseMediaRef(href)) !== bestRank) continue;

        const info = resolveMediaInfo(href, cardText, ctx);
        if (!info) return;

        if (injectCardBadge(card, info, frame)) return;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // og.trakt.tv — "Trakt OG Redux" (the classic theme)
  //
  // This theme is deliberately poster-first, so nothing is ever overlaid on
  // artwork. Every media card already ends with a native action strip
  // (`.quick-icons`: ✓ / list / … on the left, the ❤️ rating on the right) and
  // the Infuse button becomes one more glyph in that strip, immediately left of
  // the rating. Rows without a strip reuse their own local language:
  //   • hero action rows   -> icon the size of the neighbouring .glass-action
  //   • schedule cards     -> bare glyph left of "Watch Now"
  //   • calendar week rows -> bare glyph appended to the tag row
  // ---------------------------------------------------------------------------

  function isOgHost() {
    return window.location.hostname === 'og.trakt.tv';
  }

  function ogInSkippedContainer(el) {
    const skipped = el.closest(SKIP_CONTAINER_SELECTOR);
    // Discover's Trending Comments section is called `.comments`, but it also
    // owns a normal PosterCard. Only the generic link pass should skip a
    // comments container; OG's explicit card/strip selectors are safe inside.
    return !!skipped && !skipped.matches('.comments');
  }

  /**
   * Parse the structured media key OG Redux writes on every title element:
   *   episode:<slug>:<season>:<episode> | season:<slug>:<season>
   *   show:<slug> | movie:<slug>
   * Locale-independent, so it is always preferred over link sniffing.
   */
  function parseOgRef(value) {
    if (!value) return null;

    const parts = String(value).split(':');
    if (parts.length < 2) return null;

    const kind = parts[0];
    let slug = parts[1];
    try {
      slug = decodeURIComponent(slug);
    } catch (e) {}
    if (!slug || BLACKLISTED_SLUGS.has(slug)) return null;

    if (kind === 'episode') {
      const season = toInt(parts[2]);
      const episode = toInt(parts[3]);
      if (season === null || episode === null) return null;
      return { kind: 'show', slug, season, episode };
    }
    if (kind === 'season') {
      const season = toInt(parts[2]);
      return season === null ? null : { kind: 'show', slug, season, episode: null };
    }
    if (kind === 'show') return { kind: 'show', slug, season: null, episode: null };
    if (kind === 'movie') return { kind: 'movie', slug, season: null, episode: null };
    return null;
  }

  function ogRefFromElement(el) {
    if (!el || !el.getAttribute) return null;
    return parseOgRef(el.getAttribute('data-trakt-og-key')) ||
      parseMediaRef(el.getAttribute('href'));
  }

  /**
   * Most specific media reference inside a card: episode > season > show/movie.
   * The structured key wins because it carries the season/episode even when the
   * card itself links to the show.
   */
  function ogRefsIn(container) {
    const refs = [];
    container.querySelectorAll('[data-trakt-og-key]').forEach(el => {
      const ref = ogRefFromElement(el);
      if (ref) refs.push(ref);
    });
    container.querySelectorAll('a[href]').forEach(link => {
      const ref = ogRefFromElement(link);
      if (ref) refs.push(ref);
    });
    return refs;
  }

  function ogMostSpecificRef(refs) {
    let best = null;
    let bestRank = -1;
    refs.forEach(ref => {
      const rank = refSpecificity(ref);
      if (rank > bestRank) {
        bestRank = rank;
        best = ref;
      }
    });
    return best;
  }

  function ogMediaIdentity(ref) {
    return ref ? `${ref.kind}:${ref.slug}` : '';
  }

  function ogBestRef(container) {
    const refs = ogRefsIn(container);
    const best = ogMostSpecificRef(refs);
    // Nothing beats an episode reference, so the link pass can be skipped then.
    if (best && refSpecificity(best) >= 3) return best;
    return best;
  }

  function ogRefToPath(ref) {
    const slug = encodeURIComponent(ref.slug);
    if (ref.kind === 'movie') return `/movies/${slug}`;
    if (ref.episode !== null && ref.episode !== undefined) {
      return `/shows/${slug}/seasons/${ref.season}/episodes/${ref.episode}`;
    }
    if (ref.season !== null && ref.season !== undefined) {
      return `/shows/${slug}/seasons/${ref.season}`;
    }
    return `/shows/${slug}`;
  }

  /**
   * Cards near the viewport are resolved first; the rest of the grid is
   * prefetched at the scheduler's pace so scrolling stays instant.
   */
  function ogIsVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return true;
    const rect = el.getBoundingClientRect();
    const viewport = window.innerHeight || 0;
    return rect.bottom > -200 && rect.top < viewport + 600;
  }

  function ogDeepLink(container, ctx) {
    const ref = ogBestRef(container);
    if (!ref) return null;

    // Season/episode is always encoded in the key or the href here, so the
    // visible text must never be used as a fallback: a show card can mention
    // "1x08" in its activity line without linking to that episode.
    const info = resolveMediaInfo(ogRefToPath(ref), '', ctx, ogIsVisible(container));
    if (!info) return null;

    const deepLink = buildInfuseLink(info);
    return deepLink ? { info, deepLink } : null;
  }

  /**
   * Nearest ancestor that describes a media item. Detail and episode pages put
   * their action row in a header wrapper that does not itself hold the title, so
   * the lookup walks up a few levels instead of guessing a single selector.
   */
  function ogAncestorDeepLink(node, ctx, maxDepth = 5) {
    let el = node;
    for (let depth = 0; el && depth <= maxDepth; depth++, el = el.parentElement) {
      if (el === document.body || el === document.documentElement) break;
      const resolved = ogDeepLink(el, ctx);
      if (resolved) return resolved;
    }
    return null;
  }

  /**
   * Some OG hero charts put the action strip and the title in sibling wrappers.
   * Walk up only while the ancestor still describes one title; crossing a grid
   * with many media keys would attach the first cached title's link to the wrong
   * card.
   */
  function ogSingleTitleAncestorDeepLink(node, ctx, maxDepth = 8) {
    let el = node;
    for (let depth = 0; el && depth <= maxDepth; depth++, el = el.parentElement) {
      if (el === document.body || el === document.documentElement) break;
      const refs = ogRefsIn(el);
      const identities = new Set(refs.map(ogMediaIdentity));
      if (identities.size > 1) return null;
      if (identities.size !== 1) continue;

      const ref = ogMostSpecificRef(refs);
      const info = resolveMediaInfo(ogRefToPath(ref), '', ctx, ogIsVisible(el));
      const deepLink = info && buildInfuseLink(info);
      if (deepLink) return { info, deepLink };
    }
    return null;
  }

  /**
   * The card that owns a `.quick-icons` strip.
   */
  function ogCardForStrip(strip) {
    return strip.closest('article, li, .poster-card, .fanart-card, .on-deck-card, .card') ||
      strip.parentElement;
  }

  /**
   * The child of `row` that holds the ❤️ rating (the strip is space-between, so
   * the new glyph is inserted right before it and pushes itself over with an
   * auto margin in CSS).
   */
  function ogRatingChild(row) {
    return [...row.children].find(child =>
      child.matches('.rating-trigger, .percentage, .rating') ||
      !!child.querySelector('.rating-trigger, .percentage')
    ) || null;
  }

  /**
   * Media cards: one Infuse glyph in the native quick-icons strip.
   */
  function injectOgQuickIcons(ctx) {
    document.querySelectorAll('.quick-icons').forEach(strip => {
      if (ogInSkippedContainer(strip)) return;

      const card = ogCardForStrip(strip);
      if (!card) return;

      const resolved = ogDeepLink(card, ctx) ||
        ogSingleTitleAncestorDeepLink(strip, ctx, 5);
      if (!resolved) return;

      const tooltip = buildTooltip(resolved.info);
      const existing = strip.querySelector('.infuse-quick-btn');
      if (existing) {
        updateInfuseButton(existing, resolved.deepLink, tooltip);
        return;
      }

      const btn = createInfuseButton(resolved.deepLink, 'infuse-quick-btn', tooltip);
      const rating = ogRatingChild(strip);
      if (rating) strip.insertBefore(btn, rating);
      else strip.appendChild(btn);
    });
  }

  /**
   * Hero rows: details pages and the recommendation spotlight use the same
   * `.glass-action` pill row, so the Infuse button takes that shape.
   */
  function injectOgActionRows(ctx) {
    document.querySelectorAll('.actions').forEach(row => {
      if (ogInSkippedContainer(row)) return;
      if (row.closest('.quick-icons')) return;
      if (!row.querySelector('.glass-action, .button')) return;

      const resolved = ogSingleTitleAncestorDeepLink(row, ctx);
      if (!resolved) return;

      // A chart/season hero already exposes its quick-icon strip. Do not put a
      // second Infuse control beside the same title, but still handle heroes
      // that only render text buttons (notably Discover's season carousel).
      const mediaScope = row.closest('article, section') || row.parentElement;
      if (mediaScope && mediaScope.querySelector('.quick-icons')) return;

      const tooltip = buildTooltip(resolved.info);
      const existing = row.querySelector('.infuse-glass-btn');
      if (existing) {
        updateInfuseButton(existing, resolved.deepLink, tooltip);
        return;
      }

      const btn = createInfuseButton(resolved.deepLink, 'infuse-glass-btn', tooltip);
      const rating = ogRatingChild(row);
      if (rating) row.insertBefore(btn, rating);
      else row.appendChild(btn);
    });
  }

  /**
   * Rows without an action strip: upcoming schedule cards and the calendar week
   * list. Both render a `.tags` pill row, which is the quietest place for a
   * bare glyph — the primary "Watch Now" CTA is never touched.
   */
  function injectOgInline(ctx) {
    document.querySelectorAll('li .tags, article.card .tags').forEach(tags => {
      if (ogInSkippedContainer(tags)) return;

      const row = tags.closest('li, article.card');
      if (!row) return;

      const resolved = ogDeepLink(row, ctx);
      if (!resolved) return;

      const tooltip = buildTooltip(resolved.info);
      const existing = row.querySelector('.infuse-mini-btn');
      if (existing) {
        updateInfuseButton(existing, resolved.deepLink, tooltip);
        return;
      }

      tags.appendChild(createInfuseButton(resolved.deepLink, 'infuse-mini-btn', tooltip));
    });
  }

  function injectOgMediaCards(ctx) {
    if (!isOgHost()) return;
    try { injectOgQuickIcons(ctx); } catch (e) {}
    try { injectOgActionRows(ctx); } catch (e) {}
    try { injectOgInline(ctx); } catch (e) {}
  }

  /**
   * Containers that already own their layout; media links inside them are
   * skipped by the generic link pass.
   */
  const SKIP_CONTAINER_SELECTOR = 'header, nav, footer, [role="navigation"], [role="menu"], [role="menubar"], .breadcrumbs, .navbar, .comments, table, tbody, [role="dialog"], dialog, .trakt-spotlight-palette, .trakt-snackbar, .trakt-toast';

  /**
   * First ancestor of `element` (up to but excluding `boundary`) that is a
   * positioning context, i.e. can host an absolutely positioned badge.
   */
  function nearestPositioned(element, boundary) {
    let node = element;
    while (node && node !== boundary && node !== document.body) {
      const position = window.getComputedStyle(node).position;
      if (position && position !== 'static') return node;
      node = node.parentElement;
    }
    return null;
  }

  /**
   * Link-centric pass for posters that are not rendered as a .trakt-card.
   * The week view of the releases/calendar pages renders
   * `.trakt-calendar-poster-tile` (a plain link + image) instead of a card.
   */
  function injectLinkedPosterBadges(ctx) {
    if (isTvTimeHost()) return;

    const links = document.querySelectorAll('a[href*="/shows/"], a[href*="/movies/"]');

    links.forEach(link => {
      // Cards have their own pass (it picks the most specific link in the card)
      if (link.closest(CARD_SELECTOR)) return;
      if (link.closest(SKIP_CONTAINER_SELECTOR)) return;
      if (link.querySelector('.infuse-poster-floating-btn')) return;

      // Only links that actually show a poster
      const img = link.querySelector('img');
      if (!img) return;

      const href = link.getAttribute('href');
      if (!href) return;

      const info = resolveMediaInfo(href, link.textContent || '', ctx);
      if (!info) return;

      const deepLink = buildInfuseLink(info);
      if (!deepLink) return;

      let host = nearestPositioned(img.parentElement || img, link);
      if (!host && window.getComputedStyle(link).position !== 'static') {
        host = link;
      }
      if (!host) {
        host = (img.closest('picture') || img).parentElement || link;
        if (window.getComputedStyle(host).position === 'static') {
          host.style.position = 'relative';
        }
      }

      host.appendChild(createInfuseButton(deepLink, 'infuse-poster-floating-btn', buildTooltip(info)));
    });
  }

  function injectInfuseUI() {
    const ctx = getPageContext();

    // og.trakt.tv has its own injection model: the buttons live inside the
    // card chrome, and no artwork is ever covered.
    if (isOgHost()) {
      injectOgMediaCards(ctx);
      return;
    }

    try { injectDetailPageHeader(ctx); } catch (e) {}
    try { injectEpisodeDrawer(ctx); } catch (e) {}
    try { injectAllMediaCards(ctx); } catch (e) {}
    try { injectLinkedPosterBadges(ctx); } catch (e) {}
    try { injectTvTimeDetailPageHeader(ctx); } catch (e) {}
    try { injectTvTimeMediaCards(ctx); } catch (e) {}
  }

  /**
   * Scan inline script tags for SSR / SvelteKit state
   */
  function scanPageScriptData() {
    try {
      const scripts = document.querySelectorAll('script:not([src])');
      scripts.forEach(s => {
        const text = s.textContent || '';
        if (text.length < 20) return;
        if (!text.includes('"tmdb"') && !text.includes('"imdb"')) return;
        try {
          ingestPayload(JSON.parse(text));
        } catch (e) {
          const matches = text.match(/\{[^{}]*"tmdb"\s*:\s*\d+[^{}]*\}/g);
          if (matches) {
            matches.forEach(m => {
              try {
                ingestPayload(JSON.parse(m));
              } catch (err) {}
            });
          }
        }
      });
    } catch (e) {}
  }

  // Throttled injection scheduler: a busy page (constant DOM churn) must never
  // starve the injection pass, so a queued pass is never pushed back.
  let injectTimer = null;
  function scheduleInject(delay = 0) {
    if (injectTimer !== null) return;
    injectTimer = setTimeout(() => {
      injectTimer = null;
      try {
        injectInfuseUI();
      } catch (e) {}
    }, Math.max(delay, INJECT_DEBOUNCE_MS));
  }

  // MutationObserver for SPA changes
  const observer = new MutationObserver(() => {
    scheduleInject(0);
  });

  function startObserving() {
    const root = document.documentElement || document.body;
    if (!root) {
      setTimeout(startObserving, 20);
      return;
    }
    observer.observe(root, { childList: true, subtree: true });
  }

  function bootstrap() {
    scanPageScriptData();
    requestInterceptedBuffer();
    injectInfuseUI();
  }

  // Start as early as possible so no intercepted payload is missed.
  startObserving();
  requestInterceptedBuffer();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }

  window.addEventListener('load', () => {
    scanPageScriptData();
    scheduleInject(0);
  });

  window.addEventListener('popstate', () => {
    scheduleInject(0);
    requestInterceptedBuffer();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleInject(0);
  });

  // Safety net: cards rendered while a lookup was in flight (or remounted by
  // Svelte) are picked up here even if no further mutation is observed.
  setInterval(() => {
    if (document.hidden) return;
    scheduleInject(0);
  }, RESCAN_INTERVAL_MS);

  // Initial injection
  scheduleInject(0);
})();
