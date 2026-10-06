"""Balance and soak bots.

Usage:
  python3 tools/bots/fuzz.py --url http://localhost:8080/baseline/ --policy careful --runs 40 --out docs/baseline-results/careful.json

Policies
  random   clicks any enabled button; waits on the road most of the time
  careful  steady pace, filling rations, buys food/fodder for the leg + 3 days,
           picks safe choices, rests the sick, sells at the end if it pays
  guide    careful + hires every guide it can afford
  hunt     careful + hunts once per leg (checks hunting is not a free food loop)
"""
import argparse
import csv
import json
import random
import re
import statistics as st
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
from harness import num, party_counts, run_one  # noqa: E402

# Ordered preferences for the careful bot. The first enabled match wins.
SAFE_PREFS = [
    r"^Show your farman", r"^Greet him in Pashto", r"^Pay the toll", r"^Haggle",
    r"^Cross the bridge of boats \(pay", r"^Hire the ferry", r"^Float across",
    r"^Use a medicine", r"^Rest for 2 days", r"^Buy oranges", r"^Eat from your own",
    r"^Pay them 50", r"^Hide your goods", r"^Fight them off", r"^Light big fires", r"^Boil it first",
    r"^Accept the trade", r"^Walk the garden", r"^Why is this street", r"^What will I find",
    r"^Are there ancient", r"^Go straight to the bazaar",
]
RISKY = re.compile(r"^(Refuse|Swim|Keep going|Drink it|Wait a day)")


def enabled(s):
    return [b for b in s["btns"] if not b["d"]]


def find(s, pattern):
    rx = re.compile(pattern)
    for b in enabled(s):
        if rx.search(b["t"]):
            return b["i"]
    return None


def policy_random(rng):
    def p(s, state):
        en = enabled(s)
        if s["hunt"]:
            prey = [b for b in en if b["c"].find("prey") >= 0]
            return rng.choice(prey)["i"] if prey and rng.random() < 0.5 else None
        on_road = any(b["t"].startswith(("⏸", "▶")) for b in s["btns"]) and not s["modal"]
        if on_road:
            # Mostly let the caravan travel; sometimes fiddle like a curious player.
            if rng.random() < 0.85:
                paused = any(b["t"].startswith("▶") for b in s["btns"])
                return find(s, r"^▶") if paused else None
        return rng.choice(en)["i"] if en else None
    return p


def policy_careful(guide=False, hunt=False):
    def p(s, state):
        en = enabled(s)
        if not en:
            return None
        h2, hud = s["h2"], s["hud"]
        if h2.startswith("Choose your journey"):
            names = [b for b in en if b["t"].startswith("Travel as the")]
            return names[state["merchant_idx"] % len(names)]["i"]
        if find(s, r"^Begin the journey") is not None:
            return find(s, r"^Begin the journey")
        if s["hunt"]:
            prey = [b for b in en if "prey" in b["c"]]
            return prey[0]["i"] if prey else None
        if s["modal"]:
            for rx in (r"^OK$", r"^Continue$"):
                i = find(s, rx)
                if i is not None:
                    return i
            return pick_safe(s)
        # Travel screen
        if any(b["t"].startswith("⏸") for b in s["btns"]):
            if hunt and not state.get("hunted_leg"):
                state["hunted_leg"] = True
                return find(s, r"Hunt")
            return None
        if any(b["t"].startswith("▶") for b in s["btns"]):
            return find(s, r"^▶")
        # Stop screen
        setout = find(s, r"^(Set out for|Finish the demo journey)")
        if setout is not None:
            return stop_logic(s, state, guide, setout)
        # Moment screen (or anything else): continue or choose safely
        i = find(s, r"^Continue$")
        return i if i is not None else pick_safe(s)
    return p


def pick_safe(s):
    for rx in SAFE_PREFS:
        i = find(s, rx)
        if i is not None:
            return i
    for b in enabled(s):
        if not RISKY.search(b["t"]):
            return b["i"]
    return enabled(s)[0]["i"]


def stop_logic(s, state, guide, setout):
    if state["stop"] != s["h2"]:
        state.update(stop=s["h2"], rests=0, hunted_leg=False)
    hud, text = s["hud"], s["text"]
    for label in ("Steady", "Filling"):
        b = next((b for b in s["btns"] if b["t"] == label), None)
        if b and "on" not in b["c"].split():
            return b["i"]
    alive, _ = party_counts(hud)
    animals = num(hud.get("animals"))
    food, fodder, money = num(hud.get("food")), num(hud.get("fodder")), num(hud.get("money"))
    m = re.search(r"about (\d+) days at", text)
    leg = int(m.group(1)) if m else 0
    final = find(s, r"^Finish the demo journey") is not None
    if final:
        m = re.search(r"(\d+) rupees a bundle", text)
        if m and int(m.group(1)) > 55:
            i = find(s, r"^Sell all")
            if i is not None:
                return i
        return setout
    need_food = alive * (leg + 3)
    need_fodder = animals * 0.5 * (leg + 3)
    if food < need_food:
        i = find(s, r"^Buy 20 food")
        if i is None and money < 40:
            i = find(s, r"^Sell 1 bundle")
        if i is not None:
            return i
    if fodder < need_fodder:
        i = find(s, r"^Buy 20 fodder")
        if i is not None:
            return i
    if num(hud.get("med")) < 2 and money > 160:
        i = find(s, r"^Buy 1 medicine")
        if i is not None:
            return i
    if guide:
        i = find(s, r"^Hire a local guide")
        if i is not None:
            return i
    weak = re.search(r"(Poor|Very poor|Dying|🤒)", text.split("Pace")[0])
    if weak and state["rests"] < 2:
        state["rests"] += 1
        return find(s, r"^Rest a day")
    return setout


def summarise(rows):
    wins = [r for r in rows if r["win"]]
    dead = [r for r in rows if not r["win"] and r["cause"] not in ("SOFTLOCK", "TIMEOUT")]
    out = {
        "runs": len(rows), "wins": len(wins), "win_rate": round(len(wins) / max(1, len(rows)), 3),
        "js_errors": sum(r["errors"] for r in rows),
        "softlocks": sum(r["cause"] == "SOFTLOCK" for r in rows),
        "timeouts": sum(r["cause"] == "TIMEOUT" for r in rows),
        "mean_win_days": round(st.mean([r["day"] for r in wins if r["day"]]), 1) if wins else None,
        "mean_win_score": round(st.mean([r["score"] for r in wins if r["score"]])) if wins else None,
        "mean_dead_score": round(st.mean([r["score"] for r in dead if r["score"]])) if dead else None,
        "death_causes": {}, "by_merchant": {},
    }
    for r in dead:
        out["death_causes"][r["cause"]] = out["death_causes"].get(r["cause"], 0) + 1
    for name in sorted({r["merchant"] for r in rows if r["merchant"]}):
        mr = [r for r in rows if r["merchant"] == name]
        mw = [r for r in mr if r["win"]]
        out["by_merchant"][name] = {
            "runs": len(mr), "win_rate": round(len(mw) / len(mr), 3),
            "mean_win_score": round(st.mean([r["score"] for r in mw if r["score"]])) if mw else None,
        }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8080/baseline/")
    ap.add_argument("--policy", choices=["random", "careful", "guide", "hunt"], default="careful")
    ap.add_argument("--runs", type=int, default=40)
    ap.add_argument("--seed0", type=int, default=1)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    rows = []
    t0 = time.time()
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for k in range(a.runs):
            seed = a.seed0 + k
            if a.policy == "random":
                pol = policy_random(random.Random(seed * 7919))
            else:
                pol = policy_careful(guide=a.policy == "guide", hunt=a.policy == "hunt")
            r = run_one(browser, a.url, pol, seed, merchant_idx=k)
            r["policy"] = a.policy
            rows.append(r)
            print(f"{a.policy} seed={seed} {r['merchant']}: win={r['win']} day={r['day']} "
                  f"score={r['score']} cause={r['cause']} err={r['errors']}", flush=True)
        browser.close()
    summary = summarise(rows)
    summary["policy"], summary["url"], summary["seconds"] = a.policy, a.url, round(time.time() - t0)
    print(json.dumps(summary, indent=2))
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps({"summary": summary, "runs": rows}, indent=2))
        with open(Path(a.out).with_suffix(".csv"), "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["policy", "seed", "merchant", "win", "day", "score", "cause", "errors", "steps"],
                               extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)


if __name__ == "__main__":
    main()
