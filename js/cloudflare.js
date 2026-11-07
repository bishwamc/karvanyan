(function () {
  'use strict';
  // Skip on local preview
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:') return;

  // Respect the in-game "Share anonymous play statistics" setting
  try {
    const saved = JSON.parse(localStorage.getItem('karvanyan.settings.v2') || '{}');
    if (saved.shareStatistics === false) return;
  } catch (e) { /* storage blocked: treat as default (on) */ }

  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', '{"token": "65585f2413684aae92d08392b64cf2a5"}');
  s.onerror = function () { console.info('Cloudflare analytics blocked (ad blocker?)'); };
  document.head.appendChild(s);
})();
