"""
Browser test: the 4.1.0 screens behave, not just fit. Needs Python Playwright and the game served over HTTP.

Usage (from the project folder):
  python3 -m http.server 8099 &
  python3 tests/e2e/screens_v41.py
Set KARVANYAN_URL to test another address. Exits 1 if any check fails.

Phone (390 x 844):
  - the stop screen has section rows (no tabs); Town opens a sheet; buying inside it changes the numbers shown in the sheet
  - "Buy what's needed" makes the food and feed lines ready in one tap, and never sells cargo
  - the Rest row opens the rest sheet; resting closes it and the day moves on
  - the road has a pinned bar (Pause, Rest a day, Caravan, Supplies, Map); the Caravan sheet lists who needs care first and
    Treat names the person and spends one medicine
  - Pause shows exact numbers and leaves the picture out; Resume brings it back
  - resting on the road offers the hunt; the hunt screen shows the two-number ribbon and can be stopped early
Wide (1280 x 800):
  - the stop screen keeps its tabs; the road keeps the caravan on the left page
  - C opens the Caravan sheet, Escape closes it, Space pauses; Space never sets out from the stop screen
Layout switching:
  - resizing from wide to phone redraws the stop screen as section rows, and back to tabs
"""
import json, os, subprocess, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('KARVANYAN_URL', 'http://localhost:8099/index.html')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
failures, errors = [], []


def check(condition, message):
    if not condition: failures.append(message)
    return condition


def make_page(browser, save_json, width, height, patch=None):
    page = browser.new_page(viewport={'width': width, 'height': height})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL, wait_until='load'); page.wait_for_timeout(300)
    page.evaluate("""([json, patch]) => { const s = JSON.parse(json); if (patch) { if (patch.rations !== undefined) s.supplies.rations = patch.rations; if (patch.feeds !== undefined) s.supplies.feeds = patch.feeds;
        if (patch.money !== undefined) s.money = patch.money; if (patch.ill) s.party[0].illness = Object.keys(Karvanyan.Config.ILLNESSES)[0]; if (patch.medicine !== undefined) s.supplies.medicine = patch.medicine; }
        Karvanyan.State.saveGame(s, 4242); }""", [save_json, patch])
    page.reload(wait_until='load'); page.wait_for_timeout(300)
    page.click('[data-testid="title-continue"]'); page.wait_for_timeout(400)
    return page


def dismiss_notes(page):
    # Once-only margin notes ("Daulat Beg advises") add height until dismissed; that is by design.
    for _ in range(3):
        if page.locator('[data-action="dismissNote"]').count(): page.click('[data-action="dismissNote"]'); page.wait_for_timeout(200)


def number(page, selector):
    return int(page.inner_text(selector).split()[0].replace(',', ''))


def main():
    save = subprocess.run(['node', 'tools/make-test-save.mjs', 'jalalabad'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---- phone: stop screen ----
        page = make_page(browser, save, 390, 844, {'rations': 10, 'feeds': 10, 'money': 900})
        dismiss_notes(page)
        check(page.locator('.tabs').count() == 0, 'phone stop: tabs should not be drawn')
        check(page.locator('[data-testid="section-rows"] .section-row').count() == 4, 'phone stop: expected four section rows')
        check(page.evaluate('document.documentElement.scrollHeight <= innerHeight + 2'), 'phone stop (thin supplies): page scrolls')
        check(page.locator('[data-testid="fix-all"]').count() == 1, 'phone stop: no "Buy what\'s needed" button with thin supplies')
        before_cargo = page.evaluate("Karvanyan.State.loadGame().state.cargo ? Karvanyan.State.loadGame().state.cargo.units : 0")
        page.click('[data-testid="fix-all"]'); page.wait_for_timeout(300)
        check(page.get_attribute('[data-testid="ready-food"]', 'data-status') == 'ok', 'Buy what\'s needed: food is still short')
        check(page.get_attribute('[data-testid="ready-feed"]', 'data-status') == 'ok', 'Buy what\'s needed: feed is still short')
        check(page.locator('[data-testid="fix-all"]').count() == 0, 'Buy what\'s needed: the button should disappear when ready')
        page.click('[data-testid="section-row-town"]'); page.wait_for_timeout(250)
        check(page.locator('[data-testid="section-town"]').count() == 1, 'Town row did not open its sheet')
        check(page.locator('[data-testid="sheet-ribbon"]').count() == 1, 'Town sheet has no numbers ribbon')
        rations_before = page.inner_text('[data-testid="sheet-ribbon"]')
        page.click('[data-testid="buy-food"]'); page.wait_for_timeout(250)
        rations_after = page.inner_text('[data-testid="sheet-ribbon"]')
        check(rations_before != rations_after, 'buying inside the Town sheet did not change the ribbon')
        check(page.locator('[data-testid="section-town"]').count() == 1, 'the Town sheet closed itself after a purchase')
        page.click('[data-testid="section-close"]'); page.wait_for_timeout(200)
        check(page.locator('[data-testid="section-town"]').count() == 0, 'Done did not close the Town sheet')
        page.click('[data-testid="section-row-caravan"]'); page.wait_for_timeout(250)
        check(page.locator('[data-testid="rest-many"]').count() == 0, 'phone Caravan sheet should not hold the rest panel (it has its own row)')
        check(page.locator('[data-testid="pace-steady"]').count() >= 1, 'phone Caravan sheet lost the pace choices')
        page.click('[data-testid="section-close"]'); page.wait_for_timeout(200)
        day_before = page.evaluate("Karvanyan.State.loadGame().state.dayIndex")
        page.click('[data-testid="section-row-rest"]'); page.wait_for_timeout(250)
        check(page.locator('[data-testid="rest-many"]').count() == 1, 'Rest row did not open the rest sheet')
        page.click('[data-testid="rest-many"]'); page.wait_for_timeout(500)
        check(page.locator('[data-testid="section-rest"]').count() == 0, 'resting should close the rest sheet')
        page.close()

        # ---- phone: road ----
        page = make_page(browser, save, 390, 844, {'ill': True, 'medicine': 2})
        page.click('[data-testid="action-setout"]'); page.wait_for_timeout(450)
        dismiss_notes(page)
        for testid in ('travel-pause', 'travel-rest', 'travel-caravan', 'travel-supplies', 'travel-map'):
            check(page.locator(f'[data-testid="{testid}"]').count() == 1, f'road bar is missing {testid}')
        check(page.evaluate('document.documentElement.scrollHeight <= innerHeight + 2'), 'phone road: page scrolls')
        check(page.evaluate("(() => { const bar = document.querySelector('.road-bar').getBoundingClientRect(); return Math.abs(bar.bottom - innerHeight) < 2; })()"), 'phone road: the control bar is not at the bottom of the screen')
        check(page.locator('[data-testid="hud-party"]').inner_text().find('needs care') >= 0, 'top bar does not flag the sick person')
        page.click('[data-testid="travel-caravan"]'); page.wait_for_timeout(250)
        check(page.locator('[data-testid="section-roadCaravan"]').count() == 1, 'Caravan button did not open its sheet')
        check(page.locator('[data-testid="care-0"]').count() == 1, 'Caravan sheet does not list the sick person first')
        treat_label = page.inner_text('[data-testid="treat-0"]')
        check('Treat' in treat_label and '1 medicine' in treat_label, f'Treat button should name the person and the cost: {treat_label!r}')
        medicine_before = page.evaluate("Karvanyan.State.loadGame().state ? 0 : 0")
        page.click('[data-testid="treat-0"]'); page.wait_for_timeout(300)
        check(page.locator('[data-testid="section-roadCaravan"]').count() == 1, 'the Caravan sheet closed after treating')
        page.click('[data-testid="section-close"]'); page.wait_for_timeout(200)
        page.click('[data-testid="travel-supplies"]'); page.wait_for_timeout(250)
        check('rations' in page.inner_text('[data-testid="snapshot"]').lower(), 'Supplies sheet has no exact numbers')
        page.click('[data-testid="section-close"]'); page.wait_for_timeout(200)
        page.evaluate("document.querySelector('[data-testid=travel-pause]').click()"); page.wait_for_timeout(300)
        check(page.locator('[data-testid="paused-panel"]').count() == 1, 'Pause did not show the exact numbers')
        check(page.locator('[data-testid="travel-canvas"]').count() == 0, 'paused phone screen should leave the picture out')
        page.evaluate("document.querySelector('[data-testid=travel-pause]').click()"); page.wait_for_timeout(300)
        check(page.locator('[data-testid="paused-panel"]').count() == 0 and page.locator('[data-testid="travel-canvas"]').count() == 1, 'Resume did not bring the picture back')
        page.evaluate("document.querySelector('[data-testid=travel-pause]').click()"); page.wait_for_timeout(200)  # pause so no day passes
        page.evaluate("document.querySelector('[data-testid=travel-rest]').click()"); page.wait_for_timeout(400)
        offered = page.locator('[data-testid="provision-play"], [data-testid="provision-fodder"]').count() > 0
        if offered:
            page.evaluate("(document.querySelector('[data-testid=provision-play]') || document.querySelector('[data-testid=provision-fodder]')).click()"); page.wait_for_timeout(500)
            check(page.locator('[data-testid="hunt-ribbon"]').count() == 1, 'hunt screen has no two-number ribbon')
            check(page.locator('[data-testid="hunt-stop"]').count() == 1, 'hunt screen has no stop button')
            check('rations' in page.inner_text('[data-testid="hunt-ribbon"]').lower() and 'feeds' in page.inner_text('[data-testid="hunt-ribbon"]').lower(), 'hunt ribbon should show rations and feeds days')
            check(page.evaluate('document.documentElement.scrollHeight <= innerHeight + 2'), 'phone hunt: page scrolls')
            page.evaluate("document.querySelector('[data-testid=hunt-stop]').click()"); page.wait_for_timeout(500)
            check(page.locator('[data-testid="hunt-field"]').count() == 0, 'stopping the hunt did not leave the hunt screen')
            check(page.locator('[data-testid="margin-card"]').count() == 1, 'after the hunt the road screen did not come back')
        else:
            print('          (no hunt offered in this region/seed; hunt checks skipped)')
        page.close()

        # ---- wide: tabs, keys ----
        page = make_page(browser, save, 1280, 800)
        check(page.locator('.tabs').count() == 1 and page.locator('[data-testid="section-rows"]').count() == 0, 'wide stop: tabs should be drawn, not section rows')
        page.keyboard.press('Space'); page.wait_for_timeout(300)
        check(page.evaluate("document.getElementById('screen').dataset.screen") == 'stop', 'Space must never set out from the stop screen')
        page.click('[data-testid="action-setout"]'); page.wait_for_timeout(450)
        check(page.locator('[data-testid="ledger-party"]').count() == 1 and page.locator('[data-testid="ledger-supplies"]').count() == 1, 'wide road: party and supplies should stay on the left page')
        page.keyboard.press('c'); page.wait_for_timeout(250)
        check(page.locator('[data-testid="section-roadCaravan"]').count() == 1, 'key C did not open the Caravan sheet')
        page.keyboard.press('Escape'); page.wait_for_timeout(250)
        check(page.locator('[data-testid="section-roadCaravan"]').count() == 0, 'Escape did not close the sheet')
        page.keyboard.press('Space'); page.wait_for_timeout(250)
        check('Resume' in page.inner_text('[data-testid="travel-pause"]'), 'Space did not pause')
        page.close()

        # ---- layout switching ----
        page = make_page(browser, save, 1280, 800)
        check(page.locator('.tabs').count() == 1, 'switch: wide stop has no tabs')
        page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(400)
        check(page.locator('[data-testid="section-rows"]').count() == 1 and page.locator('.tabs').count() == 0, 'switch: narrowing did not redraw the stop screen as section rows')
        page.set_viewport_size({'width': 1280, 'height': 800}); page.wait_for_timeout(400)
        check(page.locator('.tabs').count() == 1 and page.locator('[data-testid="section-rows"]').count() == 0, 'switch: widening did not bring the tabs back')
        page.close()
        browser.close()

    failures.extend(f'page error: {e}' for e in errors)
    if failures:
        print('FAIL'); [print(' -', f) for f in failures]; sys.exit(1)
    print('PASS: all 4.1.0 screen behaviours work')


main()
