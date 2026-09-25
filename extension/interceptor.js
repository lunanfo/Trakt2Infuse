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
