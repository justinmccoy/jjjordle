---
name: verify
description: Build, run, and drive JJJORDLE end-to-end to verify a change works in the real app.
---

# Verifying JJJORDLE

## Build + launch

```bash
npm run build --prefix client                 # builds client/dist (vite)
cd server && NODE_ENV=production node index.js &   # serves API + client/dist on http://localhost:3001
curl -s http://localhost:3001/api/config      # smoke test: {"rows":6,"cols":5,...}
```

The answer/sentence come from `server/.env` (`WORDLE_ANSWER=PUPPY`). No client dev server needed — the built app on :3001 is the full surface.

## Drive it (headless Chrome via playwright-core)

No Playwright browsers are installed; use `playwright-core` with the local Chrome binary:

```js
const { chromium } = require('playwright-core');
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
```

Install `playwright-core` in a temp dir, not the repo.

## Flows worth driving

- **Win:** clear localStorage, type the answer (`page.keyboard.press` per letter + Enter), wait for `#overlay.show` (~2s of tile flips first) → close via `.close-x` → `#completion-screen` appears → `.comp-admire` dismisses it to the board.
- **Persistence:** reload after winning — game state and completion screen restore (localStorage keys are `jjjordle_<sessionKey>`; legacy saves use `sentencePanel` instead of `completion`).
- **Loss:** 6 valid wrong guesses (e.g. CRANE, AUDIO, STONE, LIGHT, BRICK, FLAME) — wait ~2.3s between rows for flip animations; win photo must NOT appear.
- **Escape** closes the overlay, then the completion screen.

## Gotchas

- Tile flips take ~300ms × 5 per row; screenshot too early and you capture mid-animation cross-fades.
- Guesses are dictionary-validated against `server/words.txt` (invalid words shake, don't consume a row).
- Capture `console` errors and `pageerror` in the driver — the app is a single React file (`client/src/App.jsx`) and wiring mistakes surface there.
