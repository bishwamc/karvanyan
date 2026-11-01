(function () {
  'use strict';

  // Do not load on local preview / dev
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:';
  if (isLocal) {
    return;
  }

  // Load Cloudflare Web Analytics Beacon
  try {
    const cfScript = document.createElement('script');
    cfScript.defer = true;
    cfScript.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    cfScript.setAttribute('data-cf-beacon', '{"token": "65585f2413684aae92d08392b64cf2a5"}');
    
    // Catch ad-blocker network drops silently
    cfScript.onerror = function () {
      // Ignored: Script blocked by browser tracking protection or ad-blocker
    };

    document.head.appendChild(cfScript);
  } catch (e) {
    // Fail silently so the rest of the game continues running
  }
})();
