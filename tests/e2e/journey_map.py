"""
Browser test: the journey map opens in the real game when the caravan enters a new region
(from a stop) and when the run ends. Needs Python Playwright and the game served over HTTP.

Usage (from the project folder):
  python3 -m http.server 8099 &
  python3 tests/e2e/journey_map.py jhelum "You enter"        # crosses into Punjab at Gujrat
  python3 tests/e2e/journey_map.py makhsusabad "How far"      # run ends near Dhaka
Set KARVANYAN_URL to test another address. Exits 1 if the map does not appear.
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

URL = os.environ.get('KARVANYAN_URL', 'http://localhost:8099/index.html')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def main(stop_id, expected_title):
    save = subprocess.run(['node', 'tools/make-test-save.mjs', stop_id], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 390, 'height': 780})
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
        page.goto(URL, wait_until='load')
        page.wait_for_timeout(800)
        page.evaluate("(json) => Karvanyan.State.saveGame(JSON.parse(json), 4242)", save)
        page.reload(wait_until='load')
        page.wait_for_timeout(800)
        page.click('[data-testid="title-continue"]')
        page.wait_for_timeout(800)
        page.click('[data-testid="action-setout"]')

        started = time.time(); sheet_text = None
        dialog_buttons = ('#modal-root button[data-testid^="modal-choice"], #modal-root button[data-testid^="moment-choice"], '
                          '#modal-root button[data-testid="modal-continue"], #modal-root button[data-testid="moment-continue"], '
                          '#modal-root button[data-testid="report-close"]')
        while time.time() - started < 300:
            if page.locator('[data-testid="journey-map-sheet"]').count() > 0:
                sheet_text = page.locator('[data-testid="journey-map-sheet"]').inner_text()
                break
            button = page.locator(dialog_buttons)
            if button.count() > 0:
                try:
                    button.first.evaluate('element => element.click()')
                except Exception:
                    page.wait_for_timeout(300)
            page.wait_for_timeout(400)
        elapsed = round(time.time() - started, 1)

        ok = sheet_text is not None and expected_title in sheet_text
        print(f'map appeared: {sheet_text is not None} after {elapsed}s')
        if sheet_text:
            print('sheet text:', sheet_text.replace('\n', ' | ')[:160])
            page.click('[data-testid="journey-map-continue"]')
            page.wait_for_timeout(300)
            print('closed cleanly:', page.locator('[data-testid="journey-map-sheet"]').count() == 0)
        print('console and page errors:', errors if errors else 'none')
        browser.close()
    if not ok or errors:
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
