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
js/ui.js             DOM rendering, dialogs with focus trap, canvas scenes
js/game.js           provisioning minigame, opening flow, loop, actions, boot
tools/simulate.mjs   headless bot simulator (11 policies from GDD 14.2)
tools/contrast.mjs   WCAG contrast check for the theme tokens
tests/game.test.mjs  19 unit and invariant tests
```

Rules live in `config`, `world`, `content`, `state`, `engine` and `events`, which never touch the DOM and run under Node. State is never mutated; every transition returns a new object. One delegated click listener serves every button. Dynamic text is inserted with `textContent` only. All randomness is seeded; weather and prices are keyed by seed and day so a reload agrees.

Saves (`karvanyan.save.v2`) are versioned, checksummed and sanitised on load; a damaged file shows a message, never a blank screen. Autosave after arrivals, choices, purchases, rests, every third day and when the tab is hidden. Settings has export/import for backups (phone browsers can clear site data).

## Tests and tools (Node 18+, no packages)

```bash
node --test tests/game.test.mjs   # 19 tests: graph, calendar, rivers, load, prices, saves, content, balance gates
node tools/simulate.mjs 30        # all bot policies; add a policy name to run one
node tools/contrast.mjs           # 32/32 colour pairs pass
```

### Measured balance (bots, 30 runs per archetype, placeholders until humans playtest)

| Policy | Win rate |
|---|---|
| careful | 59% (GDD target 55-70%) |
| careful + guide | 49% |
| hire-all | 23% |
| sarai-always | 69% (about 10 points above careful; GDD limit is 8: not met) |
| camp-always | 44% |
| provision-spam | 41% |
| wait-winter / idle-heavy | 0% / 3% |
| sell-all-first / sell-all-at-Dhaka | 30% / 7% |
| random | 0% |

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
