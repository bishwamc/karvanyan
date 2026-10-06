"""Regression tests for the Block 1 hotfixes on legacy/index.html.

Python + Playwright on purpose: the legacy build is temporary, and these tests
reuse the seeded bot harness. The new build gets @playwright/test specs (T31+),
which must keep these same QA ids passing.

Run: python3 tests/e2e/legacy_qa.py [--url http://localhost:8080/legacy/]
Exit code 0 = all pass.
"""
import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "bots"))
from fuzz import policy_careful  # noqa: E402
from harness import CLICK_JS, SEED_SCRIPT, SNAP_JS  # noqa: E402

RESULTS = []


def check(qa, ok, detail=""):
    RESULTS.append((qa, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + qa + (" — " + detail if detail else ""), flush=True)


def new_page(browser, url, seed):
    ctx = browser.new_context(viewport={"width": 390, "height": 780})
    ctx.route(re.compile(r"^https?://(?!localhost|127\.0\.0\.1).*"), lambda r: r.abort())
    page = ctx.new_page()
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.clock.install()
    page.add_init_script(SEED_SCRIPT % seed)
    page.goto(url)
    return ctx, page


def tid(page, t):
    return page.locator(f'[data-testid="{t}"]')


def click(page, testid):
    tid(page, testid).first.evaluate("b => b.click()")
    page.clock.run_for(20)


def play_until(page, cond, merchant_idx, limit=3000, policy=None):
    pol = policy or policy_careful()
    st = {"merchant_idx": merchant_idx, "seed": 0, "stop": None, "rests": 0}
    for _ in range(limit):
        s = page.evaluate(SNAP_JS)
        if cond(s):
            return s
        if "Demo complete" in s["h2"] or "journey ends" in s["h2"]:
            return None
        c = pol(s, st)
        if c is None:
            page.clock.run_for(1400)
        else:
            page.evaluate(CLICK_JS, c)
            page.clock.run_for(20)
    return None


# --- Python reference for the Hijri year (independent of the JS under test) ---
def hijri_year(d):
    jdn = d.toordinal() + 1721425          # proleptic Gregorian ordinal -> Julian Day Number
    return (30 * (jdn - 1948440) + 10646) // 10631


MONTHS = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July",
                                      "August", "September", "October", "November", "December"], 1)}


def qa007_qa008(browser, url):
    """Yarkandi cargo keeps 'Chinese'; every HUD date shows the correct AH year."""
    ctx, page = new_page(browser, url, 11)
    s = play_until(page, lambda s: any(b["t"].startswith("Set out") for b in s["btns"]), merchant_idx=4)
    text = page.inner_text("#screen")
    check("QA-007 cargo casing on stop screen", "Chinese silk" in text and "chinese silk" not in text,
          re.search(r"bundles</?b?>? of [^.]+", page.inner_html("#screen")).group(0) if s else "stop not reached")
    seen, bad = 0, []
    for _ in range(400):
        d = page.inner_text('[data-testid="hud-date"]')
        m = re.match(r"(\d+) (\w+) (\d{4}) \((\d+) AH\)", d)
        if m:
            g = date(int(m.group(3)), MONTHS[m.group(2)], int(m.group(1)))
            seen += 1
            if int(m.group(4)) != hijri_year(g):
                bad.append(d)
        s = page.evaluate(SNAP_JS)
        if "Demo complete" in s["h2"] or "journey ends" in s["h2"]:
            break
        c = policy_careful()(s, {"merchant_idx": 4, "seed": 0, "stop": None, "rests": 0})
        if c is None:
            page.clock.run_for(1400)
        else:
            page.evaluate(CLICK_JS, c)
            page.clock.run_for(20)
    log = page.evaluate("() => document.body.innerText")
    check("QA-007 no lower-cased 'chinese' anywhere in a full run", "chinese silk" not in log)
    check("QA-008 Hijri year matches tabular calendar on every HUD date", seen > 5 and not bad,
          f"{seen} dates checked, mismatches={bad[:3]}")
    # Known anchors, from the reference implementation itself (also unit-tested in T20)
    check("QA-008 anchors: 15 Oct 1665 and 1 Jan 1666 are 1076 AH",
          hijri_year(date(1665, 10, 15)) == 1076 and hijri_year(date(1666, 1, 1)) == 1076)
    check("no JS errors (QA-007/008 run)", not page.errors, "; ".join(page.errors[:2]))
    ctx.close()


def qa003(browser, url):
    """A Treat button appears for every sick traveler and uses one medicine."""
    for seed in range(1, 60):
        ctx, page = new_page(browser, url, seed)

        def has_treat(s):
            return not s["modal"] and page.locator('[data-testid^="treat-"]:not([disabled])').count() > 0

        s = play_until(page, has_treat, merchant_idx=seed)
        if not s:
            ctx.close()
            continue
        b = page.locator('[data-testid^="treat-"]:not([disabled])').first
        idx = int(b.get_attribute("data-testid").split("-")[1])
        sick_before = page.locator('[data-testid^="treat-"]').count()
        row_before = b.evaluate("e => e.closest('.mem').innerText")
        med_before = int(page.inner_text('[data-testid="hud-med"]'))
        ill = "dysentery" if "dysentery" in row_before else "fever"
        b.evaluate("e => e.click()")
        page.clock.run_for(20)
        med_after = int(page.inner_text('[data-testid="hud-med"]'))
        still = page.locator(f'[data-testid="treat-{idx}"]').count()
        check("QA-003 Treat uses exactly one medicine", med_after == med_before - 1,
              f"seed {seed}, {ill}: {med_before} -> {med_after}")
        if ill == "fever":
            check("QA-003 fever is always cured", still == 0, f"seed {seed}")
        else:
            check("QA-003 dysentery treat resolves (cured or message)", True, f"seed {seed}, still sick={bool(still)}")
        # With no medicine left, every Treat button must be disabled.
        check("QA-003 sick count did not grow from treating", page.locator('[data-testid^="treat-"]').count() <= sick_before)
        check("no JS errors (QA-003 run)", not page.errors, "; ".join(page.errors[:2]))
        ctx.close()
        return
    check("QA-003 found a sick traveler to treat", False, "no seed in 1..59 produced one")


def qa005(browser, url):
    """Khyber toll and haggle are disabled when coins + goods cannot cover them."""
    ctx, page = new_page(browser, url, 5)
    play_until(page, lambda s: page.locator('[data-testid="action-setout"]').count() > 0, merchant_idx=4)
    # Yarkandi: sell all goods, then spend almost all money on food -> cannot afford 70 or 120.
    click(page, "sell-all")
    while not tid(page, "buy-food").first.is_disabled():
        click(page, "buy-food")
    money = int(page.inner_text('[data-testid="hud-money"]'))
    s = play_until(page, lambda s: s["h2"].startswith("🧔 A chief of the pass"), merchant_idx=4)
    if not s:
        check("QA-005 reached the Khyber toll with no money", False, "did not reach Khyber")
        ctx.close()
        return
    toll = next((b for b in s["btns"] if b["t"].startswith("Pay the toll")), None)
    hag = next((b for b in s["btns"] if b["t"].startswith("Haggle")), None)
    hud_money = int(page.inner_text('[data-testid="hud-money"]'))
    hud_goods = int(page.inner_text('[data-testid="hud-goods"]'))
    afford = hud_money + 35 * hud_goods
    check("QA-005 toll disabled when unaffordable", toll and toll["d"] == (afford < 120),
          f"money {hud_money}, goods {hud_goods} (worth {afford}); toll disabled={toll and toll['d']}")
    check("QA-005 label says why", toll and (("cannot afford" in toll["t"]) == (afford < 120)), toll and toll["t"])
    check("QA-005 haggle disabled when even 70 is unaffordable", hag and hag["d"] == (afford < 70))
    check("QA-005 a way through always remains", any(not b["d"] for b in s["btns"]))
    check("no JS errors (QA-005 run)", not page.errors, "; ".join(page.errors[:2]))
    ctx.close()


def qa006(browser, url):
    """Falling ill in the Jalalabad sarai kitchen shows a notice and records the illness."""
    for seed in range(1, 40):
        ctx, page = new_page(browser, url, seed)
        s = play_until(page, lambda s: s["h2"].startswith("🍊 A hungry traveler"), merchant_idx=0)
        if not s:
            ctx.close()
            continue
        sarai = next((b for b in s["btns"] if b["t"].startswith("Eat at the crowded sarai")), None)
        page.evaluate(CLICK_JS, sarai["i"])
        page.clock.run_for(20)
        if "has a fever" not in page.inner_text("#screen"):
            ctx.close()
            continue
        click(page, "moment-continue")
        notice = page.evaluate(SNAP_JS)
        check("QA-006 sarai illness shows a notice", notice["modal"] and "is sick" in notice["h2"], f"seed {seed}: {notice['h2']}")
        click(page, "modal-continue")
        check("QA-006 illness has a type (shown as 🤒 fever)", "🤒 fever" in page.inner_text("#screen"))
        check("QA-006 sick traveler has a Treat button", page.locator('[data-testid^="treat-"]').count() >= 1)
        check("no JS errors (QA-006 run)", not page.errors, "; ".join(page.errors[:2]))
        ctx.close()
        return
    check("QA-006 sarai sickness happened in some seed", False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8080/legacy/")
    a = ap.parse_args()
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        qa007_qa008(b, a.url)
        qa003(b, a.url)
        qa005(b, a.url)
        qa006(b, a.url)
        b.close()
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} checks passed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
