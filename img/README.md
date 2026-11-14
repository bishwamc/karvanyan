# Images for Kārvānyān (v4.1 drop folder)

Put the finished `.webp` files in these folders, with exactly these names. The game looks for each file when it needs
it. If a file is missing, the game draws its built-in picture instead and nothing breaks. You can add images one at a
time, in any order.

| Folder | File name | Size | Budget | Count |
| --- | --- | --- | --- | --- |
| `img/ui/` | `title_hero.webp` | 1200 x 675 | 120 KB | 1 |
| `img/ui/` | `letter_paper.webp`, `seal_red.webp` | 900 x 1200; 256 x 256 | 80 KB; 20 KB | 2 |
| `img/stops/` | `stop_<stopId>.webp` | 960 x 540 | 70 KB | 31 stops |
| `img/portraits/` | `por_<candidateId>_<mood>.webp` (mood: `content`, `worried`, `grieving`) | 512 x 512 | 40 KB | 18 |
| `img/events/` | `ev_<eventId>.webp` | 960 x 540 | 70 KB | 6 |

Stop ids: kabul, jalalabad, khyber, peshawar, attock, hasan_abdal, rohtas, jhelum, gujrat, lahore, amritsar, jalandhar,
ludhiana, sirhind, ambala, karnal, panipat, delhi, mathura, agra, etawah, fatehpur, allahabad, varanasi, sasaram, patna,
munger, bhagalpur, rajmahal, makhsusabad, dhaka.

Event ids: lame_camel, toll, ferry, sarai_night, ambush, grave.
Candidate ids: naseer, hakim_jafar, bibi_gulnar, sher_dil, munshi_kishan, gul_zaman.

Priority first (spec section 8): `title_hero`, `letter_paper`, `seal_red`, the five stops kabul, jalalabad, khyber,
peshawar, attock, `ev_lame_camel`, and the portraits of naseer, hakim_jafar, bibi_gulnar.

A browser console may log a "404" for each image that is not there yet. That is normal and harmless.
Every picture's description (alt text) already lives in `js/content.js` under `IMAGE_ALT`.
