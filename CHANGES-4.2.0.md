# Release 4.2.0 – the wide road screen (from your mockup)

Phone layout is unchanged. On screens 900 px wide and up, the road screen is now five bands:

1. **Status bar:** date and day, weather, next stop and kos left, Food and Feed (days in hand, days needed, and a mark: tick / ! / !!), Medicine, Money.
2. **The moving caravan:** the scene with a progress bar and "from → to · N of M kos" under it. The scene is cropped, not stretched (4.1.1 had squashed it).
3. **News line:** the latest news, one line, fades in. It does not scroll. "Log" opens the full list.
4. **Control band:** Rations (Filling / Meagre / Bare bones) on the left; Pause with Pace (▸ Steady, ▸▸ Hard, ▸▸▸ Forced) in the middle; Rest a day, Caravan, Supplies, Map on the right. One line says what the chosen pace and rations do, plus the key hints.
5. **Cards:** Animals (count, weak, load against capacity; opens the Caravan sheet) and one card per party member (role, exact health, mark and word, a Treat button on the sick, greyed "Died" for the dead). The row wraps for any party size.

Same actions, radio groups and keys as before (Space, R, C, S, L, M). Colours follow the game's own light and night themes, not the mockup's green and purple.

## Tests
70 unit tests; `layout_budget.py` (wide road fits 1280x800 and 1366x768 with the cards on screen; chips show need and tick; scene not stretched; bands in order); `screens_v41.py` (rations/pace change the effect line, animals card opens the sheet, keys work). A mutation (stretching the scene) is caught.

## Limits
- The page footer (settings, end run) is below the fold on the road at 1366x768.
- Not seen on a real desktop browser yet.
- The scene is cropped to a wide strip, so the top of the sky is cut.
