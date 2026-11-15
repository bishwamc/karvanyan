"""
Browser test: layout budgets for the Stop and Road screens (v4.0.1 CSS hotfix, v4.0.2 margin card).
Needs Python Playwright and the game served over HTTP.

Usage (from the project folder):
  python3 -m http.server 8099 &
  python3 tests/e2e/layout_budget.py
Set KARVANYAN_URL to test another address. Exits 1 if any budget is broken.

What it guards (each check names the bug it came from):
  - no sideways scroll at any size
  - action bar stays one row of buttons (it used to wrap to 153 px)
  - on a short landscape phone the top bar is not pinned (it left 146 px to read in)
  - a readiness tick and its text share a line (the Money row used to break away)
  - the sealed letter is readable in the night theme (it was cream on cream)
  - the Stop page may not grow taller than today's budget (tighten this in Phase 3)
"""
import json, os, subprocess, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('KARVANYAN_URL', 'http://localhost:8099/index.html')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SIZES = [(390, 844), (360, 740), (667, 375), (1280, 800), (1366, 768)]

PROBE = """() => {
  const rect = (selector) => { const el = document.querySelector(selector); return el ? el.getBoundingClientRect() : null; };
  const bar = rect('.action-bar'); const hud = document.querySelector('.hud');
  const mark = rect('[data-testid="ready-money"] .readiness__mark'); const text = rect('[data-testid="ready-money"] .readiness__text');
  const buttons = [...document.querySelectorAll('.action-bar__buttons .button')].map((b) => Math.round(b.getBoundingClientRect().top));
  return { scrollH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
    barH: bar ? bar.height : 0, hudPosition: hud ? getComputedStyle(hud).position : '',
    buttonRows: new Set(buttons).size, markMid: mark ? (mark.top + mark.bottom) / 2 : null, textTop: text ? text.top : null, textBottom: text ? text.bottom : null };
}"""

CONTRAST = """() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  const p = document.createElement('p'); p.className = 'letter'; p.textContent = 'x'; document.body.appendChild(p);
  const style = getComputedStyle(p);
  const parse = (c) => c.match(/[\\d.]+/g).slice(0, 3).map(Number);
  const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const a = lum(parse(style.color)), b = lum(parse(style.backgroundColor));
  p.remove(); document.documentElement.removeAttribute('data-theme');
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}"""


ROAD_PROBE = """() => {
  const card = document.querySelector('[data-testid="margin-card"]');
  if (!card) return null;
  const box = card.getBoundingClientRect();
  const row = (id) => { const r = document.querySelector('[data-testid="' + id + '"]'); if (!r) return null;
    const track = r.querySelector('.margin__track').getBoundingClientRect(); const tick = r.querySelector('.margin__tick').getBoundingClientRect(); const fill = r.querySelector('.margin__fill').getBoundingClientRect();
    return { status: r.dataset.status, text: r.innerText.replace(/\\s+/g, ' ').trim(), aria: r.getAttribute('aria-label'), tickPos: (tick.left - track.left) / track.width, fillPos: fill.width / track.width }; };
  return { top: box.top, bottom: box.bottom, height: box.height, food: row('margin-food'), feed: row('margin-feed'), care: (document.querySelector('[data-testid="hud-party"]') || {}).innerText || '' };
}"""


def to_road(page):
    # Measure straight away, at the page's own scroll position: clicking Pause would scroll the page first.
    page.click('[data-testid="action-setout"]'); page.wait_for_timeout(500)


def main():
    save = subprocess.run(['node', 'tools/make-test-save.mjs', 'jalalabad'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    failures, errors = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for (w, h) in SIZES:
            page = browser.new_page(viewport={'width': w, 'height': h})
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(URL, wait_until='load'); page.wait_for_timeout(400)
            page.evaluate("(json) => Karvanyan.State.saveGame(JSON.parse(json), 4242)", save)
            page.reload(wait_until='load'); page.wait_for_timeout(400)
            page.click('[data-testid="title-continue"]'); page.wait_for_timeout(500)
            m = page.evaluate(PROBE); size = f'{w}x{h}'
            if m['scrollW'] > m['innerW']: failures.append(f'{size}: sideways scroll ({m["scrollW"]} > {m["innerW"]})')
            if m['buttonRows'] != 1: failures.append(f'{size}: action bar buttons wrap onto {m["buttonRows"]} rows')
            if m['markMid'] is not None and not (m['textTop'] - 2 <= m['markMid'] <= m['textBottom'] + 2): failures.append(f'{size}: readiness tick and text are on different lines')
            if w <= 700 and h <= 500 and m['hudPosition'] == 'sticky': failures.append(f'{size}: top bar still pinned on a short landscape screen')
            if w <= 700 and h > 500 and m['barH'] > 125: failures.append(f'{size}: action bar is {m["barH"]:.0f} px tall (budget 125)')
            if w <= 700 and h <= 500 and m['barH'] > 70: failures.append(f'{size}: action bar is {m["barH"]:.0f} px tall (budget 70)')
            if w <= 700 and h > 500 and m['scrollH'] > 2150: failures.append(f'{size}: Stop page is {m["scrollH"]} px tall (budget 2150)')
            print(f'{size:9} stop page {m["scrollH"]:5} px  action bar {m["barH"]:.0f} px  hud {m["hudPosition"]}')
            if (w, h) == (390, 844):
                ratio = page.evaluate(CONTRAST)
                print(f'          sealed letter contrast in night theme: {ratio:.2f}:1')
                if ratio < 4.5: failures.append(f'{size}: sealed letter contrast {ratio:.2f}:1 in night theme (need 4.5)')
            # Road screen: the margin card is the first block under the top bar, on the first screen.
            to_road(page)
            r = page.evaluate(ROAD_PROBE)
            if r is None: failures.append(f'{size}: no margin card on the road screen')
            else:
                if r['food']['status'] != 'ok' or r['feed']['status'] != 'ok': failures.append(f'{size}: well-stocked road should read ok, got {r["food"]["status"]}/{r["feed"]["status"]}')
                for key in ('food', 'feed'):
                    if not (0 <= r[key]['tickPos'] <= 1.01 and 0 <= r[key]['fillPos'] <= 1.01): failures.append(f'{size}: {key} bar maths out of range {r[key]}')
                    if 'need' not in r[key]['text'] or ('Enough' not in r[key]['text']): failures.append(f'{size}: {key} row text missing numbers or verdict: {r[key]["text"]}')
                if r['top'] < 0 or r['bottom'] > h: failures.append(f'{size}: margin card is not fully on the first screen (top {r["top"]:.0f}, bottom {r["bottom"]:.0f} > {h})')
                print(f'          road margin card: top {r["top"]:.0f} px, {r["height"]:.0f} px tall; food {r["food"]["text"]}')
            page.close()
        # A thin supply must read "Not enough" with its mark, and the HUD must flag the sick.
        thin = json.loads(save); thin_text = json.dumps(thin)
        page = browser.new_page(viewport={'width': 390, 'height': 844}); page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL, wait_until='load'); page.wait_for_timeout(400)
        page.evaluate("(json) => { const s = JSON.parse(json); s.supplies.rations = 6; s.party[0].illness = Object.keys(Karvanyan.Config.ILLNESSES)[0]; Karvanyan.State.saveGame(s, 4242); }", save)
        page.reload(wait_until='load'); page.wait_for_timeout(400)
        page.click('[data-testid="title-continue"]'); page.wait_for_timeout(500); to_road(page)
        r = page.evaluate(ROAD_PROBE)
        if r is None or r['food']['status'] not in ('short', 'tight'): failures.append(f'thin supply: expected short/tight, got {None if r is None else r["food"]["status"]}')
        else: print(f'          thin supply reads: {r["food"]["text"]}')
        if r is not None and r['food']['status'] == 'short' and '!!' not in r['food']['text']: failures.append('thin supply: "short" row has no mark')
        if r is not None and 'needs care' not in r['care']: failures.append(f'a sick member is not flagged in the top bar: {r["care"]!r}')
        elif r is not None: print(f'          top bar party chip: {r["care"]!r}'.replace(chr(10), ' '))
        page.close()
        browser.close()
    failures += [f'page error: {e}' for e in errors]
    if failures:
        print('\nFAIL'); [print(' -', f) for f in failures]; sys.exit(1)
    print('\nPASS: all layout budgets met')


main()
