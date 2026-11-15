"""
Browser test: layout budgets for the Stop and Road screens (v4.0.1 CSS hotfix).
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
            page.close()
        browser.close()
    failures += [f'page error: {e}' for e in errors]
    if failures:
        print('\nFAIL'); [print(' -', f) for f in failures]; sys.exit(1)
    print('\nPASS: all layout budgets met')


main()
