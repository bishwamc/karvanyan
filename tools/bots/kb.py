"""Keyboard probe for QA-001 (audit defect S1 / sprint D1).

For each trial: play with the careful bot until any modal opens, then use only
the keyboard. A trial FAILS if focus ever leaves the modal, if the background
changes while the modal is open, or if the modal can no longer be closed.

Usage: python3 tools/bots/kb.py --url http://localhost:8080/baseline/ --trials 6
"""
import argparse
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
from fuzz import policy_careful  # noqa: E402
from harness import CLICK_JS, SEED_SCRIPT, SNAP_JS  # noqa: E402

FOCUS_JS = r"""() => {
  const a = document.activeElement, ov = document.querySelector('#modalHost .overlay');
  return { inModal: !!(ov && a && ov.contains(a)), tag: a ? a.tagName : null,
           game: !!(a && a.closest && a.closest('#screen')),
           label: a ? (a.innerText || a.getAttribute('aria-label') || '').replace(/\s+/g,' ').slice(0,40) : '',
           modalOpen: !!ov };
}"""
BG_JS = "() => (document.querySelector('#screen')||{}).innerText || ''"


def trial(browser, url, seed, out_dir=None):
    ctx = browser.new_context(viewport={"width": 390, "height": 780})
    ctx.route(re.compile(r"^https?://(?!localhost|127\.0\.0\.1).*"), lambda r: r.abort())
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.clock.install()
    page.add_init_script(SEED_SCRIPT % seed)
    page.goto(url)
    pol = policy_careful()
    st = {"merchant_idx": seed, "seed": seed, "stop": None, "rests": 0}
    for _ in range(3000):
        s = page.evaluate(SNAP_JS)
        if s["modal"] and not s["hunt"]:
            break
        c = pol(s, st)
        if c is None:
            page.clock.run_for(1400)
        else:
            page.evaluate(CLICK_JS, c)
            page.clock.run_for(20)
    else:
        ctx.close()
        return {"seed": seed, "result": "NO_MODAL"}
    res = {"seed": seed, "modal": s["h2"], "focus_escaped": False, "escaped_to": None,
           "background_changed": False, "softlock": False}
    bg0 = page.evaluate(BG_JS)
    # 1. Tab and Shift-Tab around; record any escape of focus from the modal.
    for key in ["Tab"] * 30 + ["Shift+Tab"] * 30:
        page.keyboard.press(key)
        f = page.evaluate(FOCUS_JS)
        if f["modalOpen"] and not f["inModal"] and f["tag"] == "BUTTON":
            if not res["focus_escaped"]:
                res["focus_escaped"], res["escaped_to"] = True, f["label"]
            if f["game"]:
                # 2. The audit's S1 path: Enter on a game control behind the modal.
                res["escaped_to"] = f["label"]
                page.keyboard.press("Enter")
                page.clock.run_for(20)
                break
    if page.evaluate(BG_JS) != bg0 and page.evaluate(FOCUS_JS)["modalOpen"]:
        res["background_changed"] = True
    # 3. Try to close the modal: activate its first button, by keyboard where possible.
    closed = False
    for _ in range(8):
        f = page.evaluate(FOCUS_JS)
        if not f["modalOpen"]:
            closed = True
            break
        h_before = page.evaluate(SNAP_JS)["h2"] + page.evaluate(SNAP_JS)["text"][:200]
        page.evaluate("() => { const b = document.querySelector('#modalHost .overlay button:not([disabled])'); if (b) b.click(); }")
        page.clock.run_for(20)
        h_after = page.evaluate(SNAP_JS)["h2"] + page.evaluate(SNAP_JS)["text"][:200]
        if page.evaluate(FOCUS_JS)["modalOpen"] and h_after == h_before:
            res["softlock"] = True
            break
    res["closed"] = closed or not page.evaluate(FOCUS_JS)["modalOpen"]
    res["errors"] = errors[:3]
    res["result"] = "FAIL" if (res["focus_escaped"] or res["softlock"] or res["background_changed"]) else "PASS"
    if out_dir:
        page.screenshot(path=str(Path(out_dir) / f"kb-seed{seed}.png"))
    ctx.close()
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8080/baseline/")
    ap.add_argument("--trials", type=int, default=6)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        rows = [trial(b, a.url, seed) for seed in range(1, a.trials + 1)]
        b.close()
    for r in rows:
        print(json.dumps(r))
    fails = sum(r["result"] == "FAIL" for r in rows)
    locks = sum(bool(r.get("softlock")) for r in rows)
    summary = {"trials": len(rows), "fail": fails, "softlocks": locks, "url": a.url}
    print(json.dumps(summary))
    if a.out:
        Path(a.out).write_text(json.dumps({"summary": summary, "trials": rows}, indent=2))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
