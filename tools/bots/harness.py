"""Shared bot harness for Karvanyan (baseline, legacy and new builds).

Why this exists: the game runs on timers (one travel day = 1.4 s), so we drive
it with Playwright's fake clock and click buttons through one JS round trip per
step. Math.random is replaced by a seeded generator *before* the page loads, so
every run is reproducible from its seed even on the unseeded baseline.

The harness reads the game only through the DOM (button labels, HUD ids,
headings). It does not depend on game internals, so the same bots can measure
baseline/, legacy/ and the new build.
"""
import hashlib
import json
import re

SEED_SCRIPT = """
(() => {
  // mulberry32, same algorithm as js/rng.js
  let a = %d >>> 0;
  Math.random = function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
"""

# Snapshot of everything a bot needs, in one evaluate() call.
SNAP_JS = r"""() => {
  const modal = document.querySelector('#modalHost .overlay');
  const root = modal || document.querySelector('#screen');
  const vis = b => b.offsetParent !== null || b.getClientRects().length > 0;
  const btns = root ? [...root.querySelectorAll('button')].filter(vis) : [];
  const hud = {};
  document.querySelectorAll('[id^="h-"]').forEach(e => { hud[e.id.slice(2)] = e.textContent.trim(); });
  const h2 = root && root.querySelector('h2') ? root.querySelector('h2').textContent.trim() : '';
  return {
    modal: !!modal,
    hunt: !!(root && root.querySelector('#field, [data-testid="hunt-field"]')),
    h2,
    text: root ? root.innerText.slice(0, 4000) : '',
    btns: btns.map((b, i) => ({ i, t: b.innerText.replace(/\s+/g, ' ').trim(),
                                d: b.disabled, c: b.className, id: b.dataset.testid || '' })),
    hud
  };
}"""

CLICK_JS = r"""(i) => {
  const modal = document.querySelector('#modalHost .overlay');
  const root = modal || document.querySelector('#screen');
  const vis = b => b.offsetParent !== null || b.getClientRects().length > 0;
  const b = [...root.querySelectorAll('button')].filter(vis)[i];
  if (b && !b.disabled) b.click();
}"""

TICK_MS = 1400


def num(s, default=0.0):
    m = re.search(r"-?\d+(\.\d+)?", s or "")
    return float(m.group(0)) if m else default


def party_counts(hud):
    m = re.match(r"(\d+)/(\d+)", hud.get("party", "") or "")
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)


def parse_end(snap):
    """Return a result dict if the end screen is showing, else None."""
    h2 = snap["h2"]
    if "Demo complete" not in h2 and "journey ends" not in h2:
        return None
    text = snap["text"]
    win = "Demo complete" in h2
    score = None
    m = re.search(r"Final score\s+(\d+)", text)
    if m:
        score = int(m.group(1))
    day = None
    m = re.search(r"on day (\d+)", text)
    if m:
        day = int(m.group(1))
    cause = None
    if not win:
        m = re.search(r"died of (.+?) on day", text)
        cause = m.group(1).strip() if m else "unknown"
    return {"win": win, "score": score, "day": day, "cause": cause}


def snap_hash(s):
    return hashlib.md5(json.dumps([s["h2"], s["text"][:800], [b["t"] for b in s["btns"]], s["hud"]],
                                  sort_keys=True).encode()).hexdigest()


def run_one(browser, url, policy, seed, merchant_idx, max_steps=6000, viewport=(390, 780)):
    """Play one full game. Returns a result dict (never raises for game errors)."""
    ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
    # Block third-party requests (Google Fonts in the baseline) so runs are offline and fast.
    ctx.route(re.compile(r"^https?://(?!localhost|127\.0\.0\.1).*"), lambda r: r.abort())
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.clock.install()
    page.add_init_script(SEED_SCRIPT % seed)
    page.goto(url)
    page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    page.reload()
    state = {"merchant_idx": merchant_idx, "seed": seed, "stop": None, "rests": 0, "guides": 0}
    same, last, result = 0, None, None
    merchant = None
    for step in range(max_steps):
        s = page.evaluate(SNAP_JS)
        end = parse_end(s)
        if end:
            result = end
            break
        h = snap_hash(s)
        same = same + 1 if h == last else 0
        last = h
        if same > 250:
            result = {"win": False, "score": None, "day": None, "cause": "SOFTLOCK"}
            break
        if s["h2"].startswith("Choose your journey"):
            names = [b["t"] for b in s["btns"] if b["t"].startswith("Travel as the")]
            if names:
                merchant = names[merchant_idx % len(names)].replace("Travel as the ", "")
        choice = policy(s, state)
        if choice is None:
            page.clock.run_for(1000 if s["hunt"] else TICK_MS)
        else:
            page.evaluate(CLICK_JS, choice)
            page.clock.run_for(20)
    else:
        result = {"win": False, "score": None, "day": None, "cause": "TIMEOUT"}
    result.update({"seed": seed, "merchant": merchant, "errors": len(errors),
                   "error_samples": errors[:3], "steps": step})
    ctx.close()
    return result
