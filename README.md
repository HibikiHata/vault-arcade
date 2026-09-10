# Vault Arcade

Small classic games inside Obsidian, on desktop and mobile. Version 1.3 ships **Snake**, **2048**, **Blocks**, and **Minesweeper**; Sudoku is planned.

## Play

Open the arcade from the ribbon icon or the command **Vault Arcade: Open**. The tab opens on a menu with one entry per game and its best score.

| Game | Keyboard | Touch |
| --- | --- | --- |
| Snake (20×20, three speeds) | Arrows / WASD steer, Space or P pauses, Enter starts, Escape quits | Swipe anywhere in the view to steer, tap or the Pause button to pause |
| 2048 (4×4) | Arrows / WASD move, Enter starts, Escape quits | Swipe anywhere in the view to move |
| Blocks (10×20, three speeds) | Left / Right or A / D move, Up or W rotates, Down or S soft-drops, Space hard-drops, P pauses, Enter starts, Escape quits | Tap to rotate, drag left / right to move (one column per 24 px), swipe down to hard-drop, swipe up to rotate, Pause button to pause |
| Minesweeper (9×9 / 11×11 / 16×16) | Left click reveals, right click flags; Arrows / WASD move a cursor, Space reveals, F flags, Enter starts, Escape quits | Tap to reveal, press and hold (half a second) to flag |

Snake and Blocks keep a best score per speed level; 2048 keeps one; Minesweeper keeps one per board preset. The Minesweeper score is the number of safe cells revealed (there is no timer), the first reveal is never a mine, and the menu only offers presets whose cells are at least 32 px on a phone (24 px elsewhere); the chosen preset is saved with the plugin settings. Reaching 2048 shows a won screen with **Keep playing**. In Blocks all pieces share one color, a thin outline shows where the piece will land, the next piece is shown beside the well, the level rises every 10 lines, and a game ends when a new piece cannot enter the well. Keys pressed with Cmd, Ctrl, or Alt are left to Obsidian.

## What it stores and does not do

- Settings and high scores live in the plugin's `data.json` inside your vault, so they follow your vault sync. Nothing else is written; no note is read or modified.
- No network access, no telemetry, no external services.
- Works on iOS and Android (`isDesktopOnly: false`); requires Obsidian 1.13 or later.

## Development

```bash
npm install
npm run dev     # watch build -> main.js
npm run build   # type-check + production build
npm test        # vitest (src/core only)
npm run lint    # eslint with Obsidian rules
```

`src/core/` holds the game rules as pure functions (no Obsidian, DOM, timers, or random source of its own; randomness is injected) and is enforced by ESLint. `src/ui/` holds the host: the view, input, rendering, and persistence. A game is a module under `src/ui/games/` registered in `registry.ts`. Test names and comments cite acceptance criteria as `AC-nnn`; the list is in `docs/acceptance-criteria.md`.

Built from the author's plugin template (esbuild, vitest, eslint-plugin-obsidianmd); the template itself is not part of this repository.
