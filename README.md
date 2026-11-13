# Confetti Blocks

**Small blocks. Big yay.** An independently named 8×8 block puzzle with drag-and-drop, row/column clears, combos, confetti, friendly synthesized sound, and offline play.

- [Play the game](https://derrick-tao.github.io/confetti-blocks/)
- [Full product and implementation spec](SPEC.md)
- [Audit remediation spec and verification](REMEDIATION_SPEC.md)

No runtime dependencies, accounts, ads, purchases, third-party runtime assets, or analytics. The app keeps gameplay local; GitHub processes hosting security logs as disclosed in [Privacy & local storage](privacy.html). Desktop and mobile; tap-to-place and keyboard controls are available alongside dragging.

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

`dist/` contains only production files, including content-addressed JS/CSS, a generated integrity manifest embedded in the worker, and the cached privacy notice. Serve built output; the source worker is a build template.

For full local verification:

```sh
npm ci
npx playwright install chromium
npm run test:all
```

Tests start ephemeral servers bound to localhost and serve the built site under `/confetti-blocks/`. No separate server is needed. `npm test` runs engine/build checks and produces dist; `npm run test:browser` exercises pointer, touch, keyboard, CSP, privacy and offline reopening. `npm run test:offline` covers update consent, old-tab snapshots, same-ID/integrity failure, first-download retry, and interrupted download recovery. `npm run test:performance` checks bounded retained memory and frame-batched drag structure.

Use `TEST_URL=https://…/confetti-blocks/ npm run test:browser` for a normal live-site smoke test. Performance/load tests always remain local. Set `CHROMIUM_PATH` for a specific executable. Local Linux can use `/usr/bin/chromium`; CI uses Playwright's installed matching browser. Screenshots and metrics go in ignored `test-results/`.

Regression budgets: production assets under 120 KB excluding install PNGs; 1,320 repeated placements with less than 2 MiB retained JS heap growth, total JS heap under 16 MiB, at most 12 node and 2 listener difference; a reused ghost with zero move-time child mutations or board-cell layout reads across 360 moves. These deliberately generous laboratory limits detect regressions; they do not guarantee field frame rates or thousands-user hosting capacity.

## Deploy
GitHub Pages source: GitHub Actions. Push to `main` or manually run the deployment workflow. It runs all engine/build/browser/offline/performance gates before uploading and deploying the official Pages artifact. Relative URLs support project Pages paths. Release identities, integrity manifests, and hashed JS/CSS URLs are generated automatically from all production inputs and build logic. Failed candidate downloads preserve the active snapshot. Serve dist/, never the worker template.

## Verification
Engine tests cover shape geometry, placement rules, clear intersections, score/combos, no-collapse behavior, perfect clears, refill, game over, and reset. Browser tests cover keyboard/pointer/touch, invalid and cancelled placements, celebrations, settings, storage failure, reduced motion, responsive layouts, and offline reload/reopen. Automated tests run in Chromium; physical iOS/Android devices, Firefox, and Safari require separate verification.


## Privacy, rights, and hosting limitations

[Privacy & local storage](privacy.html) describes local scores/settings, offline files, GitHub security/IP logs, clearing controls, and a parent/guardian contact path. [Provenance and rights](PROVENANCE_AND_RIGHTS.md) records AI-assisted assets, development notices, current reuse status, and outstanding legal decisions. There is no general open-source license grant or trademark/patent/children’s-privacy clearance represented by this repository.

The app ships a restrictive meta CSP and no-referrer policy, without reporting endpoints or tracking. Standard GitHub Pages cannot set arbitrary HTTP security headers. A dedicated origin with header controls should add `Content-Security-Policy: …; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and an appropriate Permissions-Policy disabling unused camera/microphone/geolocation. A meta policy cannot enforce frame-ancestors. No ignored `_headers` file is supplied. Sibling GitHub project sites share origin storage despite distinct worker scopes.

Previous app snapshots are preserved while multiple game tabs remain open, so older tabs can still retrieve their immutable assets. Once only one game tab remains, the active worker's cleanup message (on the next visit) removes superseded snapshots; unrelated origin caches are preserved. A successfully installed update still waits for acceptance before restarting an active board. Failed downloads show a retry control in offline help.

GitHub Pages documents soft traffic limits and possible rate limiting, not a concurrent-player SLA. Gameplay has no shared server compute, but a major cold-download burst and commercial promotion require a separate hosting/traffic review. Browser test tooling and third-party actions are development dependencies only; CI pins reviewed action commits and Dependabot proposes updates.
