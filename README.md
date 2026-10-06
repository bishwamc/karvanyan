# Kārvānyān of Sadak-e-Azam: The Long Road East

An Oregon Trail–style history game on the Grand Trunk Road (Kabul → Attock demo, autumn 1665).

## Play
Open the GitHub Pages link of this repository. The front page sends you to `legacy/`, which is version 0.1.

## What is in this folder
| Folder | What it is |
|---|---|
| `legacy/` | **The game you play now (v0.1).** The baseline with the Sprint 1 hotfixes (keyboard lock, phone layout, medicine, toll, small text fixes). |
| `baseline/` | The original 2026-10-05 build. **Frozen: never edit.** Used to compare numbers. |
| `docs/` | Sprint plan (`SPRINT.md`) and test results (`baseline-results/`, `legacy-results/`). |
| `tools/` | Test bots and the script that builds `legacy/` from `baseline/`. |
| `tests/` | Automated checks. |
| `css/ js/ data/ fonts/ icons/` | Empty for now: the new build goes here in later sprint blocks. |

## Run it on your own computer (optional)
In a terminal, inside this folder: `python3 -m http.server 8080`, then open http://localhost:8080/
