"""Viewport probe for QA-002 (no sideways scroll, no clipped buttons) and a
measurement for QA-011 (how far down the "Set out" button sits).

Usage: python3 tools/bots/mob.py --url http://localhost:8080/baseline/ --shots docs/baseline-results/shots
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

VIEWPORTS = [(320, 640), (360, 740), (390, 780), (768, 1024), (667, 375)]

MEASURE_JS = r"""() => {
  const W = window.innerWidth;
  const clipped = [...document.querySelectorAll('button, input, h1, h2, .node span')]
    .filter(e => e.getClientRects().length)
    .map(e => ({ t: (e.innerText || e.value || '').replace(/\s+/g, ' ').slice(0, 30), r: e.getBoundingClientRect() }))
    .filter(x => x.r.right > W + 1 || x.r.left < -1)
    .map(x => ({ t: x.t, left: Math.round(x.r.left), right: Math.round(x.r.right) }));
  const setout = [...document.querySelectorAll('button')].find(b => /^Set out|Set out ▶/.test(b.innerText.trim()));
  const sr = setout ? setout.getBoundingClientRect() : null;
  return { innerWidth: W, scrollWidth: document.documentElement.scrollWidth, clipped,
           setoutTop: sr ? Math.round(sr.top + window.scrollY) : null, innerHeight: window.innerHeight };
}"""


def reach(page, want, seed=3, limit=600):
    pol = policy_careful()
    st = {"merchant_idx": 4, "seed": seed, "stop": None, "rests": 0}
    for _ in range(limit):
        s = page.evaluate(SNAP_JS)
        if want(s):
            return s
        c = pol(s, st)
        if c is None:
            page.clock.run_for(1400)
        else:
            page.evaluate(CLICK_JS, c)
            page.clock.run_for(20)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8080/baseline/")
    ap.add_argument("--shots", default=None)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    if a.shots:
        Path(a.shots).mkdir(parents=True, exist_ok=True)
    rows = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for w, h in VIEWPORTS:
            ctx = b.new_context(viewport={"width": w, "height": h})
            ctx.route(re.compile(r"^https?://(?!localhost|127\.0\.0\.1).*"), lambda r: r.abort())
            page = ctx.new_page()
            page.clock.install()
            page.add_init_script(SEED_SCRIPT % 3)
            page.goto(a.url)
            screens = {
                "title": lambda s: s["h2"].startswith("Choose your journey"),
                "stop": lambda s: any(x["t"].startswith("Set out") for x in s["btns"]),
                "travel": lambda s: any(x["t"].startswith(("⏸", "▶")) for x in s["btns"]) and not s["modal"],
            }
            for name, want in screens.items():
                if reach(page, want) is None:
                    rows.append({"viewport": f"{w}x{h}", "screen": name, "result": "NOT_REACHED"})
                    continue
                m = page.evaluate(MEASURE_JS)
                ok = m["scrollWidth"] <= m["innerWidth"] and not m["clipped"]
                row = {"viewport": f"{w}x{h}", "screen": name, "result": "PASS" if ok else "FAIL", **m}
                if m["setoutTop"] is not None:
                    row["setout_screens_down"] = round(m["setoutTop"] / m["innerHeight"], 2)
                rows.append(row)
                if a.shots:
                    page.screenshot(path=f"{a.shots}/{name}-{w}x{h}.png", full_page=True)
                if name == "stop":
                    # leave the stop so the travel screen can be reached
                    pass
            ctx.close()
        b.close()
    for r in rows:
        print(json.dumps(r))
    fails = sum(r["result"] != "PASS" for r in rows)
    print(json.dumps({"checks": len(rows), "fail": fails}))
    if a.out:
        Path(a.out).write_text(json.dumps(rows, indent=2))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
