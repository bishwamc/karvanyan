/**
 * analytics.js: anonymous play statistics, sent to GoatCounter as small image requests.
 *
 * Privacy rules, enforced here and by tests/analytics.test.mjs:
 *   - Only counts are sent. A path is built from a fixed list of kinds and fixed lists of values.
 *     Names, epitaphs, save contents and anything the player types can never reach this module's output.
 *   - Nothing is sent unless a GoatCounter site code is set in Config.ANALYTICS and the player has not
 *     switched statistics off in Settings.
 *   - A failure (blocked request, no network) is swallowed. The game never shows an error for analytics.
 *
 * GoatCounter's documented image endpoint is  https://CODE.goatcounter.com/count?p=PATH&t=TITLE&e=true
 * (see goatcounter.com/help/pixel). No third-party script is loaded, so the page's Content-Security-Policy
 * only needs img-src for that address.
 */
(function (namespace) {
  'use strict';

  const Config = namespace.Config;
  const World = namespace.World;

  const MONTH_IDS = Object.freeze({ 8: 'sep', 9: 'oct', 10: 'nov' });
  const DEATH_CAUSES = Object.freeze(['hunger', 'exhaustion', 'violence', 'fever', 'dysentery', 'heat', 'exposure', 'other']);
  const CROSSING_CHOICES = Object.freeze(['bridge', 'ferry', 'ferry2', 'premium', 'wait', 'ford', 'swim']);

  /** Every event kind and, for each path segment after it, the complete list of values allowed there. */
  const EVENT_SHAPES = Object.freeze({
    start: [Config.ARCHETYPES.map((archetype) => archetype.id), Object.values(MONTH_IDS)],
    stop: [World.NODES.map((node) => node.id)],
    cross: [Object.keys(World.RIVERS), CROSSING_CHOICES],
    death: [DEATH_CAUSES, World.NODES.map((node) => node.id)],
    end: [['arrived', 'died']],
    rating: [['1', '2', '3', '4', '5']],
    learned: [['yes', 'little', 'no']],
    device: [['phone', 'tablet', 'desktop']],
    intro: [['finished', 'skipped']],
    'feedback-open': [],
  });

  const SITE_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}$/;

  /** Maps whatever the game recorded as a cause of death onto the fixed list. Unknown causes count as 'other'. */
  function normaliseDeathCause(rawCause) {
    const cause = String(rawCause || '').toLowerCase();
    return DEATH_CAUSES.includes(cause) ? cause : 'other';
  }

  /**
   * Builds the event path, or returns null if the kind or any value is not on the fixed lists.
   * @param {string} kind
   * @param {...string} segments
   * @returns {string|null}
   */
  function buildEventPath(kind, ...segments) {
    const shape = EVENT_SHAPES[kind];
    if (!shape || segments.length !== shape.length) return null;
    const isEveryValueAllowed = segments.every((segment, index) => shape[index].includes(String(segment)));
    return isEveryValueAllowed ? [kind, ...segments.map(String)].join('/') : null;
  }

  /** True when a path was built from the fixed lists. This is the check applied just before anything is sent. */
  function isAllowedEventPath(path) {
    if (typeof path !== 'string') return false;
    const [kind, ...segments] = path.split('/');
    return buildEventPath(kind, ...segments) === path;
  }

  /** Phone, tablet or desktop from the window width. Only this word is sent, never the width. */
  function classifyDevice(windowWidth) {
    if (windowWidth < 600) return 'phone';
    return windowWidth < 1024 ? 'tablet' : 'desktop';
  }

  /**
   * The remote adapter for services.js: it provides trackEvent and nothing else, so the other service methods
   * keep using the local adapter.
   * @param {{code:string, isEnabled?:()=>boolean, sendImageRequest?:(url:string)=>void}} options
   *   sendImageRequest is replaced in tests; in the browser it loads a 1x1 image.
   */
  function createGoatCounterRemote(options) {
    const code = String(options && options.code ? options.code : '').toLowerCase();
    if (!SITE_CODE_PATTERN.test(code)) return null;
    const isEnabled = options.isEnabled || (() => true);
    const sendImageRequest = options.sendImageRequest || ((url) => { const image = new Image(); image.src = url; });
    const endpoint = `https://${code}.goatcounter.com/count`;

    function send(path, title, isEvent) {
      if (!isEnabled()) return Promise.resolve({ ok: false, reason: 'disabled' });
      const query = new URLSearchParams({ p: path, t: title, e: isEvent ? 'true' : 'false', rnd: String(Date.now()) });
      try {
        sendImageRequest(`${endpoint}?${query.toString()}`);
        return Promise.resolve({ ok: true });
      } catch (error) {
        return Promise.resolve({ ok: false, reason: 'send-failed' });
      }
    }

    return {
      trackEvent(path) {
        if (!isAllowedEventPath(path)) return Promise.resolve({ ok: false, reason: 'path-not-allowed' });
        return send(path, path, true);
      },
      /** One page view per load, so GoatCounter can show visits alongside the events. */
      trackPageview() {
        return send('/', 'Karvanyan', false);
      },
    };
  }

  namespace.Analytics = Object.freeze({
    EVENT_SHAPES, buildEventPath, isAllowedEventPath, normaliseDeathCause, classifyDevice, createGoatCounterRemote,
  });
})(window.Karvanyan);
