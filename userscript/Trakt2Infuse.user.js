// ==UserScript==
// @name         Trakt to Infuse
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Seamlessly open Trakt movies, shows, seasons, and episodes in Infuse.
// @author       xSequip
// @match        https://trakt.tv/*
// @match        https://app.trakt.tv/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trakt.tv
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Infuse icon asset (Base64 encoded)
    const INFUSE_ICON_URL = 'data:image/png;base64,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';

    const css = `
/* Trakt to Infuse - Styles */

.infuse-icon-injected {
    box-sizing: border-box !important;
}

/* Floating poster badge (top-left corner of a poster / episode still).
   Used by every media card so the look is identical everywhere and the
   native "mark as watched" ✓ button in the card footer is never touched.
   The plate follows the site theme: dark surface on dark, light surface on
   light. The literal values before each color-mix() are the fallback for the
   legacy trakt.tv site, which has no Trakt theme tokens. */
.infuse-poster-floating-btn {
    position: absolute !important;
    top: 6px !important;
    left: 6px !important;
    z-index: 25 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 26px !important;
    height: 26px !important;
    min-width: 26px !important;
    max-width: 26px !important;
    min-height: 26px !important;
    max-height: 26px !important;
    border-radius: 50% !important;
    background: rgba(0, 0, 0, 0.62) !important;
    background: color-mix(in srgb, var(--color-card-background, #16181d) 84%, transparent) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-color: color-mix(in srgb, var(--color-foreground, #ffffff) 22%, transparent) !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45) !important;
    box-shadow: 0 2px 6px color-mix(in srgb, var(--color-shadow, #000000) 45%, transparent) !important;
    backdrop-filter: blur(6px) !important;
    cursor: pointer !important;
    padding: 0 !important;
    margin: 0 !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    text-decoration: none !important;
}

.infuse-poster-floating-btn:hover {
    /* the plate keeps the theme surface (so the orange mark stays readable on
       both themes); hover is signalled by an orange ring */
    border-color: #ff5500 !important;
    transform: scale(1.12) !important;
    box-shadow: 0 0 10px rgba(255, 85, 0, 0.6) !important;
    box-shadow: 0 0 10px color-mix(in srgb, #ff5500 60%, transparent) !important;
}

.infuse-poster-floating-btn:active {
    transform: scale(0.95) !important;
}

/* Transparent brand mark (white plate removed by tools/build-icons.js), so the
   circular badge shows the mark itself instead of a white square. */
.infuse-poster-floating-btn img {
    width: 18px !important;
    height: 18px !important;
    object-fit: contain !important;
    display: block !important;
    pointer-events: none !important;
}

/* Button living inside a .trakt-summary-actions-bar: the detail page hero
   bar and the episode drawer action bar (right next to the purple checkmark).
   Plate and ring are derived from the theme foreground, so the button reads
   light on the light theme and dark on the dark theme, like the native ghost
   actions next to it. */
.infuse-summary-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    max-width: 40px !important;
    min-height: 40px !important;
    max-height: 40px !important;
    flex: 0 0 auto !important;
    align-self: center !important;
    border-radius: 12px !important;
    background: rgba(255, 255, 255, 0.1) !important;
    background: color-mix(in srgb, var(--color-foreground, #ffffff) 10%, transparent) !important;
    border: 1px solid rgba(255, 255, 255, 0.16) !important;
    border-color: color-mix(in srgb, var(--color-foreground, #ffffff) 16%, transparent) !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3) !important;
    cursor: pointer !important;
    margin: 0 !important;
    padding: 0 !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    text-decoration: none !important;
    backdrop-filter: blur(4px) !important;
    z-index: 10 !important;
}

.infuse-summary-btn:hover {
    /* mirrors the native secondary/purple pill treatment: stronger theme
       surface plus the brand-coloured ring */
    background: rgba(255, 255, 255, 0.18) !important;
    background: color-mix(in srgb, var(--color-foreground, #ffffff) 18%, transparent) !important;
    border-color: #ff5500 !important;
    transform: scale(1.06) !important;
    box-shadow: 0 2px 10px rgba(255, 85, 0, 0.35) !important;
    box-shadow: 0 2px 10px color-mix(in srgb, #ff5500 35%, transparent) !important;
}

.infuse-summary-btn:active {
    transform: scale(0.95) !important;
}

/* Same transparent mark as the poster badge, sized to read like the native
   24px glyphs next to it. The container keeps the native ActionButton
   geometry (40x40, 12px radius) so the row stays aligned. */
.infuse-summary-btn img {
    width: 24px !important;
    height: 24px !important;
    object-fit: contain !important;
    display: block !important;
    pointer-events: none !important;
}

/* Legacy trakt.tv detail page button */
.infuse-detail-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    padding: 7px 14px !important;
    border-radius: 6px !important;
    background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%) !important;
    color: #ffffff !important;
    font-weight: 600 !important;
    font-size: 13px !important;
    text-decoration: none !important;
    box-shadow: 0 2px 8px rgba(255, 87, 34, 0.35) !important;
    border: none !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    margin: 4px 6px 4px 0 !important;
    line-height: 1 !important;
    vertical-align: middle !important;
    white-space: nowrap !important;
}

.infuse-detail-btn:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(255, 87, 34, 0.5) !important;
    background: linear-gradient(135deg, #ff7043 0%, #f4511e 100%) !important;
    color: #ffffff !important;
}

.infuse-detail-btn img {
    width: 16px !important;
    height: 16px !important;
    object-fit: contain !important;
    display: inline-block !important;
}

.infuse-detail-btn span {
    color: #ffffff !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    line-height: 1 !important;
}
    `;

    GM_addStyle(css);

    // Inject interceptor directly into the page's execution context
    const interceptorCode = `
      /**
       * Trakt to Infuse - Network Interceptor (runs in MAIN world)
       * Intercepts fetch and XMLHttpRequest calls to capture TMDB/IMDb IDs from Trakt API responses.
       *
       * Every captured payload is also kept in a small in-page buffer so the content
       * script can replay anything that resolved before it started listening.
       */

      (function () {
        'use strict';

        if (window.__TRAKT2INFUSE_INTERCEPTOR_INJECTED__) return;
        window.__TRAKT2INFUSE_INTERCEPTOR_INJECTED__ = true;

        console.log('[Trakt2Infuse] Network Interceptor active in page context');

        const BUFFER_LIMIT = 12;
        const BUFFER_MAX_CHARS = 3000000;
        const payloadBuffer = [];
        let bufferChars = 0;

        function pushBuffer(detail) {
          payloadBuffer.push(detail);
          bufferChars += detail.length;
          while (
            payloadBuffer.length > BUFFER_LIMIT ||
            (bufferChars > BUFFER_MAX_CHARS && payloadBuffer.length > 1)
          ) {
            bufferChars -= payloadBuffer.shift().length;
          }
        }

        function dispatchMediaData(payload) {
          if (!payload) return;
          try {
            const detail = JSON.stringify(payload);
            if (typeof detail !== 'string') return;
            pushBuffer(detail);
            window.dispatchEvent(
              new CustomEvent('Trakt2Infuse_Data', {
                detail: detail
              })
            );
          } catch (e) {}
        }

        function dispatchHeaders(headers) {
          if (!headers || typeof headers !== 'object') return;
          try {
            window.dispatchEvent(
              new CustomEvent('Trakt2Infuse_Headers', {
                detail: JSON.stringify(headers)
              })
            );
          } catch (e) {}
        }

        // Replay everything captured so far when the content script asks for it.
        window.addEventListener('Trakt2Infuse_RequestBuffer', () => {
          for (const detail of payloadBuffer) {
            try {
              window.dispatchEvent(
                new CustomEvent('Trakt2Infuse_Data', { detail: detail })
              );
            } catch (e) {}
          }
        });

        function extractHeaders(input) {
          const extracted = {};
          if (!input) return extracted;

          try {
            if (typeof input.forEach === 'function') {
              input.forEach((val, key) => {
                const lk = key.toLowerCase();
                if (lk.includes('trakt') || lk === 'authorization' || lk.includes('token') || lk.includes('csrf')) {
                  extracted[key] = val;
                }
              });
            } else if (typeof input === 'object') {
              for (const [key, val] of Object.entries(input)) {
                const lk = key.toLowerCase();
                if (lk.includes('trakt') || lk === 'authorization' || lk.includes('token') || lk.includes('csrf')) {
                  extracted[key] = val;
                }
              }
            }
          } catch (e) {}

          return extracted;
        }

        // Intercept window.fetch
        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
          try {
            // Capture headers if available
            const reqHeaders = (args[0] && args[0].headers) || (args[1] && args[1].headers);
            if (reqHeaders) {
              const h = extractHeaders(reqHeaders);
              if (Object.keys(h).length > 0) {
                dispatchHeaders(h);
              }
            }
          } catch (e) {}

          const response = await originalFetch.apply(this, args);

          try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
            const isCandidate =
              url.includes('trakt.tv') ||
              url.includes('/users/') ||
              url.includes('/sync/') ||
              url.includes('/calendars/') ||
              url.includes('/movies') ||
              url.includes('/shows') ||
              url.includes('/search') ||
              url.includes('__data.json') ||
              url.startsWith('/api/');

            if (isCandidate) {
              const clone = response.clone();
              clone.json().then(data => {
                dispatchMediaData(data);
              }).catch(() => {});
            }
          } catch (err) {}

          return response;
        };

        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
          this._traktUrl = url;
          return originalOpen.call(this, method, url, ...rest);
        };

        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
          if (!this._headers) this._headers = {};
          this._headers[header] = value;
          return originalSetRequestHeader.call(this, header, value);
        };

        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
          if (this._headers) {
            const h = extractHeaders(this._headers);
            if (Object.keys(h).length > 0) {
              dispatchHeaders(h);
            }
          }

          this.addEventListener('load', function () {
            try {
              if (this.responseText) {
                const url = this._traktUrl || '';
                const isCandidate =
                  url.includes('trakt.tv') ||
                  url.includes('/users/') ||
                  url.includes('/sync/') ||
                  url.includes('/calendars/') ||
                  url.includes('/movies') ||
                  url.includes('/shows') ||
                  url.includes('__data.json');

                if (isCandidate) {
                  const data = JSON.parse(this.responseText);
                  dispatchMediaData(data);
                }
              }
            } catch (err) {}
          });

          return originalSend.apply(this, args);
        };
      })();
    `;

    const scriptEl = document.createElement('script');
    scriptEl.textContent = interceptorCode;
    (document.head || document.documentElement).appendChild(scriptEl);
    scriptEl.remove();

    const CACHE_KEY = 'trakt2infuse_media_cache';
    const DEFAULT_CLIENT_ID = '201dc70c5ec6af530f12f079ea1922733f6e1085ad7b02f36d8e011b75bcea7d';

    // Release an in-flight fallback lookup after this long so a failed request
    // can be retried instead of locking the slug forever.
    const PENDING_TTL_MS = 15000;
    const SAVE_DEBOUNCE_MS = 1500;
    const RESCAN_INTERVAL_MS = 2000;
    const INJECT_DEBOUNCE_MS = 60;
    // Safety valve for very large API payloads (e.g. full history sync).
    const PAYLOAD_NODE_BUDGET = 200000;

    // In-memory cache: slug -> { tmdb, imdb, slug, type, title }
    let mediaCache = {};
    // slug -> timestamp of the in-flight fallback request
    const pendingFetches = new Map();

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

    /**
     * Dynamically get Trakt Client ID and Bearer Token from localStorage
     */
    function getTraktAuth() {
      let clientId = DEFAULT_CLIENT_ID;
      let token = null;

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('oidc.user:')) {
            const parts = key.split(':');
            if (parts.length >= 3 && parts[2]) {
              clientId = parts[2];
            }
            const val = JSON.parse(localStorage.getItem(key));
            if (val && val.access_token) {
              token = val.access_token;
            }
          }
        }
      } catch (e) {}

      return { clientId, token };
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
    async function fetchMediaIdFallback(type, slug) {
      if (!slug || BLACKLISTED_SLUGS.has(slug)) return;

      const startedAt = pendingFetches.get(slug);
      if (startedAt !== undefined && Date.now() - startedAt < PENDING_TTL_MS) return;
      pendingFetches.set(slug, Date.now());

      const path = type === 'movie' ? 'movies' : 'shows';
      const endpoints = [
        `https://apiz.trakt.tv/${path}/${encodeURIComponent(slug)}`,
        `https://api.trakt.tv/${path}/${encodeURIComponent(slug)}`
      ];

      const { clientId, token } = getTraktAuth();
      const headers = {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        for (const endpoint of endpoints) {
          try {
            const res = await fetch(endpoint, { headers, credentials: 'omit' });
            if (res && res.ok) {
              const data = await res.json();
              processTraktPayload(data);
              return;
            }
          } catch (e) {
            // Try the next endpoint
          }
        }
      } finally {
        pendingFetches.delete(slug);
        scheduleInject(200);
      }
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
    function resolveMediaInfo(urlOrPath, cardText = '', ctx = null) {
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

      const ids = resolveShowIds(ref.slug, ctx, season, episode);
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
    function injectCardBadge(card, info) {
      const deepLink = buildInfuseLink(info);
      if (!deepLink) return false;

      const host = coverHostFor(card);
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
      const cards = document.querySelectorAll(`
        .trakt-card,
        .mini_card,
        .grid-item,
        [data-card]
      `);

      cards.forEach(card => {
        if (
          card.closest('header, nav, footer, [role="navigation"], [role="menu"], [role="menubar"], .breadcrumbs, .navbar, .comments, table, tbody')
        ) {
          return;
        }

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

    function injectInfuseUI() {
      const ctx = getPageContext();

      try { injectDetailPageHeader(ctx); } catch (e) {}
      try { injectEpisodeDrawer(ctx); } catch (e) {}
      try { injectAllMediaCards(ctx); } catch (e) {}
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
