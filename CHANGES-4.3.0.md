# Release 4.3.0 – the phone road screen (from your mockup)

The wide road screen (4.2.0) and the phone road screen now share one design, stacked on a phone:

1. **Status chips:** two rows. Weather and day, next stop and kos left; then Food, Feed, Meds, Money. Food and Feed show days in hand and a mark (✓ / ! / !!). When supplies are not enough the chip also says how many days the trip needs ("Food 2 d · need 6 !!").
2. **The caravan scene** with a progress bar and "from → to · N of M kos".
3. **News line:** one line, fades in, no scrolling; Log opens the full list.
4. **Controls:** Rations (Filling / Meagre / Bare bones); Pause with Pace (▸ Steady, ▸▸ Hard, ▸▸▸ Forced); Rest a day and Map. One line says what the choices do (hidden on short phones).
5. **Cards, two across:** Animals (opens the Caravan sheet), one card per party member (exact health, mark and word, Treat on the sick), and "Caravan and supplies" (opens the exact supplies list).

Removed on phones: the pinned bottom control bar, the margin card, the top HUD on the road. Space, R, C, S, L, M keys still work on a keyboard.

Paused phone: the picture is replaced by the exact supplies; exact health stays on the cards.

## Measured (headless Chrome)
390 x 844 and 412 x 915: one screen. 360 x 740: cards end at 715; the page scrolls a little with the paused panel. Landscape phone (667 x 375) scrolls.

## Limits
- No portraits on the cards (no art).
- The footer (settings, end run) is hidden on the phone road, as before.
- The Pause button is no longer pinned; on a very short phone it can scroll out of view.
- Not seen on a real phone.
