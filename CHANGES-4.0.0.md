# 4.0.0 (built from the v4 Design, Build and QA Spec, on the 3.0.1 code)

## Shipped
- **F1-F12 fixes.** First-run load never above 85% (F3). Jettison drops the least important things first and greys out options that do nothing (F4). A blocked purchase offers sell-2-lots or buy-a-donkey on the spot (F5). Quit beacons by chapter and screen (F6). Fewer automatic sheets: only deaths and new illness interrupt, at most one a game day; the rest goes in the evening ledger (F7). No swim or ford at the Indus (F2). Toll flag fix. Plain-language copy with no game numbers (F10; enforced by the lint).
- **N1 one-screen start**, preselected safe party, Persian starts with an extra donkey, about four taps title to road.
- **N2 sealed letters** from Daulat Beg at six stops, re-readable from the Codex.
- **N3 once-only margin notes**, **N4 chapter-end screens** (six chapters, three lessons each; rating asked once, at the end of chapter 1).
- **N5 route strip** at the top of the stop and road screens; tap for the journey map (13 px labels).
- **N6 leg brief and readiness check** with one-tap fixes (food, feed, money).
- **N7 (lite)** evening ledger on the road screen: what was eaten, days of food left, the day's news.
- **Story:** the day-3 lame-camel crisis (four choices, spoken lines per companion role).
- **Save schema 3**; schema 2 (v3) saves load and continue.
- **Image loader** with canvas fallback, alt text for every id, `img/` folders and `img/README.md`.
- **Tools:** `tools/lint-content.mjs`, `tests/v4.test.mjs` (15 tests), `defaultHuman` bot in `tools/simulate.mjs`.

## Not shipped (spec allows N7-N10 to slip)
- **N8** companion moods and portraits, and the companion arcs. State fields exist (`story.companionMoodById`, `arcBeatsDoneById`), nothing reads them yet.
- **N9** rival caravan race. **N10** dated rumours. **N7** full ledger screen (only the lite ledger exists).
- **Images.** None shipped by design; v4.1.

## Balance against the spec gate (11.3), 60 runs per merchant, Node bots
| Gate | Target | Result |
| --- | --- | --- |
| careful bot wins | 55-70% | 68% (pass) |
| careful bot, last-leg deaths | under 15% | 24% (**fail**; Persian 8%, Yarkandi 45%) |
| random bot wins | under 5% | 0% (pass) |
| merchant order | Persian highest, Yarkandi lowest | pass |
| defaultHuman reaches Attock | at least 60% | 99% (pass) |
| defaultHuman wins | 15-30% | 50% (**fail**) |

The last-leg shortfall comes from an empty purse at Makhsusabad (cargo sold earlier, then hunger). The defaultHuman bot is a competent proxy, so real first-timers will win less, but the number has not been measured with people. Candidate levers for 4.1: a ferry or relief stop before the Padma, or purse relief at Makhsusabad.
