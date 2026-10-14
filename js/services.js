/**
 * services.js: the seam between the game and any outside service (counters, scoreboard, analytics).
 *
 * Today only the local implementation exists. It stores counts in this browser and sends nothing.
 * Later, a remote implementation with the same methods can be passed to createServices({ remote }).
 * Every method returns a Promise and never rejects, so callers do not change when a network is added.
 *
 * Callers must not read localStorage or call fetch directly. Go through this module.
 */
(function (namespace) {
  'use strict';

  // The key lives in Config.STORAGE_KEYS when config.js has loaded; the literal is a fallback for tests.
  const LOCAL_KEY = (namespace.Config && namespace.Config.STORAGE_KEYS && namespace.Config.STORAGE_KEYS.LOCAL_STATS) || 'karvanyan.local-stats.v1';
  const METHOD_NAMES = Object.freeze(['recordJourneyStart', 'recordJourneyEnd', 'getPublicStats', 'submitScore']);

  const emptyStats = () => ({ journeysStarted: 0, journeysEnded: 0 });

  /** Browsers may block storage (private mode, quota, disabled). Every access is guarded. */
  function createLocalAdapter(storage) {
    let memory = emptyStats();

    function read() {
      try {
        const raw = storage ? storage.getItem(LOCAL_KEY) : null;
        if (!raw) return { ...memory };
        const parsed = JSON.parse(raw);
        return {
          journeysStarted: Math.max(0, Math.floor(Number(parsed.journeysStarted) || 0)),
          journeysEnded: Math.max(0, Math.floor(Number(parsed.journeysEnded) || 0)),
        };
      } catch (error) {
        return { ...memory };
      }
    }

    function write(stats) {
      memory = { ...stats };
      try { if (storage) storage.setItem(LOCAL_KEY, JSON.stringify(stats)); } catch (error) { /* memory copy still works */ }
    }

    return Object.freeze({
      mode: 'local',
      recordJourneyStart() {
        const stats = read();
        stats.journeysStarted += 1;
        write(stats);
        return Promise.resolve({ ok: true });
      },
      recordJourneyEnd() {
        const stats = read();
        stats.journeysEnded += 1;
        write(stats);
        return Promise.resolve({ ok: true });
      },
      /** Local counts are for this browser only. They are not a global total. */
      getPublicStats() {
        return Promise.resolve({ scope: 'this-browser', ...read() });
      },
      /** Not configured in this build. Returns a status instead of pretending to submit. */
      submitScore() {
        return Promise.resolve({ ok: false, reason: 'not-configured' });
      },
    });
  }

  /** Wraps a remote adapter so that any failure becomes a status, never a thrown error. */
  function guard(method, fallback) {
    return (...args) => {
      try {
        return Promise.resolve(method(...args)).catch((error) => fallback(error));
      } catch (error) {
        return Promise.resolve(fallback(error));
      }
    };
  }

  /**
   * @param {{storage?:Storage|null, remote?:Object|null}} [options]
   *   storage: where local counts go (defaults to window.localStorage, guarded).
   *   remote: optional adapter with the same method names. Missing methods fall back to local.
   */
  function createServices(options) {
    const opts = options || {};
    let storage = opts.storage;
    if (storage === undefined) {
      try { storage = typeof window !== 'undefined' ? window.localStorage : null; } catch (error) { storage = null; }
    }
    const local = createLocalAdapter(storage);
    const remote = opts.remote || null;

    const pick = (name) => {
      if (remote && typeof remote[name] === 'function') {
        return guard(remote[name], (error) => ({ ok: false, reason: 'remote-error', detail: String(error && error.message) }));
      }
      return local[name];
    };

    const services = {};
    METHOD_NAMES.forEach((name) => { services[name] = pick(name); });
    services.mode = remote ? 'remote' : 'local';
    return Object.freeze(services);
  }

  namespace.Services = Object.freeze({ createServices, METHOD_NAMES });
})((window.Karvanyan = window.Karvanyan || {}));
