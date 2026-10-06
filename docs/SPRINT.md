# SPRINT.md — Kārvānyān of Sadak-e-Azam: *The Long Road East*
Sprint 1: "Solid foundation" — fixes + refactor, no new route, no new content.
Audience: Claude Code (executor) and Bishwamitra (product owner). Read CLAUDE.md first, then this file top to bottom.

---

## 0. How to run this sprint (protocol for Claude Code)

1. Work task by task in the order of Section 7. One git branch per task (`t10-focus-trap`), small commits, merge to `main` only when `npm run verify` is green.
2. Never edit `baseline/index.html`. It is the frozen reference build (852 lines, single file). New code goes in the layout of Section 3.
3. Before changing any behaviour, capture baseline numbers (task T00). Every later change is compared to them.
4. Do not add features outside this document. If you find a good idea, append it to `docs/BACKLOG.md` and move on.
5. If a task needs a decision marked **[ASK]**, stop and ask the product owner in one concise message. Otherwise choose the default stated here and record the choice in `docs/DECISIONS.md`.
6. Definition of done for every task: acceptance criteria met, tests added, `npm run verify` green, `CHANGELOG.md` line added, task ticked in Section 7.
7. Prefer plain, readable JavaScript (ES modules). The owner is a novice coder: short functions, comments that say *why*, no clever tricks, no build step, no framework.
8. Hosting target is GitHub Pages: all URLs must be **relative** (`./js/main.js`), never `/js/main.js`.

---

## 1. Product, pillars and guardrails (lead game designer)

**What it is:** an Oregon Trail–style browser game. You lead a merchant caravan along the Grand Trunk Road (Sadak-e-Azam) from Kabul toward Dhaka in autumn 1665. Sprint 1 ships only the Kabul → Attock slice; the engine must be ready for the full route.

**Pillars (use them to settle any design doubt):**
1. **Learn by choosing.** History must change what the player can do or what happens (full version arrives in Sprint 2; this sprint builds the hooks).
2. **The road is the teacher.** Death and loss must explain *why* (historical lesson at game end), never feel random.
3. **Real, hedged history.** Nothing is stated as fact unless it is sourced; uncertain items are hedged ("tradition says").
4. **Calm, readable, phone-first.** Short text (≤45 words per paragraph, ≈ grade 8), big touch targets, one clear next action per screen.
5. **Respectful.** Merchants are nationality archetypes: no caricature; sensitivity review before release.

**Guardrails for this sprint:**
- Behaviour parity: after the refactor the same seed gives the same outcome as the baseline *unless* a change is listed in Section 6 ("intentional behaviour changes").
- No new route, towns, merchants, cards or events. Allowed text edits: only those in Section 6.
- English only. Persian-flavoured display font for headings; readable serif for body. All player-visible strings live in `data/` so translation is possible later (not in MVP).
- Browser floor: 2020+ (Chrome/Android 2020+, iOS Safari 14+/15+). No unguarded use of `:has()`, container queries, `dvh` without fallback, `structuredClone`, top-level await, or `inert` without fallback.
- Saves live in the browser (localStorage). Shared graves/leaderboard are **local only** this sprint but written behind an interface (`storage.js`) so a backend can replace it later.
- No third-party requests at runtime (fonts self-hosted, no analytics, no CDN).

---

## 2. Current-state summary (from the three audits)

The baseline is stable (0 crashes / 0 soft-locks in 120 bot runs) but:

| ID | Severity | Finding |
|---|---|---|
| D1 | S1 | Keyboard soft-lock: Tab reaches background controls behind a modal; Enter triggers `rerender()` which resets global `reg` (button registry); modal buttons then point at nothing (6/6 repro). |
| D2 | S2 | Phone layout: page 404 px wide at 320–390 px viewport; `.ctl` two-column grid never collapses; "Bare bones" ration button clipped; ribbon label "Attock" overflows. |
| D3 | S2 | Medicine (`G.med`) only usable inside the random fever event (`evSick`). No treat button. UI says "Cures one fever". |
| D4 | S2 | Seasons keyed to departure month `G.month`, which never advances. Attock high water, heat, cold ignore elapsed days. |
| D5 | S3 | `disabled` flags inconsistent (functions in moments, booleans in events). |
| D6 | S3 | Khyber toll has no affordability check; `pay()` silently pays with goods. |
| D7 | S3 | Sarai-kitchen sickness sets `p.sick=true` directly (no notice, no `ill` type) instead of `makeSick()`. |
| D8 | S3 | `cargo.toLowerCase()` gives "chinese silk". |
| D9 | S3 | Hijri year hard-coded "1076 AH". |
| D10 | S3 | Leader death ends the run even with healthy companions; `LESSON.sickness` unreachable. |
| D11 | S3 | Hunting: no cost, ignores prefers-reduced-motion; touch misses cost arrows. |
| D12 | UX | Stop screen ≈ 2,300 px tall on a phone; primary action at the bottom; HUD has 8 equal chips; advice text (18 days) contradicts forecast (7 days of food). |
| D13 | UX | Game keeps no state across refresh; no pause when tab hidden. |
| D14 | Balance | Careful play wins 39/40 (97%); random play wins 3/40; difficulty labels inverted (Persian "Easiest" avg win score 2,938; Pashtun "Hard" 4,396); dead runs score ≈ 60% of wins. |
| D15 | Arch | Single IIFE, global mutable state, innerHTML strings, content embedded in code, unseeded `Math.random`, linear route (always `EDGES[node][0]`). |

Out of scope (Sprint 2): economy rescale to dams/paisa, Multani banker + hundi, knowledge-gated choices, sarai nights, kos minars, miniature art, shared graves backend, new route legs, history corrections beyond Section 6.

---

## 3. Target architecture (no build step, ES modules)

```
index.html
manifest.webmanifest
sw.js
css/
  tokens.css           design tokens (colors, spacing, type scale, radii)
  base.css             reset, typography, layout helpers
  components.css       button, meter, chip, card, modal/sheet, banner, tabs, stepper
  screens.css          title, setup, moment, stop, travel, end
fonts/                 self-hosted woff2 + LICENSE-*.txt
icons/                 icon.svg, maskable png 192/512 (generated once)
js/
  main.js              boot, screen router, global listeners (visibilitychange, online/offline)
  rng.js               mulberry32 seeded RNG
  calendar.js          date math, seasons, Hijri label
  state.js             newGame(), serialize(), deserialize(), validate(), migrate()
  rules.js             pure rules: speed, daily tick, health, sickness, food, scoring (no DOM)
  events.js            road-event selection + resolution (reads data/events.json)
  moments.js           moment interpreter for data/moments.json + custom hooks
  route.js             route graph helpers
  storage.js           save/load/export/import, graves, top ten (localStorage, try/catch, memory fallback)
  ui/
    dom.js             h() helper, delegate(), focus utilities
    components.js      Button, Meter, Chip, Card, Banner, Tabs, Stepper
    modal.js           modal/bottom-sheet manager with focus trap
    screens/title.js setup.js moment.js stop.js travel.js end.js codex.js settings.js hunt.js coach.js
data/
  merchants.json  stops.json  routes.json  cards.json  events.json  moments.json
  balance.json         every tunable number (paces, rations, prices, rates, multipliers)
  strings.json         UI strings (buttons, labels, help text)
tests/
  unit/*.test.mjs      node --test
  data/lint.mjs        content + schema lint
  e2e/*.spec.mjs       Playwright
  visual/              screenshot specs + baselines
tools/
  bots/ fuzz.py kb.py mob.py       (from kit, port to testids)
  make-precache.mjs                writes the file list into sw.js (run before release)
docs/ DECISIONS.md BACKLOG.md QA.md facts.json
baseline/index.html    FROZEN
```

Rules of the architecture:
- `rules.js`, `calendar.js`, `rng.js`, `state.js` import **nothing** from `ui/` and never touch `document`/`window`. They must run under Node for unit tests.
- Every random number comes from `rng.js` (`rng.next()`, `rng.range(a,b)`, `rng.chance(p)`, `rng.pick(arr)`). `Math.random` is banned outside `ui/` visual effects (lint rule).
- UI never mutates state directly: it calls `dispatch(action)`; `rules.js` returns a new state (shallow-copy per top-level key is fine; mutation inside a reducer on a cloned object is OK).
- Event handling by **delegation**: elements carry `data-action="name"` and optional `data-arg`. One listener at the app root looks up `actions[name]`. There is **no global index registry**.
- Controls that tests need carry `data-testid` (contract in Section 8).

### 3.1 State shape (serialisable JSON; no Sets, functions or DOM)
```json
{
  "v": 1, "seed": 123456, "rngCalls": 0,
  "merchantId": "persian", "startMonth": 9,
  "dateISO": "1665-10-15", "day": 0,
  "money": 900, "food": 30, "fodder": 35, "goods": 10, "med": 1, "animals": 6,
  "party": [{"name":"Hadi","hp":100,"alive":true,"sick":false,"ill":null,"died":null}],
  "pace": "steady", "rations": "filling",
  "node": "kabul", "edge": null, "kos": 0, "segEvents": 0,
  "screen": "stop", "moment": null, "pendingNotes": [],
  "codex": ["kab_then"], "newCards": 0,
  "log": [{"d":0,"t":"..."}], "deaths": [], "flags": {"farman": true, "waitBonus": 0, "net": 0},
  "over": null, "paused": false
}
```
`state.js` exports `validate(raw)` which clamps numbers (≥0, finite, sane maxima), truncates strings, drops unknown fields, and returns `{ok, state, repaired}`.

### 3.2 RNG
`mulberry32(seed)` with an internal call counter so a save can resume exactly. `state.seed` + `state.rngCalls` is enough to restore (fast-forward by rebuilding the generator and discarding `rngCalls` outputs, or serialise the 32-bit state directly: **default = serialise the 32-bit internal state** as `rngState`; keep `seed` for display and bug reports).

### 3.3 Calendar
- Start dates (parity with baseline): Sept 15, Oct 15, Nov 15 1665 (baseline `new Date(1665, month, 15+day)`). Use UTC date math (`Date.UTC`) to avoid DST/timezone drift.
- `seasonAt(dateISO, edge)` returns flags: `highWater` (Attock: June 1 – Sept 30), `lowlandHeat` (edge.low and date before Oct 10), `coldSnow` (edge.cold and date ≥ Oct 25), plus `winterDeep` (≥ Nov 15) which scales cold damage ×1.6.
- Hijri label via the tabular civil Islamic algorithm (±1–2 days vs observational; label shows "AH" year only, as in baseline). Test: 15 Oct 1665 → 1076; 1 Jan 1666 → 1076.
- Gregorian dates are proleptic New Style by convention; state this once in the Codex footnote (note: England used the Julian calendar in 1665, the game does not).

### 3.4 Data-driven moments (interpreter spec)
`data/moments.json` entries:
```json
{
  "id": "jalalabad_arrival", "stop": "jalalabad", "icon": "🍊", "title": "A hungry traveler",
  "text": ["..", "..", ".."], "pick": 1,
  "choices": [
    { "id":"buy", "label":"Buy oranges and sugarcane (pay 15 rupees).",
      "requires":[{"money":">=15"}],
      "effects":[{"money":-15},{"hpAll":10},{"card":"jal_food"},{"card":"jal_then"}],
      "result":"A fruit seller grins ..." }
  ]
}
```
Supported `requires`: `money`, `food`, `goods`, `med`, `animals` comparisons; `card` (has card id); `flag`; `merchant`; `dateBefore`/`dateAfter`; `season`.
Supported `effects`: numeric deltas (`money`, `food`, `fodder`, `goods`, `med`, `animals`), `hpAll`, `hp:{target:"random|leader|all",amount,cause}`, `sick:{target,ill}`, `card`, `flag`, `advanceDays`, `chance:[{p,effects,result}]` (weighted outcome list), `custom:"hookName"`.
Custom hooks (`js/moments.js` `HOOKS`): `attock_cross` (risk table + water level + waitBonus), `khyber_toll` (haggle odds from guards + Armenian bonus, farman use, Pashtun free pass), `kabul_dawn_rest` (rest tick). Everything else must be pure data. If a baseline moment can be expressed in data, do it in data.

### 3.5 Route graph
`data/routes.json`: `{ "edges": [{ "id":"kabul-jalalabad","from":"kabul","to":"jalalabad","kos":42,"risk":0.22, "weights":{...}, "tags":["cold"], "game":["🐦","🐏"], "flavor":[...] }] }`. UI: if a stop has >1 outgoing edge show a "Choose road" step (not used this sprint, but unit-tested with a fake graph).

---

## 4. Design system and UX spec (UX designer + UI programmer)

### 4.1 Tokens (`css/tokens.css`)
Keep baseline palette (light + dark, `data-theme` override) and extend:
- Spacing scale 4/8/12/16/24/32; radii 4/8/14; type scale 15/17/20/24/32; line-height 1.5; max content width 640 px (phone-first, centered on desktop).
- **Contrast requirement:** text ≥ 4.5:1; UI borders/icons that convey meaning ≥ 3:1. Measure every token pair with `tools/contrast.mjs` (write it; fail CI under threshold). Gold borders are decorative if paired with another cue; otherwise darken `--gold-line` to meet 3:1.
- Fonts **[ASK — default stated]:** body = *Alegreya* (keep; readable serif). Display (h1/h2, buttons labels not): a Persian-flavoured Latin face. Default candidate: *Aladin* if it exists and has an OFL licence; fallbacks *Amiri* (Latin glyphs) then *Almendra*. Obtain woff2 via `npm i -D @fontsource/<name>` and copy files into `/fonts` with licence text; never link Google Fonts at runtime. Use `font-display: swap`, subset to Latin (+ ā ī ū ṣ ḥ ʿ ʾ macron characters used in "Kārvānyān"). Verify Ā/ā glyph coverage; if missing in the display face, set that text in the body face. Show the owner a font specimen screenshot (title + h2 + button) before locking in.
- Optional (only if owner approves the specimen): the Persian word کاروانیان as an inline SVG lettering asset on the title screen.
- Theme toggle must show a text label ("Theme") and `aria-label`.

### 4.2 Components (`ui/components.js`)
`Button({variant: primary|secondary|quiet|danger, size, icon, testid, action, arg, disabled})`, `Meter({value,label,state})`, `Chip({icon,label,value})`, `Card({kind,title,text})`, `Banner({tone,text,action})`, `Tabs`, `Stepper` (segmented control for pace/rations with help text), `Sheet` (modal). Min tap target 44×44 px, ≥ 8 px gap. Focus ring ≥ 3 px, visible in both themes.

### 4.3 Screens
**HUD:** sticky compact strip: 💰 rupees · 🍞 food · 🌾 fodder · 👥 party, plus a chevron that expands 📦 goods · 💊 medicine · 🐫 animals · 🗓 day. Date line below, small. Ribbon below HUD: 5 nodes; labels wrap, min font 12 px; no overflow at 320 px.

**Title:** Continue (if a valid save exists) is the first, largest button, with a one-line summary ("Day 7 · Jalalabad · 4/4 alive"). New game requires confirm if a save exists. Merchants shown as compact cards with a "Details" expander (default collapsed: name, tagline, cash/party/animals/guards, difficulty); ability text inside the expander. Settings and Codex reachable from title.

**Setup:** names + month choice; month choices show a one-line consequence (not long paragraphs).

**Moment screen:** unchanged content; consequences chips on choices when numeric (💰 −15). Choices ordered safe → risky; irreversible/risky ones use `danger` variant.

**Stop screen (core redesign):**
- Sticky bottom action bar (above safe-area inset): **[Set out ▶ Jalalabad · 42 kos]** primary, **[Rest a day]** secondary, and a one-line forecast ("Food 7 d · Fodder 11 d · Jalalabad ≈ 7 d"; warn tone if short).
- Three tabs under the HUD: **Town** (sell + buy), **Caravan** (party meters with **Treat** buttons, pace, rations), **Learn** (guide, codex preview, advice replay).
- First visit to Kabul: dismissible coach card with Daulat Beg's advice **computed from the same functions as the forecast** (days = ceil(totalKos / paceKos), food need = people × days). Fixes D12 contradiction: show "Whole demo: 106 kos ≈ 18 days at steady pace. Next leg: 42 kos ≈ 7 days. Carry at least N food for this leg."
- Reaching "Set out" must need ≤ 2 screen-heights of scroll at 390×780 (test).

**Travel screen:** one screen without page scroll on 390×780: progress bar, date + weather, 4 key stats, forecast, buttons [Pause/Resume] [Hunt] [Rest], a collapsible "Caravan" panel (pace/rations/party meters), last 3 log lines + "Full log" opens a sheet. Game auto-pauses when `document.hidden`, when the Codex or settings sheet is open, and when a modal is open.

**Modals:** `role="dialog" aria-modal="true" aria-labelledby`; on phones (≤ 600 px wide) render as a bottom sheet with max-height 85 vh and internal scroll; on larger screens a centered dialog. Focus moves to the dialog heading/first action on open, Tab/Shift-Tab trapped, background gets `aria-hidden="true"` and `inert` when supported (fallback = the focus trap), focus returns to the previously focused control on close. Escape closes only dismissible sheets (Codex, Settings, Full log), never event/choice dialogs.

**Hunt:** targets have an invisible 48×48 px hit area; a click within 40 px of a target hits it; a miss farther away costs an arrow; timer 15 s default, option "Relaxed" 25 s in Settings; keyboard: arrow keys move a crosshair, Space/Enter shoots; "Skip hunt (+X food by luck)" button for accessibility (X = deterministic average from `balance.json`, costs the same day). Respects `prefers-reduced-motion` (targets fade between fixed positions instead of sliding).

**End screen:** keep score table and lessons; add "What the road taught you" (cards learned) and for death the historical lesson. Epitaph input scrolls into view on focus; Enter submits.

**Settings sheet:** text size (A− / A / A+ → 100/115/130 % root font size), theme (Auto/Light/Dark), reduced motion override, relaxed hunt, export save, import save, reset save (confirm), version string.

**First-run coach (3 steps, skippable, stored in storage):** (1) your goal and caravan, (2) food/fodder/health and the forecast bar, (3) pace & rations; replayable from Settings.

### 4.4 Content rules enforced by lint (`tests/data/lint.mjs`)
Paragraph ≤ 45 words; Flesch-Kincaid grade ≤ 8.5 per card/event text (implement a small syllable counter; report offenders; fail only if > 9.5, warn between); every card has `source` and `confidence` (`high|moderate|low`); no `confidence:"low"` without a hedge phrase ("tradition", "may", "is said"); banned strings list (`bloody flux` unless immediately followed by "(pechish)" or glossed, `Pakistan`, `Afghanistan` as a state); all referenced ids exist; every card reachable (listed in some stop's `cards`, event `card`, or moment effect); UI strings only from `strings.json`.

---

## 5. Engine and balance spec

### 5.1 Constants to extract from baseline into `data/balance.json`
Read them from `baseline/index.html` (const names): `PACES`, `RATIONS`, `FOOD_PACK/FOOD_COST`, `FODDER_PACK/FODDER_COST`, `MED_COST`, `GUIDE_COST`, `ONWARD`, `MERCHANTS`, `EDGES`, `STOPS`, `CARDS`, `LESSON`, `SEED_TOP`, and the numeric literals inside `dailyTick`, `speedInfo`, `makeSick`, `evBandits`, `evWolves`, `evSick`, `evWater`, `evTrade`, `unitPrice`, `endGame`. Do not retype values by hand: write `tools/extract-baseline.mjs` that parses/evaluates those consts from the baseline file into JSON (use a sandboxed `vm` to evaluate only the const blocks), then review the diff.

### 5.2 Behaviour parity test
`tests/unit/parity.test.mjs`: run the new engine headless with a fixed policy (e.g. "careful bot": steady/filling, buy food to cover leg +3 days, choose first non-risky option) for seeds 1..200 and record outcome distributions; compare with the baseline bot distributions captured in T00 (win %, mean days, mean score ± tolerance). Exact same-seed parity with the baseline is **not** possible (baseline is unseeded); the test therefore checks distributions within tolerance (win rate ±8 percentage points before the balance task T42, mean days ±1.5).

### 5.3 Intentional behaviour changes (all other behaviour must match baseline)
| # | Change | Reason |
|---|---|---|
| C1 | Seasons derive from the current date (Section 3.3) | D4 |
| C2 | Medicine can be used on any sick member (Treat button); fever cure 100%; dysentery cure 70% (value in `balance.json`) | D3 |
| C3 | `pay(amount)` returns `{paid, goodsGiven, ok}`; choices needing money are disabled if `money + goods×35 < cost` (existing rule) AND a message states when goods are used | D6 |
| C4 | Sarai kitchen illness goes through `makeSick` (notice shown) | D7 |
| C5 | Cargo display names are proper-cased from data (`displayCargo`) | D8 |
| C6 | Hijri year computed | D9 |
| C7 | Hunting costs **3 rupees** (arrows) per hunt (`balance.hunt.cost`); the Hunt button is disabled if unaffordable; yield formula and carry cap unchanged; no new item types this sprint | D11 |
| C8 | Leader succession: if the leader dies and ≥1 companion lives, the next living member becomes leader, run continues, **score penalty −10 %** applied once at the end; run ends only when all are dead | D10 (default; **[ASK]** if owner prefers baseline "leader death ends run") |
| C9 | Guide: first guide per stop costs the same; score for "things learned" lowered from 40 to **15** per card and the codex bonus is capped at 40 % of the base score | D14 |
| C10 | Death scoring (default, **[ASK]** to change): a run that ends in total death scores only the "Things learned" points plus 25 % of the value of carried money, goods and animals; wins keep full scoring | D14 |
| C11 | Text fixes in Section 6 | audit |

### 5.4 Balance targets (measured by bots in T42; tune only `balance.json`)
- Careful bot (steady/filling, no guide spam, safe choices): **win rate 65–75 %** over ≥ 300 seeded runs per merchant mix.
- Random bot: win rate ≤ 10 %.
- Difficulty labels must match measured difficulty. Order from easiest to hardest is Persian, Armenian, Pashtun, Uzbek, Yarkandi (labels Easiest / Easy / Hard / Hard / Hardest). The careful-bot win rate must fall by at least 3 percentage points at each step (Pashtun and Uzbek may tie within 3 points since both are labelled "Hard"). Then set each merchant's `scoreMultiplier` so the average winning score is within ±10 % between merchants (a harder merchant earns a higher multiplier because it wins less often, not because its raw points are higher). Document final multipliers and measured rates in `docs/BALANCE.md`.
- Mean winning run length 18–26 days; ≥ 90 % of runs end with 0 JS errors/soft-locks.
- Dead-run mean score ≤ 55 % of winning-run mean score.
- Hunting cannot be a free infinite food loop: bot "hunt every leg" must not exceed the careful bot's win rate by more than 8 points.

---

## 6. Allowed text/content fixes this sprint (no new facts)
- "chinese silk" → "Chinese silk" (and other proper nouns in merchant cargo).
- "bloody flux" → keep the phrase only with gloss: "dysentery (the 'bloody flux' in English; *pechish* in Persian and Hindustani)". Move to data; flag in `facts.json` as `confidence: moderate` for the Hindustani/Persian term.
- Add `source`/`confidence` fields to every existing card; do **not** invent sources. For each card write `"source":"TBD"` and `"confidence":"unverified"` and let the product owner / expert reviewer fill them; lint treats `TBD` as a warning in Sprint 1 and an error from Sprint 2.
- Fix the known inaccuracies already identified: (a) 1672 revolt card: say "In 1674 Aurangzeb himself came north to restore order" (not implied immediate); (b) Hund distance: "about 15–20 km upstream" instead of "a few miles"; (c) Khushal Khan: "around 1664 … he was still a prisoner in 1665" (keep) and mark confidence `moderate`; (d) Seed leaderboard: replace *Ralph Fitch, English merchant, 1580s* with a figure who actually travelled this northwest road (**[ASK]** owner or reviewer; default = remove the row and use "Mundy" only if confirmed), otherwise keep with the label "traveller, 1580s" and add `facts.json` note.
- Everything else flagged in the creative review (Persian/Armenian route plausibility, Pashtun perk, rahdari, Multani bankers, dams economy) goes to `docs/BACKLOG.md`, **not** implemented now.

---

## 7. Task list (in order). Estimates are focused working days. Tick when done.

### Block 0 — Setup and baseline (0.5 d)
- [ ] **T00 Repo + baseline capture.**
  Steps: create repo skeleton (Section 3) with `baseline/index.html` untouched; `package.json` (`"type":"module"`, Node ≥ 20, dev deps: `playwright`, `@axe-core/playwright`, `pixelmatch`, `pngjs`; scripts below); `README.md`; `.gitignore`; `CHANGELOG.md`; copy kit `tools/*.py` into `tools/bots/`. Run the three bot suites (random / smart / guide, 40 runs each) and the keyboard + viewport scripts against `baseline/` and save results to `docs/baseline-results/*.json|csv` and screenshots.
  Scripts: `npm run serve` (python3 -m http.server 8080), `npm run test:unit` (`node --test tests/unit`), `npm run lint:data`, `npm run test:e2e` (playwright), `npm run test:visual`, `npm run bots` (smoke 60 runs), `npm run bots:full` (300), `npm run verify` = unit + lint:data + e2e (Chromium) + bots smoke.
  Acceptance: baseline numbers committed (careful win ≈ 97 %, random ≈ 8 %, keyboard lock 6/6, 404 px overflow); `npm run serve` loads `baseline/index.html` at `/baseline/`.

### Block 1 — Hotfix release on the baseline (1.5 d) → publish v0.1 to Pages
Hotfixes are patches to a **copy** at `legacy/index.html` (not `baseline/`), deployed to Pages as v0.1 so players get fixes immediately; their tests become the regression suite the new build must pass.
- [ ] **T10 Focus-safe interaction (D1).** In `legacy/`: replace `reg`-registry by `data-action` delegation OR make `rerender()` never run while `G.modal`; add focus trap + `aria-modal` + focus return; add `data-testid`s from Section 8. Tests: QA-001 e2e (Tab/Shift-Tab 30×, Enter on every focusable, modal still closable, background state unchanged). Acceptance: keyboard test 6/6 pass; bot soak 120 runs 0 errors.
- [ ] **T11 Phone layout (D2).** `.ctl` stacks below 520 px; ribbon labels wrap and shrink; remove horizontal overflow; Codex badge becomes a dot; theme toggle labelled. Tests: QA-002 (scrollWidth == innerWidth at 320/360/390/768/667×375; all buttons fully visible).
- [ ] **T12 Medicine & small bugs (D3,D6,D7,D8,D9 partial).** Treat button for every sick member on stop + travel; affordability check on Khyber toll; `makeSick` in sarai kitchen; cargo name casing; Hijri computed. Tests: QA-003, QA-005, QA-006, QA-007, QA-008.
- [ ] **T13 Deploy v0.1.** GitHub repo **[ASK: owner/name]**, enable Pages from `main` root, README with live URL. Acceptance: live page loads over HTTPS; bots pass against the live URL.

### Block 2 — Foundations (1.5 d)
- [ ] **T20 RNG + calendar (+D4,D9).** `rng.js` (mulberry32, serialisable state), `calendar.js` (UTC dates, `seasonAt`, Hijri, start dates). Unit tests: determinism; distribution sanity (10⁵ draws mean ≈ .5); season flags for each date from 1 Sep 1665 to 28 Feb 1666; Hijri for known dates; no `Math.random` in `js/` (lint).
- [ ] **T21 Data extraction.** `tools/extract-baseline.mjs` → `data/*.json` from baseline consts; review diff by hand; add `strings.json`. Unit test: all ids unique; schemas valid.
- [ ] **T22 Data lint.** `tests/data/lint.mjs` with the rules of Section 4.4 + schema checks; wire into `verify`.

### Block 3 — Design system and screens (2 d)
- [ ] **T30 Tokens, base CSS, fonts, components.** Section 4.1–4.2. Font specimen page `docs/font-specimen.html` + screenshot for owner approval **[ASK]** before final choice (default Aladin → Amiri → Almendra). `tools/contrast.mjs` table committed to `docs/contrast.md`.
- [ ] **T31 UI shell, modal manager, HUD, ribbon, title, setup.** Delegation, focus trap, bottom sheet. Tests: QA-001 re-run on the new build; axe scan zero serious/critical.
- [ ] **T32 Stop screen redesign + coach card.** Tabs, sticky action bar, forecast consistency. Tests: QA-011 (Set out reachable within 2 screens at 390×780), forecast text equals computed values.
- [ ] **T33 Travel screen + hunt rework + pause rules.** One-screen layout, Full-log sheet, hidden-tab pause, hunt hit areas/keyboard/skip/reduced motion. Tests: QA-009, QA-010.

### Block 4 — Engine and data split (2 d)
- [ ] **T40 Pure rules + state.** Port `speedInfo`, `dailyTick`, sickness, scoring, `pay`, events selection into `rules.js`/`events.js`; implement C1–C10 of Section 5.3; reducers return new state; unit tests per function (≥ 85 % branch coverage on `rules.js`, measured with `node --test --experimental-test-coverage` or c8).
- [ ] **T41 Moment interpreter, route graph, custom hooks.** Port moments to data; hooks `attock_cross`, `khyber_toll`, `kabul_dawn_rest`. Tests: each moment reachable and finishable by the bot; fake 2-edge graph shows road choice.
- [ ] **T42 Balance pass.** Build seeded bot runner in Node (headless, no browser: calls `rules.js` directly) for speed; tune `balance.json` to Section 5.4; produce `docs/BALANCE.md`. Then confirm with the browser bots (smoke 60 + full 300).

### Block 5 — Saves, PWA, release hardening (2 d)
- [ ] **T50 Storage & save/load.** Section 9 spec. Autosave triggers; Continue button; export/import; corrupt-save recovery screen; two-tab rule (see §9); storage-blocked banner. Tests: QA save matrix (Section 9.4).
- [ ] **T51 Settings sheet + first-run coach.** Section 4.3.
- [ ] **T52 PWA/offline/update.** `manifest.webmanifest`, `sw.js` (cache-first for app shell + fonts + data, network-first for `index.html` with offline fallback, versioned cache name `karvanyan-vX.Y.Z`, delete old caches on activate), update banner ("New version available — Reload"), `tools/make-precache.mjs`. Test offline relaunch, update flow, zero third-party requests, Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, installable.
- [ ] **T53 CI.** `.github/workflows/ci.yml`: install, `npm run verify`, upload artifacts (screenshots, bot CSV); nightly workflow: `bots:full`, Firefox + WebKit e2e, Lighthouse CI. Deploy job publishes to Pages only on `main` after green.

### Block 6 — Accessibility, QA pass, release (1.5 d)
- [ ] **T60 Accessibility & visual pass.** axe zero serious/critical on all screens; keyboard-only full playthrough script; 200 % zoom and 320 px reflow; contrast table passes; reduced motion; landscape 667×375 and 360×640; visual baselines committed.
- [ ] **T61 Full regression & soak.** 300 runs × 3 policies (random, careful, careful+guide) + hunt-spam policy; keyboard/viewport scripts; all QA-001…QA-012; save matrix; record in `docs/QA.md`.
- [ ] **T62 Owner playtest build + fixes.** Tag `v1.0.0-rc1`; give the owner the Pages URL and a one-page tester guide (task list in Section 10); log findings as GitHub issues with the template in Section 10; fix S1/S2.
- [ ] **T63 Release v1.0.0.** Changelog, version string in footer, `docs/RELEASE.md` checklist completed, rollback = redeploy previous tag.

---

## 8. Test-id contract (the tests depend on these; keep them stable)
`title-continue`, `title-new`, `btn-codex`, `btn-settings`, `btn-theme`, `merchant-{id}`, `merchant-{id}-details`, `setup-name-{i}`, `setup-month-{8|9|10}`, `setup-begin`, `hud-money`, `hud-food`, `hud-fodder`, `hud-party`, `hud-expand`, `hud-goods`, `hud-med`, `hud-animals`, `hud-day`, `hud-date`, `tab-town`, `tab-caravan`, `tab-learn`, `action-setout`, `action-rest`, `forecast`, `pace-{steady|hard|forced}`, `ration-{filling|meager|bare}`, `treat-{i}`, `sell-1`, `sell-5`, `sell-all`, `buy-food`, `buy-fodder`, `buy-med`, `guide`, `coach-next`, `coach-skip`, `travel-pause`, `travel-hunt`, `travel-rest`, `travel-progress`, `log-full`, `modal`, `modal-choice-{n}`, `modal-continue`, `moment-choice-{n}`, `moment-continue`, `hunt-field`, `hunt-skip`, `end-score`, `end-epitaph`, `end-leave-grave`, `settings-export`, `settings-import`, `settings-reset`, `settings-textsize`, `update-banner`, `save-banner`.
For debug: `window.__karvanyan` exists **only** when URL has `?debug=1`: `{getState(), setState(partial), forceEvent(id), setDate(iso), tick(n), seed}`. URL params in debug: `seed`, `start=<stopId>`, `month`, `money`, `food`. These must be impossible to trigger without `debug=1`.

---

## 9. Storage and save specification

### 9.1 Keys (localStorage; prefix `karvanyan.`)
`save.v1` (current run), `graves.v1` (array, max 8 entries — same as baseline), `top.v1` (top ten), `settings.v1`, `coach.v1` (first-run done), `meta.v1` (install date, build version). In-memory fallback object with identical API when `localStorage` throws or is blocked; `save-banner` appears: "Saving is not available in this browser mode. Your run will be lost if you close the tab."

### 9.2 Save envelope
```json
{ "app":"karvanyan", "schema":1, "build":"1.0.0", "savedAt":"2026-10-06T10:00:00Z", "checksum":"<fnv1a32 of JSON.stringify(state)>", "state":{...} }
```
Loading: parse → check `app` → check `schema` (migrate older with `migrations[n]`; refuse newer with message "This save is from a newer version") → verify checksum (mismatch = treat as damaged, offer repair via `validate()` clamp and ask) → `validate(state)`; any failure shows the recovery screen: [Start new game] [Import backup]. Never throw to the console without UI feedback.

### 9.3 When to autosave
On: arrival at a stop; after each modal/event resolution; after each purchase/sale; after rest; every 3 travel days; on `visibilitychange` → hidden; on `pagehide`; on game end (save cleared, grave + top ten written). Debounce writes to ≤ 1 per 400 ms. Show a subtle "Saved ✓" (aria-live polite) for 1.5 s.

### 9.4 Required automated cases (`tests/e2e/save.spec.mjs` + unit tests for storage.js)
Kill tab mid-travel / mid-event / mid-hunt / mid-moment (one of two choices used) / end screen; reload restores deep-equal state (ignoring `savedAt`); corrupt JSON; truncated JSON; checksum mismatch; wrong types; negative/NaN/huge numbers; `<script>` and HTML in names and epitaph (rendered as text; no execution — assert `window.__xss` stays undefined); future schema; older schema migration (add a fake v0 fixture); quota exceeded (simulate); blocked storage (`localStorage` getter throws); two tabs: the tab with the later `savedAt` wins and the other tab shows "This run was continued in another tab" and disables actions; export → import round trip; import of a non-save file rejected with message.

### 9.5 Data safety
Names max 16 chars, epitaph max 60; strip control characters; all dynamic text inserted with `textContent` (the baseline's `esc()` + innerHTML must not survive). Add a `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'">` (remove `'unsafe-inline'` for styles if no inline styles remain).

---

## 10. QA protocol (summary; full detail in `docs/QA.md`, created in T00)

- Layers: unit (`node --test`), data lint, e2e (Playwright: Chromium in CI; Firefox + WebKit nightly), bots (random / careful / careful+guide / hunt-spam), visual regression (≈ 25 screens × 320/390/768/landscape × light/dark), accessibility (axe + keyboard-only + contrast), performance/PWA (Lighthouse), real-device manual pass.
- Regression suite (must exist and pass before release): **QA-001** keyboard modal; **QA-002** no horizontal scroll; **QA-003** treat medicine; **QA-004** seasons by date; **QA-005** toll affordability; **QA-006** sarai sickness notice; **QA-007** proper-cased cargo; **QA-008** Hijri label; **QA-009** pause on hidden; **QA-010** forgiving hunt + skip; **QA-011** Set-out reachability; **QA-012** balance targets.
- Severity: S1 crash/freeze/lost save/cannot finish · S2 broken feature, wrong layout, wrong rules · S3 minor/cosmetic/text · S4 enhancement. No open S1 at release; S2 only with a written waiver in `docs/DECISIONS.md`.
- Bug template (GitHub issue): build version/commit, device + browser + OS, seed (from footer or `?debug=1`), steps, expected vs actual, screenshot/video, attached save export.
- Owner playtest tasks (adults, mix of iPhone/Android, ≥ 1 device from 2020): (1) start a game and reach Jalalabad without help; (2) cross the Indus; (3) finish or die; (4) open Codex and recall 3 facts; (5) close the browser, reopen next day, continue; (6) export a save; (7) install to home screen and launch offline. Capture time to first "Set out", stalls, misreads, taps that missed.
- Real-device minimum: one recent + one older iPhone (Safari tab **and** Home Screen install), one mid-range + one low-end Android (Chrome), desktop Chrome/Edge/Firefox/Safari. Network: normal, throttled 4G/3G, offline, flaky.
- Environment limits to remember: Playwright WebKit ≠ real iOS Safari; iOS may evict site data for sites unused ≈ 7 days unless installed; therefore export/backup UI is mandatory.

---

## 11. Definition of done for the sprint (release gate)
1. `npm run verify` and nightly full soak green on `main`.
2. Careful bot win rate 65–75 %, random ≤ 10 %, difficulty ordering and scores per Section 5.4; recorded in `docs/BALANCE.md`.
3. 0 JS errors and 0 soft-locks across ≥ 300 runs × 3 policies; keyboard test passes; no horizontal scroll at 320 px; axe zero serious/critical; contrast table passes.
4. Save matrix (Section 9.4) 100 % pass; offline relaunch and update flow pass; zero third-party requests.
5. Real-device passes done on the minimum set; at least 2 adult playtests complete with findings triaged.
6. All cards have `source` + `confidence` fields (values may still be "TBD/unverified" only if the owner accepted the waiver); expert review requested.
7. Live on GitHub Pages with version string; `README.md` explains run/test/deploy; `docs/BACKLOG.md` holds Sprint 2 candidates.

---

## 12. Sprint 2 backlog (do **not** start now)
Knowledge-gated choices with "📖 You learned this" tags; sarai nightly choice (default setting + notable-night prompts); kos minars + dak courier events; economy rescale to dams/paisa with a one-time conversion helper; Multani/Khatri banker merchant + hundi mechanic; Lohani/Powinda seasonal caravans; rahdari/allowance storyline at Khyber and Attock; Mughal-miniature SVG vignettes per stop (≤ 30 KB each, lazy, cached); shared graves/leaderboard with moderation (length limits, profanity filter, rate limits); pacing for the full route (longer, more varied legs); Attock → Rohtas → Lahore leg; history corrections for Persian/Armenian route plausibility and the Pashtun perk; Bangla/other UI languages; sound; difficulty scenarios 1650 "Where is the capital of Bengal?" and 1658 "war of succession".

---

## 13. Open decisions for the product owner (answer when asked; defaults in brackets)
1. GitHub owner/repository name [`<owner>/karvanyan`].
2. Display font choice after specimen [Aladin → Amiri → Almendra].
3. Leader death rule [C8: succession with −10 % score; alternative: baseline run-ends].
4. Dead-run scoring [C10 default as stated].
5. Seed leaderboard row replacing Ralph Fitch [remove or confirm figure].
6. Subject-expert reviewer for history cards [owner nominates].
7. Adult playtesters and phones [owner supplies].
8. Sound/music [not in Sprint 1].

---

## Appendix A — Baseline reference (frozen `baseline/index.html`, 852 lines)
Key anchors: `PACES` L167, `RATIONS` L172, price consts L177, `MERCHANTS` L179, `EDGES` L193, `CARDS` L205, `STOPS` L245, `dailyTick` L305, `momentFor` L368, `makeEvent` L657, `startHunt` L727, `LESSON` L790, `SEED_TOP` L803, `endGame` L816.
Baseline bot results to beat/match (captured earlier): random play 3/40 win; careful 39/40; careful+guide 38/40; winning avg score by merchant (careful): Persian 2938, Armenian 3062, Pashtun 4396, Uzbek 3856, Yarkandi 3266; dead-run scores ≈ 1,750–2,030.

## Appendix B — CI sketch (`.github/workflows/ci.yml`)
```yaml
name: ci
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run verify
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: qa-artifacts, path: |
          tests/visual/__diff__
          docs/baseline-results }
  deploy:
    needs: verify
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write, contents: read }
    environment: { name: github-pages }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: . }
      - uses: actions/deploy-pages@v4
```
(Exclude `baseline/`, `legacy/`, `tests/`, `tools/`, `node_modules/` from the deployed artifact with a copy step into `dist/` if size matters; no bundler is involved.)

## Appendix C — Effort summary
Block 0: 0.5 d · Block 1: 1.5 d · Block 2: 1.5 d · Block 3: 2 d · Block 4: 2 d · Block 5: 2 d · Block 6: 1.5 d → ≈ 11 focused days (+ owner playtest wait time).
