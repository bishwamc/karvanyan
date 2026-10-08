# Version 2.5.0 — ledger look (UI steps 1, 2 and 3)

Upload these 6 files over the same paths in the repo (unzip first; GitHub's uploader does not unzip):
index.html, css/style.css, js/ui.js, js/config.js, js/game.js, tools/contrast.mjs. No other file changes.

## Look (css/style.css)
- Light paper default, "lapis night" dark theme, ruled jadwal borders, small ink seal on Set out.
- Removed scanlines, hard shadows, neon glow, monospace display font, pixelated image scaling.

## Pictures (js/ui.js, js/game.js, js/config.js)
- Every picture is redrawn in a flat miniature style: flat colour, thin ink outline, raised horizon, rock ridges,
  domes and crenellated forts, lapis pack blankets on the animals. Still drawn by code: no image files.
- Canvas now holds 2x real pixels (CANVAS.RENDER_SCALE = 2) so lines are crisp. Game logic still uses 320x180 units.
- Hunt, fish and forage minigame re-coloured to match. Targets, hit areas, timing and scoring are unchanged.
- No text is painted inside pictures; the road screen has a real "Kabul -> Jalalabad · 12 of 42 kos" label.

## UI (js/ui.js)
- HUD: text-only ledger columns with days left under Rations and Feeds. Emoji removed from HUD, weather, Learn tab, dialog titles.
- "More details", "Set out for Jalalabad · 42 kos", Pause/Resume without symbols. Scanlines option removed.
- "Saved" note no longer covers Stay a day.

## Housekeeping
- GAME_VERSION 2.5.0; ?v=2.5.0 on every CSS/JS link. Save format unchanged: old saves still load.
- tools/contrast.mjs: light is the default block; checks the two dark copies match; adds a cinnabar-text check.

## Checked
- 19 unit tests pass; 36 contrast checks pass; no sideways scroll at 320/390/768 px; no console errors.
- Headless Chromium: all stop pictures, six weather road scenes, and a real foraging tap (hit registered).

## Not done
- Real painted illustrations per stop; a display font. Weather/event icons still exist in data (not shown).
