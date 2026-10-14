# Version 2.8.0: daytime road threats, Delhi stays keep supplies, journey map, services seam

Upload the whole folder. This is a complete build; no file from an earlier version is needed.

## Gameplay changes

1. **Daytime road threats (engine.js, events.js, content.js, config.js).**
   Three new road events join the existing stranger, water and animal events. Only one road event happens per day, as before.
   - Robbers in the ravine (ambush). Chance per day = 0.015 x the region's bandit threat, reduced by hired guards.
   - Something in the scrub (wildlife). Chance per day = 0.008 x the region's wildlife threat.
   - A flash flood in the wash (flood). Chance per day = 0.02 x the region's flood threat, on wet days only.
   Each offers two or three choices with costs shown as chips.

2. **Delhi stays keep supplies (engine.js, events.js, content.js).**
   "Stay ten days" and "Stay until spring" in Delhi still charge lodging each night. Rations and feeds are restored at the end of each day, so the stay costs money but no stock. Medicine, cargo and animals are not restored. The choice shows the price and "stores kept" as a chip.

3. **Stay price preview (engine.js).** `Engine.estimateStayCost` replays the game's own rounding night by night, so the price shown matches the price charged (tested).

4. **Journey map (route-map.js, ui.js, game.js, css/journey-map.css).** A map sheet opens when the caravan enters a new region and when the run ends, by death or arrival at Dhaka. It shows the road travelled in red, the rest of the road as a dotted line, and the caravan's position. If a choice dialog is open, the map waits until it is closed. The original screens are unchanged. Coordinates are approximate and the map is not to scale.

5. **Services seam (services.js).** The only place the game talks to outside services. Local-only today: counts stay in the browser, and nothing is sent. Methods return Promises and never reject. A remote adapter can replace the local one later without changing callers. Journey start and end are recorded. Score submission reports `not-configured`.

## Balance (see README for the table)
- Careful policy at 120 runs per archetype: 56% in both 2.5.2 and 2.8.0. The threats do not move the careful win rate measurably at that sample size.
- Robbery frequency per 120 runs (measured with `node tools/event-rates.mjs 120`, a rough driver, not the balance bots): Kabul about 16, Peshawar about 15, Attock about 16, Khyber 9. Wildlife: Kabul 7, Attock 9, Khyber 2. Floods: 1. Floods are rare because the game starts after the monsoon.
- The earlier plan asked for about one robbery per leg in high-threat regions. That target was not met and would have made the game much harder. The current values are a choice for the owner to adjust in config.js (ROAD_AMBUSH_CHANCE, ROAD_WILDLIFE_CHANCE, ROAD_FLOOD_CHANCE).

## Tests
- 46 tests across four files, all passing (`node --test tests/*.test.mjs`).
- New: Delhi stays keep rations and feeds through the real choice path, the stay price matches the charge, Khyber is free, an unaffordable stay is flagged, the choice view shows price and "stores kept", the three road threat storylets are valid and reachable, map geometry, and the services seam.
- All 11 bot policies run 30 games each with no exceptions.
- A headless Chromium run boots the game with no console errors, opens and closes the journey map sheet, and reports services mode `local`.
- Both in-game map triggers (entering a region and ending the run) work in the real game. See the browser checks below.

## Browser checks (headless Chromium, phone-sized viewport)
- `tests/e2e/journey_map.py jhelum "You enter Punjab"`: a saved run at Jhelum sets out, crosses into Gujrat, and the map opens on its own after about 8 seconds, with no console errors. Closes cleanly.
- `tests/e2e/journey_map.py makhsusabad "How far"`: a saved run near Dhaka ends, and the end-of-run map opens over the end screen.
- Found and fixed while testing: the map opened under the game's report sheet, so the two stacked and the map could not be closed. The map is now offered last in each state change, and again whenever a sheet closes.

## Not verified
- No playtest with real players.
- Map labels are small at phone width.
- The Delhi stay is tested through the choice path in Node, not yet in a browser run.
