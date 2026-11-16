/**
 * Trakt to Infuse - Background Service Worker
 * Handles context menu actions and CORS-free metadata lookups.
 */

const DEFAULT_CLIENT_ID = '201dc70c5ec6af530f12f079ea1922733f6e1085ad7b02f36d8e011b75bcea7d';
const LOOKUP_TIMEOUT_MS = 8000;

function validClientId(value) {
  return typeof value === 'string' && /^[a-f0-9]{32,}$/i.test(value);
}

async function fetchTraktMetadata(path, slug, clientId) {
  const endpoints = [
    `https://apiz.trakt.tv/${path}/${encodeURIComponent(slug)}`,
    `https://api.trakt.tv/${path}/${encodeURIComponent(slug)}`
  ];
  const headers = {
    'trakt-api-version': '2',
    'trakt-api-key': validClientId(clientId) ? clientId : DEFAULT_CLIENT_ID
  };

  for (const endpoint of endpoints) {
    let controller = null;
    let timer = null;

    try {
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      const response = await fetch(endpoint, {
        headers,
        credentials: 'omit',
        signal: controller.signal
      });

      if (response.ok) {
        return { ok: true, status: response.status, data: await response.json() };
      }
      if (response.status === 404) {
        return { ok: false, status: 404, data: null };
      }
    } catch (e) {
      // Try the public API host if the web-app host is unavailable.
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { ok: false, status: 0, data: null };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== 'lookupTraktMetadata') return false;

  const type = message.type === 'movie' ? 'movie' : 'show';
  const slug = typeof message.slug === 'string' ? message.slug.trim() : '';
  if (!slug) {
    sendResponse({ ok: false, status: 400, data: null });
    return false;
  }

  fetchTraktMetadata(type === 'movie' ? 'movies' : 'shows', slug, message.clientId)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, status: 0, data: null }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "trakt2infuse-open-link",
    title: "Open in Infuse",
    contexts: ["link"],
    targetUrlPatterns: [
      "https://trakt.tv/movies/*",
      "https://trakt.tv/shows/*",
      "https://app.trakt.tv/movies/*",
      "https://app.trakt.tv/shows/*",
      "https://og.trakt.tv/movies/*",
      "https://og.trakt.tv/shows/*",
      "https://tvtime.trakt.tv/movies/*",
      "https://tvtime.trakt.tv/shows/*"
    ]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "trakt2infuse-open-link" && info.linkUrl) {
    chrome.tabs.sendMessage(tab.id, {
      action: "openLinkInInfuse",
      url: info.linkUrl
    });
  }
});
