# Kārvānyān of Sadak-e-Azam: *The Long Road East*

A retro-arcade caravan game on the Grand Trunk Road. Lead a merchant caravan from **Kabul to Dhaka** in 1665-66: carry one finite cargo, keep your people alive, and sell it well. The game ends at Dhaka.

Plain HTML, CSS and JavaScript. **No build step, no dependencies, no external assets, no sound.** Phone first (48 px tap targets, bottom-sheet dialogs); touch, mouse and keyboard.

## How to play

1. **Opening.** Daulat Beg walks you through 12 short beats: choose a merchant (Persian, Armenian, Pashtun, Uzbek, Yarkandi), split capital between **cargo** and **purse**, pick three recruits from six roles (interpreter, healer, cook, animal handler, accountant, hunter/gatherer), buy animals and supplies, choose the month, pace, rations, a first-leg scout and your private reason (it picks one of four subplots). Skippable; "Quick start" repeats your last party.
2. **At a stop** (tabs): **Town** (sell cargo in lots, buy rations, feeds, medicine, covers, animals), **Caravan** (health, Treat buttons, pace, rations, hire scouts, guards and a guide), **Learn** (region briefing, forecast, rumours, "ask around", codex). The action bar shows rations, feeds and days to the next stop.
3. **On the road** one day passes at a time. Weather is forecast ahead; a vignette may hint at what is coming. You choose sarai or camp at night (or set a default in Settings).
4. **Rest days** let the weak and sick recover and offer the **provisioning minigame** (hunt, fish or forage, picked by region; about 20 s; cannot be skipped once started, but you may just rest).
5. Rivers, tolls, dilemmas and subplot beats appear as choices with their costs shown. Reaching Dhaka alive and selling your cargo there ends the game.

## Not finished 

- **Content volume is below the GDD estimates:** 41 codex cards (about 100), 56 vignettes (120), 12 subplot beats (32-48), 9 of 14 set pieces (Jalalabad kitchen, Khyber toll, Peshawar sarai, river crossings, Lahore, Delhi winter, Agra, Varanasi, Patna flood, Rajmahal fever, and the dilemmas); Attock-style crossings cover all river legs.
- **Every history card has `source: 'TBD'`.** None has been checked against sources or reviewed by a subject expert (GDD section 15). Distances, market demand, river calendars, climate tables and archetype cargoes are placeholders. Merchants are gameplay archetypes with small perks; the Pashtun toll discount needs a fairness review.
- Not implemented (reserved by the GDD): hundi and bankers, branching routes, river or riding travel, travel beyond Dhaka, sound, other languages, shared graves, offline install.
- The scout/guide/guard use-rate and "weather deaths avoidable" metrics are not measured. The canvas art and minigames have been exercised only in a headless DOM, not seen on a real phone.
- Daytime road threats are the main new risk. Robbery appears about once every eight runs at Kabul, Peshawar and Attock, and once every thirteen runs at Khyber, per 120 simulated runs. Floods are rare, because the game starts in September to November, after the monsoon. This matches the calendar, but it means flood disasters are mostly absent in practice.
- The journey map is drawn at 640 pixels and shown at phone width, so its labels are small on a phone. Its coordinates are approximate and it is not to scale.
- No outside services are connected. Counts stay in the browser, and score submission reports not-configured.
