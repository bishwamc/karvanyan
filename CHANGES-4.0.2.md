# 4.0.2 (UI overhaul, Phase 2: the margin card; builds on 4.0.1)

## Added
- **Margin card on the road screen**, the first block under the route strip. For rations and feed it shows the days you
  have, the days the next stop needs, a bar with a tick at "needed", and a verdict with a mark and a word:
  `✓ Enough`, `! Just enough` (covers the trip but not the spare days), `!! Not enough` (runs out before the next stop).
  Colour is only on the bar; the text is always ink.
- **`Engine.computeMargin(state)`**: one pure function. It uses the same maths as the stop screen's readiness check
  (leg days + `READINESS_MARGIN_DAYS`, no grazing), so the two screens cannot disagree. On the road it counts only the kos still to go.
- **Top bar, Party column:** "1 needs care" (amber, with "!") when anyone is sick or weak, so 4/4 cannot hide a fever.

## Changed
- Removed the road screen's old text line "Rations 86 d . Feeds 43 d . Khyber Pass about 4 d"; the margin card says the same thing.
  (The Stop screen's action bar keeps its own line.)
- Wide screens: the road screen's grid is placed explicitly. The route strip and notes were grid children and pushed the picture
  and Pause button below a long left column (picture 966 px down at 1280 x 800). Road page 1827 px -> 1347 px at 1280 x 800.

## Not changed
Save format, game rules, content, `getLegReadiness`, `game.js`. `GAME_VERSION` in `config.js` is still 4.0.0 (footer text); decide when to bump.

## Tests
- `tests/v402.test.mjs` (6): margin agrees with readiness for every merchant and five stockpiles; status boundaries; zero rations; road counts only kos left;
  no margin at Dhaka; the function changes nothing. Both boundary tests were mutation-checked (a deliberate off-by-one makes them fail).
- `tests/e2e/layout_budget.py` extended: margin card on the first screen at five sizes, bar maths in range, short supply reads "!! Not enough", sick member flagged in the top bar.

## Measured honestly (headless Chrome, Jalalabad -> Khyber road screen)
| Size | before Phase 2 | after |
| --- | --- | --- |
| 390 x 844 | 1292 px | 1404 px (taller: the card is new and nothing else collapsed yet) |
| 1280 x 800 | 1827 px | 1347 px |
Phone scrolling on the road gets slightly worse until Phase 3 collapses the duplicate blocks (party strip, caravan details, evening ledger).
