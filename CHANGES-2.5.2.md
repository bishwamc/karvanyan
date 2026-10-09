# Version 2.5.2 — one Ask around card per stop, in the traveller's own voice

If you already uploaded 2.5.1, upload only these 6 files:
index.html, js/config.js, js/content.js, js/ui.js, tests/game.test.mjs, docs/facts.md.
If not, upload all 11 files in this folder (2.5.1 fixes are included).

- Every stop now has exactly one city card and one Ask around card (31 + 31). Before: Kabul had 4, most stops none.
- Ask around cards are written in first person ("A boatman told me..."), 45 words or fewer.
- Cards the rules depend on keep their ids: rivers (Indus crossing), rahdari (haggling), hakim (cures), dysentery (sarai story).
- Removed two old cards: "What is in a name?" (now inside the Attock city card) and "Places beyond the road's end".
- After you ask, the answer now stays visible in the Learn tab (it used to appear only in the Codex).
- Tests now require one Ask card per stop and a first-person voice. 22 tests pass.
