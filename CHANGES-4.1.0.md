# Release 4.1.0 – the new layout for phone and desktop

This release implements every wireframe we agreed for the phone and the wide (desktop) layouts.
Game rules, saves and balance are unchanged. A save from build 4.0.0 loads as before.

## What the player sees

### Phone (screens narrower than 900 px)
- **Stop screen fits one screen.** Before: about 2145 px of scrolling at 390 x 844. Now: one screen.
  - The four sections (Town, Caravan, Rest here, Learn) are rows. Each opens a sheet that slides over the screen.
  - The Leg Brief shows only what you need: the next place, food / feed / money readiness, and a single
    **Buy what's needed** button when food or feed is short. The long prose is folded under "More".
  - The party is shown compactly. People who need care come first, with a **Treat** button on each row.
- **Road screen fits one screen.** Before: about 1292 px. Now: one screen.
  - A **margin card** says how many days of food and feed you have against what the leg needs, with a mark
    and a word (tick / ! / !!), never colour alone.
  - A **control bar is pinned at the bottom**: Pause, Rest a day, Caravan, Supplies, Map.
  - Pace and rations are changed on the scene. A two-line **ticker** shows the latest event; **Log** opens the full list.
  - **Paused** shows exact numbers for every party member's health and every supply.
- **Hunt screen** has a **Stop here and keep what I have** button that is always on screen.
- **Rest sheet** (at a stop) and the Caravan and Supplies sheets (on the road) hold what used to be tabs.

### Desktop (900 px and wider)
- Tabs and panes stay, with the ledger beside the road scene on the road screen.
- **Keyboard shortcuts on the road:** Space pause / resume, R rest a day, C caravan, S supplies, L log, M map.
  They are ignored when a button has focus, when a dialog is open, and on other screens.
  Space is deliberately not "Set out".
- Resizing or rotating switches between the phone and desktop layouts without losing your place.

## Fixes folded in (from 4.0.1 and 4.0.2)
- Screen height uses `100dvh` with a `100vh` fallback; no bounce at the page edge.
- Readiness text, meter chip, "!" marks, and letter colour fixes.
- Margin card on the road, same calculation as the stop-screen readiness (one source in `engine.js`).

## For the code
- `engine.js`: new pure `computeMargin(state)`; `READINESS_MARGIN_DAYS` (2) in tuning.
- `ui.js`: `isPhoneLayout()`, section rows and sheets, road bar, margin card, ticker, paused panel, hunt stop button.
- `game.js`: actions `openSection`, `relayout`, `stopProvision`, `fixReadiness('all')` (food and feed only; never sells cargo), road shortcuts.
- `style.css`: new blocks appended at the end; the first `:root` token block is untouched (the contrast check reads it).
- Version strings: `GAME_VERSION = '4.1.0'` and every `?v=` in `index.html`.

## Tests
- Unit: 69 passing (includes 8 new for margin and version).
- Browser: `layout_budget.py` (five viewport sizes), `screens_v41.py` (all new screens and keys), `journey_map.py`.
- Contrast and content lint pass.

## Honest limits
- Tested in headless Chrome only; not seen on a real phone. Please try it on yours.
- At 360 x 740 the stop screen is about 829 px and the road about 761 px, so they scroll slightly.
- The road offers one rest day (plus the hunt offer); multi-day rest remains town-only (engine rule).
- Desktop road is two panes, not the full three-pane wireframe. The desktop stop screen still uses tabs.
- The route-strip drawing is hidden on phones; the footer is hidden on the phone stop and road screens.
- The Event dialogs were not re-checked in this pass.

## How to publish
Upload the folder contents to the GitHub repository with "Add file > Upload files", keep the folder names
(`css`, `js`, `tests`, `tools`), and commit. Hard-refresh the page once (the `?v=4.1.0` values force new files).
