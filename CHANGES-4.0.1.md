# 4.0.1 (UI overhaul, Phase 1: CSS-only hotfix on the 4.0.0 code)

No change to markup, game rules, saves or content. All CSS edits are one block at the end of `css/style.css`
("v4.0.1 hotfix"); delete that block to undo them. `index.html` only changes the `?v=` cache-busting number on the two stylesheets.

## Fixed
- **Sealed letter unreadable in the night theme.** It had a fixed pale paper but inherited cream text: contrast 1.13:1. Now 14.4:1.
- **Action bar wrapped to two rows on phones** (Map dropped onto its own line): 152 px tall, now 114 px at 390 px wide, 58 px on a short landscape phone.
- **Readiness card:** the Money line dropped below its tick. Tick and text now stay together.
- **Short landscape phones (667 x 375):** the top bar is no longer pinned. Pinned bars took 229 of 375 px; now 58 px.
- **Party health numbers** sat on top of the bar fill; they now sit on their own paper chip.
- **Warnings carry a "!" mark** as well as colour (forecast, supply days, party strip, news).
- **Viewport:** `100dvh` with `100vh` fallback, `overscroll-behavior` on the page, sheets and the full log, so a swipe cannot pull-to-refresh or scroll the page behind a sheet.
- Wide screens: the sticky picture on the Stop screen no longer tucks under the top bar.

## Measured (headless Chrome, Jalalabad stop, v4.0.0 -> v4.0.1)
| Screen | Page height before | after |
| --- | --- | --- |
| Stop 390 x 844 | 2145 px | 2075 px |
| Stop 667 x 375 | 2028 px | 1812 px |
| Road 667 x 375 | 1410 px | 1226 px |

The Stop screen is still about 2.5 screens tall on a phone. CSS alone cannot fix that; Phase 3 restructures it.

## Added
- `tests/e2e/layout_budget.py`: five viewports, fails on sideways scroll, wrapped action bar, pinned bar on landscape, broken tick, unreadable letter, Stop page over budget.
