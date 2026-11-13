# Audit remediation specification

Baseline: `a336ee295871af1ec7072dd66a1b55648a76787d`. User authorization: implement the high/medium audit findings, independently verify, commit, and push to the existing repository. Preserve the game's appearance, rules, sounds, touch/keyboard support, local scores, and GitHub Pages/offline delivery.

## 1. Safe offline releases — priority 1

Replace manual cache-version maintenance with a deterministic release identity generated from **all** production inputs, including worker logic, HTML, styles, scripts, icons, manifest, and privacy content. Identical inputs produce identical output; changing any shipped input changes the release identity. Build only stages output and never edits tracked source files.

Generate content-addressed JS/CSS asset filenames, rewriting module imports and HTML references so one release cannot fetch a different release's code. Generate the precache list from build output; remove redundant root/index precaching. Retain the same project-relative worker URL/scope and standalone start URL. Privacy/help remain available offline.

Candidate installation must never overwrite or delete an already usable cache. Use isolated release caches and non-destructive failure cleanup. Explicitly guard reuse of an existing identifier: a worker change or failed asset request with the same identifier must preserve the previous working cache and offline navigation. A failed first download must show truthful failure/retry guidance, never an indefinite ready promise. Offer retry without requiring clearing browser data.

Updates wait for player acceptance, with confirmation for a running board. Offline scores/preferences survive. Activate only a fully cached candidate. Clean up superseded app caches safely and leave unrelated origin caches untouched. Avoid breaking other open game tabs; document and test the chosen transition behavior.

Acceptance: reproducible clean builds; identity changes for script-only, worker-only, icon/privacy changes; successful waiting/accepted update; declined update preserves board; failed versioned and deliberately same-ID update preserve old offline play; failed first-install retry works; offline reload and closed-tab reopen pass under `/confetti-blocks/`.

## 2. Frame-batched drag rendering — priority 2

Build one ghost per drag and reuse it. Cache board geometry at pickup; cancel/recompute safely on resize and scrolling. Pointer moves record the latest coordinates and schedule at most one requestAnimationFrame render. Use transform for positioning; preserve the touch lift, shape scale, invalid preview, and line-clear preview. Update only affected preview cells and skip preview recalculation when piece, board, and snapped anchor are unchanged.

Pointer-up must synchronously use the latest pointer position even if a frame has not rendered yet. Cancel pending frames on pointer cancellation, loss of capture, blur, dialog open, restart, visibility hide, resize, or relevant scroll. No late placement or revived ghost after cancellation. Preserve tap-to-place and keyboard behavior, including safe handling of selection changes during dragging.

Acceptance: existing desktop/touch tests pass; additional same-frame move/up, move/cancel, cancellation after queued RAF, and repeated drags pass. Instrumentation verifies ghost node reuse and no per-move layout reads. Add a generous performance/memory regression budget rather than a flaky device-specific 60fps assertion.

## 3. Release protection — priority 2

Pin every third-party GitHub Action to a verified full commit SHA with a version comment. Prefer supported action runtimes. Keep minimal job-scoped deployment permissions; disable checkout credential persistence when not needed. Add Dependabot configuration for actions and npm.

CI must install locked dev dependencies with `npm ci`, install the matching official Playwright Chromium, and run engine, build/cache, browser, offline-update, and bounded performance/memory checks **before** uploading/deploying. Browser tests should serve built production assets from an ephemeral localhost-only server, support a configured live TEST_URL, and use a configurable Chromium executable instead of requiring `/usr/bin/chromium` on CI. Keep tests dependency-free at runtime and publish no test/dev files in dist. Limit runaway test time and retain diagnostic output on failure.

Document reproducible local commands and regression budgets. Include a production asset-size budget (120 KB excluding icons), generous post-GC retained-memory and stable listener/node budgets, and structural drag frame-batching checks. Keep synthetic load local; do not bombard Pages.

## 4. Practical browser security hardening — priority 2 in detailed audit

Add a workable restrictive meta CSP and explicit no-referrer metadata to built HTML pages. Keep local modules, SVG use elements, PWA, audio synthesis, dialogs, and dynamic pieces functional. Prefer DOM construction/CSS property APIs over generated HTML style attributes so broad inline script/style permissions are unnecessary. No eval, remote assets, data collection, or telemetry. Verify no CSP violations during actual interactions and offline play.

GitHub Pages cannot supply arbitrary anti-framing/nosniff/Permissions-Policy headers. Document recommended headers and dedicated-origin deployment as a remaining hosting limitation; do not claim a meta tag enforces frame-ancestors or change hosting/domain without a destination. Do not add misleading header files that Pages ignores.

## 5. Privacy, provenance, and legal documentation — priority 1/2

Add an accessible, locally cached privacy notice linked from the game. Explain exactly which values stay in localStorage (best score, sound, volume, calm preference), cached game files, browser clearing/eviction, no app-level score uploads/accounts/ads/analytics, and GitHub's IP/security logging with primary links. Avoid blanket “no data collection” or legal-compliance guarantees. Provide a parent/guardian contact path to the existing public repository/maintainer; do not publish a new personal email or solicit children's personal information in public issues. Correct README and SPEC claims. External links must not break offline game functionality.

Add provenance/third-party notices for programmatically created SVG/PNG/CSS/audio and Playwright development dependencies, reflecting AI-assisted creation accurately. Replace competitor-name marketing in README with a generic genre description; retain independent/non-affiliation wording where a historical comparison remains useful. State that trademark/trade-dress/patent clearance and jurisdiction-specific children's privacy review remain outstanding. No fabricated clearance, consent certification, ownership guarantees, or grant of a new open-source license on the owner's behalf. Explain current rights/reuse status explicitly and record licensing as a maintainer decision.

Acceptance: privacy reachable by keyboard/touch and offline; app storage/network behavior agrees with notice; existing best score survives update. No external runtime assets, tracking, or accidental publication of owner email. Legal questions that require a clearance search, counsel, or owner licensing choice are reported as residuals, not marked fixed.

## 6. Verification, commit, and publication

Implementation agent edits and tests but does not commit/push. Parent independently reviews the diff and checks acceptance, reruns meaningful production/browser/offline/performance tests, repairs any failures, then commits and pushes to main. Watch Pages CI through deployment and smoke-test the live production URL, including new-worker migration and offline behavior. Report commit, spec link, validation, and remaining external/legal/hosting limitations.

Audio voice disposal and other low-priority items are outside the required scope unless a small necessary cleanup arises. This work does not constitute a public load test or a promise of a GitHub Pages concurrency SLA.

## Verification record — 13 November 2026

The implementing agent completed the changes, and the parent reviewed the diff and independently ran `npm run test:all` against the final production build. All 15 engine/build tests and the browser, offline-update, and performance gates passed.

- Adversarial offline checks cover same-ID reuse/mismatch, failed candidate preservation, first-download retry, interrupted candidate recovery, accepted/declined updates, old-tab and legacy-v1 assets, unrelated cache preservation, and offline play.
- Parent migration test started from the actual archived `a336ee2` app: update consent, best score, sound/calm/volume preferences, and offline play survived migration to the built release.
- Parent policy/privacy check confirmed offline notice navigation at 320px, hosting-IP disclosure, and actual blocking of an injected inline script. Legitimate migration/gameplay produced no CSP or page errors.
- After 1,320 placements, post-GC heap measured 1,921,820 → 1,969,912 bytes; tracked DOM nodes stayed at 536 and listeners at 260.
- Across 360 drag moves: zero move-time cell layout reads, zero ghost child mutations, one reused ghost, and 61 ghost style writes. Same-task pointer-up and queued cancellation passed.
- Production output totals 74,444 bytes including install icons, worker, and offline privacy notice; the production budget gate passes. `git diff --check` passes.

These are Chromium laboratory results, not field-device, legal-clearance, or public-host capacity certification. GitHub Pages deployment and live-site checks are verified after pushing; their authoritative status is in the repository's Actions history.
