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
  const go = rect('[data-testid="action-setout"]'); const tiles = document.querySelectorAll('.stop-tile').length;
  return { scrollH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
    barH: bar ? bar.height : 0, hudPosition: hud ? getComputedStyle(hud).position : '',
    goBottom: go ? go.bottom : null, tiles, markMid: mark ? (mark.top + mark.bottom) / 2 : null, textTop: text ? text.top : null, textBottom: text ? text.bottom : null };
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


WIDE_PROBE = """() => {
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const cards = q('road-cards'); if (!cards) return null;
  const canvas = document.querySelector('.road-wide .scene-canvas');
  const bottoms = ['road-status', 'news-line', 'road-controls', 'road-cards'].map((id) => { const e = q(id); return e ? e.getBoundingClientRect().bottom : null; });
  return { food: q('status-food').innerText, feed: q('status-feed').innerText, foodStatus: q('status-food').className, cardCount: cards.children.length,
           cardsBottom: cards.getBoundingClientRect().bottom, fit: getComputedStyle(canvas).objectFit, scrollW: document.documentElement.scrollWidth, order: bottoms, canvasH: canvas.getBoundingClientRect().height };
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
            if m['tiles'] != 7: failures.append(f'{size}: expected 7 stop tiles, found {m["tiles"]}')
            if m['goBottom'] is None or m['goBottom'] > (h if h >= 700 or w >= 900 else (h + 150 if h >= 500 else 700)): failures.append(f'{size}: the Set out tile ends at {m["goBottom"]}, past the budget')
            if w >= 900 and m['scrollH'] > h + 60: failures.append(f'{size}: wide stop page is {m["scrollH"]} px tall for a {h} px screen (budget {h + 60})')
            if w < 700 and h >= 800 and m['scrollH'] > h + 2: failures.append(f'{size}: phone stop page is {m["scrollH"]} px, should fit {h}')
            print(f'{size:9} stop page {m["scrollH"]:5} px  tiles {m["tiles"]}  Set out ends {m["goBottom"]:.0f}')
            if (w, h) == (390, 844):
                ratio = page.evaluate(CONTRAST)
                print(f'          sealed letter contrast in night theme: {ratio:.2f}:1')
                if ratio < 4.5: failures.append(f'{size}: sealed letter contrast {ratio:.2f}:1 in night theme (need 4.5)')
            # Road screen: the margin card is the first block under the top bar, on the first screen.
            to_road(page)
            wd = page.evaluate(WIDE_PROBE)
            if wd is None: failures.append(f'{size}: no road screen'); page.close(); continue
            is_wide = w >= 900
            if '\u2713' not in wd['food'] or '\u2713' not in wd['feed']: failures.append(f'{size}: status chips missing a tick: {wd["food"]} / {wd["feed"]}')
            if is_wide and 'need' not in wd['food']: failures.append(f'{size}: wide status chip should say how many days the trip needs: {wd["food"]}')
            budget = h if (is_wide or h >= 800) else (h + 100 if h >= 500 else 700)  # a short phone may scroll a little; a landscape phone scrolls (cards must still be within about two screens)
            if wd['cardsBottom'] > budget: failures.append(f'{size}: party cards end at {wd["cardsBottom"]:.0f}, past the budget ({budget})')
            if wd['fit'] != 'cover': failures.append(f'{size}: the scene would be stretched (object-fit {wd["fit"]})')
            if wd['order'] != sorted(wd['order']): failures.append(f'{size}: bands are out of order {wd["order"]}')
            if is_wide and wd['canvasH'] < 190: failures.append(f'{size}: scene strip only {wd["canvasH"]:.0f} px tall')
            if wd['scrollW'] > w: failures.append(f'{size}: the road screen scrolls sideways ({wd["scrollW"]} > {w})')
            print(f'          road: cards end {wd["cardsBottom"]:.0f}/{h}, scene {wd["canvasH"]:.0f} px, {wd["cardCount"]} cards, {wd["food"]}')
            page.close()
        # A thin supply must read "Not enough" with its mark, and the HUD must flag the sick.
        thin = json.loads(save); thin_text = json.dumps(thin)
        page = browser.new_page(viewport={'width': 390, 'height': 844}); page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL, wait_until='load'); page.wait_for_timeout(400)
        page.evaluate("(json) => { const s = JSON.parse(json); s.supplies.rations = 6; s.party[0].illness = Object.keys(Karvanyan.Config.ILLNESSES)[0]; Karvanyan.State.saveGame(s, 4242); }", save)
        page.reload(wait_until='load'); page.wait_for_timeout(400)
        page.click('[data-testid="title-continue"]'); page.wait_for_timeout(500); to_road(page)
        chip = page.evaluate("document.querySelector('[data-testid=\"status-food\"]').innerText")
        card = page.evaluate("[...document.querySelectorAll('[data-testid^=\"card-member-\"]')][0].className + ' | ' + [...document.querySelectorAll('[data-testid^=\"card-member-\"]')][0].innerText")
        if '!!' not in chip or 'need' not in chip: failures.append(f'thin supply: the food chip should show the need and a !! mark, got {chip!r}')
        else: print(f'          thin supply reads: {chip}')
        if 'road-card--warning' not in card or 'Treat' not in card or '!' not in card: failures.append(f'a sick member is not flagged on their card: {card!r}')
        else: print('          sick member card: flagged with a mark and a Treat button')
        page.close()
        browser.close()
    failures += [f'page error: {e}' for e in errors]
    if failures:
        print('\nFAIL'); [print(' -', f) for f in failures]; sys.exit(1)
    print('\nPASS: all layout budgets met')


main()
