# Confetti Blocks — product and implementation specification

## Product
An original, joyful block-placement puzzle inspired by the interaction pattern of Block Blast. A separate app and repository from Pocket Blocks. Children and adults can play without accounts, downloads, ads, purchases, timers, or data collection. Original name, artwork, code, animation, and synthesized audio; no copied branded assets. Publish a static site at https://derrick-tao.github.io/confetti-blocks/.

## Core rules
- An empty 8×8 board. A tray offers three fixed-orientation pieces, playable in any order. No gravity, rotation, falling pieces, or time limit.
- Shape pool: single cell; horizontal/vertical bars of 2–5 cells; 2×2 and 3×3 squares; 2×3/3×2 rectangles; small and large corners; T shapes; zigzags. Every shape fits within a 5×5 bounding box.
- Place a piece only if all its cells are on the board and empty. Invalid placement never changes the board, score, or tray. Full rows and columns are detected simultaneously, and their union is removed without collapsing the board. An intersecting cell clears once.
- Refill only after all three pieces have been used. At refill, each piece is selected independently from shapes that have at least one legal placement on the current board. This does not guarantee all three can eventually be placed together.
- End the game as soon as no remaining tray piece has a legal placement. An individually blocked piece stays visible and may become playable after another piece clears space. No paid revives, forced rerolls, or hints that alter the rules.

## Score and progression
- Placement: 10 points per cell.
- Clear: 100 × (rows + columns)² × streak. Streak is the number of consecutive placements that clear at least one line, starting at 1; a non-clearing placement resets it to 0.
- Clearing the entire board adds 500 points, once per placement.
- Show current score, personal best, total cleared lines, number of moves, and combo streak. Best score is stored locally; an unavailable or corrupt storage value does not prevent play. No in-progress save.
- Never interrupt a running game with milestones. A short celebratory toast marks clears, multi-line clears, combos, perfect clears, and the first new best in a run (only after surpassing a nonzero previous best).

## Interaction contract
### Pointer / touch
Drag a piece from the tray. Lift its full-size ghost above a touch pointer so the destination remains visible. Snap the board preview to cells; preview valid placements, invalid collisions, and rows/columns that would clear. Release over a valid position to commit. Release outside the board or cancel the pointer to return the piece unchanged. Drag distance threshold: 6px. Capture the pointer; disable touch scrolling only on pieces during manipulation. Cancel on page hide, blur, help/settings opening, or restart.

Alternative: tap a tray piece, then tap the board cell where its top-left bounding box should land. This works without dragging. Tap another piece to change selection. A blocked piece explains why it cannot fit; it is not consumed. Only one drag can be active at a time.

### Keyboard
1/2/3 selects a tray slot and focuses the board. Arrow keys move the placement anchor, Enter/Space places, and Escape deselects. Board cells support a roving tabindex and descriptive occupancy labels. Focus remains on the board after keyboard placement; select the next piece explicitly. Standard buttons are available for play, help, sound, effects, and restart. Restart asks for confirmation if the current game has moves.

## Visual design and effects
Soft lavender page, bold plum typography, bright candy-like beveled blocks, a dark violet board, rounded panels, original smiling block mascot, roomy controls, and friendly concise instructions. Desktop uses a central game with a playful intro and a guide; mobile puts scores, board, and tray first. Layout fits at 320px wide and remains usable in landscape.

Effects: hover lift, piece pickup ghost, snap highlight, placement pop, clear-cell shrink and glow, board glow, rising score text, combo badge bounce, a celebratory message, and particle confetti for clears. Multi-line/combos increase particle count and tune length. Effects remain local to the board with no rapid flashing or full-screen strobing. Lock input during the 280ms clear transition to avoid placing into a visually stale board. Cancel delayed effects safely on restart.

Calm mode disables movement, particles, and glow animations while preserving static placement/clear feedback and status messages. Respect prefers-reduced-motion by default; a user control can turn effects down at any time. Screen-reader announcements report placement points, line clears, combos, and game over without repeated hover messages. Decorative artwork is hidden from assistive tech. Controls have visible focus and at least 44px targets; the board uses a larger aggregate interaction area with arrow-key navigation.

## Sound
Web Audio, synthesized locally with no downloads: soft pickup tick, placement pop, invalid-placement note, ascending clear chimes, combo arpeggios, perfect-clear flourish, gentle game-over cadence, and start tune. Audio begins only after an explicit user gesture. Sound defaults on; a prominent mute button and a settings volume slider remain available. Suspend audio when the page is hidden. Remember sound, effects, and volume preferences where storage is available.

## Offline and installation
Cache the complete playable app automatically on the first successful HTTPS visit using a service worker scoped to this repository. Show a truthful “Ready to play offline” status only after the worker's core cache completes. All gameplay, sound, effects, instructions, and stored settings work without internet; no online-only game mechanics. A cold first visit still needs a connection. Offline navigation to the app URL and a closed/reopened tab must work after caching.

Provide a web app manifest, 192px/512px icons, and standalone display. Where the browser supports an install prompt, expose Install app; otherwise show instructions for Add to Home Screen / install through the browser. Installation is optional for offline play. Persistent cache storage is requested when supported, but browser data cleanup or storage eviction can remove downloads. Tell the user this in the offline/install help.

Version the cache. Cache all core assets atomically on service worker install; failed partial downloads never advertise offline readiness. New versions wait until the player chooses Update; confirm if a game is in progress. Once accepted, activate and reload. Remove superseded app caches on activation, preserving unrelated site caches. Navigation and core assets use the worker's versioned cache for consistency, with network fallback for uncached requests. Service worker registration checks for new releases on visits. No cross-origin caching or dependency requests.

Release checks additionally cover cache completion, navigation and reload with Chromium's network offline, all assets/effects/audio/settings usable offline, manifest/icon fetches, standalone metadata, and service worker scope under /confetti-blocks/. Test the deployed HTTPS URL as well as localhost. Offline readiness refers to this browser/device, not synchronization across devices.

## Technical design
Static HTML, CSS, ES modules, inline SVG, and Canvas particles, plus a manifest and service worker. No runtime libraries, remote fonts, third-party embeds, analytics, or external asset requests. A pure engine owns rules and scoring; UI owns rendering, audio, input, persistence, and effects. Board is DOM-based for inspectable cells and keyboard access. Use Pointer Events and requestAnimationFrame for particles, with a bounded particle count and one animation loop. Clear transitions have one cancellable timer. Production target under 120KB uncompressed excluding install icons. Works on modern Chrome/Edge/Firefox/Safari, including touch browsers; verify Chromium here and disclose untested physical devices.

## State and error handling
Ready → playing → game over; help/settings temporarily block play without losing the board. Returning from another tab preserves the game because there is no clock. Restart clears board, tray, counters, selection, pending transition, confetti, and messages. Storage/audio failures degrade to a playable silent/nonpersistent game. Resizing cancels drags and recomputes board geometry. Pointer cancel never places a piece.

## Test and release gates
Engine tests: shape definitions, all boundaries, occupied-cell rejection, row/column/intersection clears, no collapse, scoring, combo reset, perfect-clear bonus, tray exhaustion/refill, blocked-piece behavior, no-move game over, random-generator bounds, and restart.

Chromium checks: startup, selecting/placing with mouse and keyboard, touch tap and drag, cancelled/outside drag, invalid placement, clear animations, score/best persistence, restart confirmation, sound/settings, reduced motion, storage/audio failure, page hide, small mobile/landscape layout, no console errors, and actual repository-subpath loading. Inspect desktop/mobile screenshots. Publish only after checks pass.

GitHub Actions: test, build static output, upload official Pages artifact, deploy. Use relative paths. Repository is public under derrick-tao. Verify workflow success, HTTP 200, and browser play on the deployed URL. Source, spec, and local run instructions live in the new repository.
