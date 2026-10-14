# Kārvānyān of Sadak-e-Azam: *The Long Road East*

A retro-arcade caravan game on the Grand Trunk Road. Lead a merchant caravan from **Kabul to Dhaka** in 1665-66: carry one finite cargo, keep your people alive, and sell it well. The game ends at Dhaka.

Plain HTML, CSS and JavaScript. **No build step, no dependencies, no external assets, no sound.** Phone first (48 px tap targets, bottom-sheet dialogs); touch, mouse and keyboard.

## Run it

Double-click `index.html`, or serve the folder (`python3 -m http.server 8080`). For GitHub Pages put the files in the repository root and enable Pages from `main` / root. All paths are relative. (Classic scripts sharing one namespace are used instead of ES modules because browsers block modules on `file://`.)

## How to play

1. **Opening.** Daulat Beg walks you through 12 short beats: choose a merchant (Persian, Armenian, Pashtun, Uzbek, Yarkandi), split capital between **cargo** and **purse**, pick three recruits from six roles (interpreter, healer, cook, animal handler, accountant, hunter/gatherer), buy animals and supplies, choose the month, pace, rations, a first-leg scout and your private reason (it picks one of four subplots). Skippable; "Quick start" repeats your last party.
2. **At a stop** (tabs): **Town** (sell cargo in lots, buy rations, feeds, medicine, covers, animals), **Caravan** (health, Treat buttons, pace, rations, hire scouts, guards and a guide), **Learn** (region briefing, forecast, rumours, "ask around", codex). The action bar shows rations, feeds and days to the next stop.
3. **On the road** one day passes at a time. Weather is forecast ahead; a vignette may hint at what is coming. You choose sarai or camp at night (or set a default in Settings).
4. **Rest days** let the weak and sick recover and offer the **provisioning minigame** (hunt, fish or forage, picked by region; about 20 s; cannot be skipped once started, but you may just rest).
5. Rivers, tolls, dilemmas and subplot beats appear as choices with their costs shown. Reaching Dhaka alive and selling your cargo there ends the game.

## Layout

```text
index.html           entry point (scripts load in dependency order)
css/style.css        tokens (CSS variables), CRT theme, light/dark, responsive
js/config.js         balance and rules constants, animals, cargo, roles, weather effects, archetypes
js/world.js          31 stops, 30 legs, 12 regions, rivers, markets, climate tables
js/content.js        recruits, opening lines, storylets, vignettes, subplot beats, codex
js/state.js          state, modifiers, load, markets and prices, scoring, saves
js/engine.js         the daily rules: weather, travel, night, rest, provisioning, hiring
js/events.js         storylet interpreter, toll, river crossings, night prompt, overload
js/route-map.js      journey map geometry and painter (approximate coordinates, not to scale)
js/services.js       seam for outside services (counts, scoreboard); local-only today
js/ui.js             DOM rendering, dialogs with focus trap, canvas scenes, journey map sheet
js/game.js           provisioning minigame, opening flow, loop, actions, boot
tools/simulate.mjs   headless bot simulator (11 policies from GDD 14.2)
tools/contrast.mjs   WCAG contrast check for the theme tokens
tests/game.test.mjs  22 unit and invariant tests (graph, calendar, rivers, load, prices, saves, balance gates)
tests/v28.test.mjs   Delhi stays keep stores, stay-cost preview, daytime road threats
tests/route-map.test.mjs  journey map geometry and region-change rule
tests/services.test.mjs   local services seam, including blocked storage and remote fallback
```

Rules live in `config`, `world`, `content`, `state`, `engine` and `events`, which never touch the DOM and run under Node. State is never mutated; every transition returns a new object. One delegated click listener serves every button. Dynamic text is inserted with `textContent` only. All randomness is seeded; weather and prices are keyed by seed and day so a reload agrees.

Saves (`karvanyan.save.v2`) are versioned, checksummed and sanitised on load; a damaged file shows a message, never a blank screen. Autosave after arrivals, choices, purchases, rests, every third day and when the tab is hidden. Settings has export/import for backups (phone browsers can clear site data).

## Tests and tools (Node 18+, no packages)

```bash
node --test tests/*.test.mjs       # 46 tests across four files
node tools/simulate.mjs 30        # all bot policies; add a policy name to run one
node tools/contrast.mjs           # 32/32 colour pairs pass
node tools/event-rates.mjs 120    # how often each road storylet appears, by region
python3 -m http.server 8099 &   # then, from the project folder:
python3 tests/e2e/journey_map.py jhelum "You enter Punjab"   # browser test: map opens on entering a region
python3 tests/e2e/journey_map.py makhsusabad "How far"       # browser test: map opens at the end of a run
```

### Measured balance (bots, 30 runs per archetype, placeholders until humans playtest)

The table below is from version 2.8.0 at 30 runs per archetype. Thirty runs is noisy: the same careful policy measured 59% on 2.5.2 at 30 runs, but 56% at 120 runs on both 2.5.2 and 2.8.0. Treat differences under about ten points as noise. Use `node tools/simulate.mjs 120 careful` before drawing conclusions.

| Policy | Win rate |
|---|---|
| careful | 45% at 30 runs (56% at 120; GDD target 55-70%) |
| careful + guide | 44% |
| hire-all | 31% |
| sarai-always | 58% at 30 runs |
| camp-always | 44% |
| provision-spam | 35% |
| wait-winter / idle-heavy | 0% / 2% |
| sell-all-first / sell-all-at-Dhaka | 15% / 1% |
| random | 0% |

The wait-winter policy waits on its own 90-day rule, not through the Delhi storylet, so it does not exercise the Delhi keep-supplies fix.

Careful runs last about 204 days; losing runs score about half of winning ones. Careful win rates by archetype (60 runs): Persian 83%, Armenian 78%, Pashtun 45%, Uzbek 62%, Yarkandi 42%. Pashtun and Yarkandi are nearly tied, so the "hard" ordering is only roughly met. Archetype score multipliers keep average winning scores within about 7% of each other. Bots cannot judge clarity, tone or fun; playtest with adults on real phones.

## Departures from the GDD (all numbers are TUNE)

- Capital raised to 3,300-4,800 rupees (GDD 1,600-3,000): at the GDD's numbers a careful caravan could not afford the road.
- Lodging 3 + 0.3 per animal; camping is harsher (exposure x1.6, attacks x2) and grazing smaller, so sarais are worth their price.
- Death score is 12% of carried value (GDD 25%) and a codex card is worth 2 points (GDD 5), to keep dead runs under 55% of wins.
- Profit ratios are low (0.1-0.3): travel costs eat most of the cargo margin. Verdict tiers are set to the real range (ruin under 0.08, fair 0.2, good 0.4).
- Typed JSDoc instead of TypeScript (no build step). Added `world.js`, `content.js` and `engine.js` to keep files readable.

## Not finished (be honest with testers)

- **Content volume is below the GDD estimates:** 41 codex cards (about 100), 56 vignettes (120), 12 subplot beats (32-48), 9 of 14 set pieces (Jalalabad kitchen, Khyber toll, Peshawar sarai, river crossings, Lahore, Delhi winter, Agra, Varanasi, Patna flood, Rajmahal fever, and the dilemmas); Attock-style crossings cover all river legs.
- **Every history card has `source: 'TBD'`.** None has been checked against sources or reviewed by a subject expert (GDD section 15). Distances, market demand, river calendars, climate tables and archetype cargoes are placeholders. Merchants are gameplay archetypes with small perks; the Pashtun toll discount needs a fairness review.
- Not implemented (reserved by the GDD): hundi and bankers, branching routes, river or riding travel, travel beyond Dhaka, sound, other languages, shared graves, offline install.
- The scout/guide/guard use-rate and "weather deaths avoidable" metrics are not measured. The canvas art and minigames have been exercised only in a headless DOM, not seen on a real phone.
- Daytime road threats are the main new risk. Robbery appears about once every eight runs at Kabul, Peshawar and Attock, and once every thirteen runs at Khyber, per 120 simulated runs. Floods are rare, because the game starts in September to November, after the monsoon. This matches the calendar, but it means flood disasters are mostly absent in practice.
- The journey map is drawn at 640 pixels and shown at phone width, so its labels are small on a phone. Its coordinates are approximate and it is not to scale.
- No outside services are connected. Counts stay in the browser, and score submission reports not-configured.
