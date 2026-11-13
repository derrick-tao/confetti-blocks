# Confetti Blocks

**Small blocks. Big yay.** An original Block Blast–inspired 8×8 block puzzle with drag-and-drop, row/column clears, combos, confetti, friendly synthesized sound, and offline play.

- [Play the game](https://derrick-tao.github.io/confetti-blocks/)
- [Full product and implementation spec](SPEC.md)

No runtime dependencies, accounts, ads, purchases, third-party assets, or analytics. Desktop and mobile; tap-to-place and keyboard controls are available alongside dragging.

## Offline play
Open the game once online and wait for **Downloaded · ready to play offline** below the game. All game files, sounds, and artwork are cached automatically. You can then reopen the page without Wi-Fi. Installation is optional: use Install app / Add to Home Screen in your browser; iPhone/iPad uses Safari → Share → Add to Home Screen.

The download belongs to this browser/device. Clearing site data, private browsing restrictions, or browser cache eviction can remove it. Reopen online to download again. Service workers require HTTPS or localhost. The first visit needs internet. New releases wait for you to accept **Update game**, with confirmation before restarting an active board.

## Play
Drag one of three pieces onto an empty space, or tap a piece then its top-left destination. Fill rows or columns. Use all three pieces to get three more. Pieces do not rotate and there is no time limit. The game ends when no remaining piece fits.

Keyboard: 1/2/3 selects a slot; arrows move the anchor; Enter/Space places; Escape deselects. Sound, volume, and calm mode are configurable. Reduced-motion preference is respected by default. Best score and preferences stay local.

## Local development
Node.js 22+ and Python 3:

```sh
npm start
# http://localhost:4175
npm test
npm run build
```

`dist/` contains only the production static app. `npm ci` installs optional browser test tooling; no packages are needed by the game or build. With a server running, `node tests/browser.mjs` runs Chromium checks. Set `TEST_URL` to a repository-subpath URL to test deployment, and `CHROMIUM_PATH` if Chromium is not `/usr/bin/chromium`. Screenshots go in ignored `test-results/`. `node tests/offline-update.mjs` starts its own test server and verifies update consent, coherent activation, and recovery from an interrupted download.

## Deploy
GitHub Pages source: GitHub Actions. Push to `main` or manually run the deployment workflow. It tests the engine, stages all app/PWA files, and deploys the official Pages artifact. Relative URLs support project Pages paths. Bump the cache version in `sw.js` whenever production files change so existing offline users receive a coherent update.

## Verification
Engine tests cover shape geometry, placement rules, clear intersections, score/combos, no-collapse behavior, perfect clears, refill, game over, and reset. Browser tests cover keyboard/pointer/touch, invalid and cancelled placements, celebrations, settings, storage failure, reduced motion, responsive layouts, and offline reload/reopen. Automated tests run in Chromium; physical iOS/Android devices, Firefox, and Safari require separate verification.
