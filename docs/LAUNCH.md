# Launch Plan — Habit Tracker

Static, single-user, on-device web app. No backend, no database, no accounts, no
network egress (enforced by CSP `connect-src 'none'`). This plan adapts the standard
shipping checklist to that reality — items that assume a server/multi-user traffic are
marked **N/A** with the reason, not silently skipped.

---

## 1. Pre-Launch Checklist

### Code Quality
- [x] All tests pass — 48/48 Vitest (`npm test`)
- [x] Build succeeds — no build step; ES modules served as-is. `node --check` clean on all src.
- [~] Lint/type checking — **no linter/tsc configured.** Gap, not a blocker for a static app of this size. (Follow-up: add ESLint.)
- [x] Code reviewed — five-axis review completed; security hardening pass completed.
- [x] No stray TODOs in production code
- [x] No `console.log` debugging statements — verified `grep -rn console src/` is clean
- [x] Error handling covers expected failures — corrupt/tampered storage, invalid input

### Security
- [x] No secrets in code or VCS — nothing to store; app holds no credentials
- [x] Dependency audit — only devDependency is Vitest; **zero runtime dependencies**. `npm audit` reports 6 findings (2 critical/1 high), **all in Vitest's transitive dev tree** (esbuild/vite dev-server advisories, Vitest mock path-traversal). **Reachability: none** — they are not in the shipped artifact (`index.html` + `src/`), only the local test toolchain. Fix = `vitest@5` (breaking major). **Deferred**, review by **2026-12-01**: upgrade Vitest as an isolated dev-tooling change, not a launch gate.
- [x] Input validation at boundaries — `validateFields` on add/edit; `sanitizeDoc` on load
- [x] Output encoding / XSS — all rendering via `textContent`; zero HTML sinks in `src/`
- [x] Security headers — strict CSP meta (`default-src 'none'`, `connect-src 'none'`)
- [N/A] Rate limiting on auth — no auth, no server
- [N/A] CORS — no cross-origin requests; CSP forbids all egress

### Performance
- [x] Core Web Vitals — trivially green; one small HTML page, no fonts/images, no network
- [N/A] N+1 queries — no database
- [N/A] Image optimization — no images (one emoji glyph)
- [x] Bundle size — ~6 hand-written JS modules, no bundler, no dependencies shipped
- [N/A] DB indexes / query caching — no database
- [~] Static asset caching — depends on host defaults; set long cache on `/src/*` at deploy (see §3)

### Accessibility
- [x] Keyboard navigation — all controls are native `<button>`/`<input>`; tab order natural
- [x] Screen reader — semantic landmarks, labelled fields, `aria-live` list, `role="alert"` errors, decorative emoji `aria-hidden`
- [~] Color contrast WCAG AA — designed against it (dark/light tokens) but **not yet machine-verified.** Follow-up: run axe/Lighthouse.
- [x] Focus management — edit mode autofocuses the name field; visible focus ring
- [x] Descriptive error messages associated with fields
- [~] No axe/Lighthouse warnings — **not yet run** (no MCP/browser-automation in this env). Manual click-through done.

### Infrastructure
- [N/A] Environment variables — none
- [N/A] Database migrations — no DB (schema migration is client-side via `sanitizeDoc`)
- [~] DNS / SSL — provided by the chosen static host (GitHub Pages/Netlify/etc. give HTTPS automatically)
- [~] CDN — provided by host
- [N/A] Server logging / error reporting — no server; errors stay on-device (by design — privacy)
- [N/A] Health check endpoint — static files; "health" = the page loads

### Documentation
- [x] SPEC.md current
- [x] tasks/plan.md reflects what shipped
- [x] This launch plan written
- [~] README — **none yet.** Follow-up: a short run/deploy README.
- [~] Changelog — commit history is conventional-commits and serves as one; no CHANGELOG.md.

---

## 2. Feature Flag — `weeklyHabits`

The spec's non-goals explicitly exclude weekly cadence, so the shipped default stays
daily-only and faithful to the approved spec. A new **weekly habit-type** is gated
behind `FLAGS.weeklyHabits` (`src/flags.js`).

- **Owner:** you (product). **Expiration:** 2026-12-01 — by then either build out weekly fully or remove the seam.
- **Default:** OFF. App behaves exactly as the spec (daily-only); no weekly UI.
- **Per-device override (no redeploy):** in DevTools console —
  `localStorage['habit-tracker:flag:weeklyHabits'] = 'true'` then reload.
- **Both states tested in CI:** `tests/flags.test.js` (default, on-override, off-override, unknown, storage-unavailable).
- **Current scope:** the flag + resolver seam only. The weekly streak engine is NOT
  built yet — this ships the kill switch, not a half-finished feature. Flipping the
  default to ON is itself a gated future change that requires the engine first.

Lifecycle: DEPLOY (off) → enable on your own device via override → decide → either
build weekly + flip default, or delete flag + seam by the expiration date.

---

## 3. Deploy Plan (any static host)

The repo root is the web root. Three equivalent options; pick one.

### Option A — GitHub Pages
1. Push repo to GitHub.
2. Settings → Pages → Source = `main` branch, `/root`.
3. Wait for the Pages build; note the `https://<user>.github.io/<repo>/` URL.
4. Smoke test (§5).

### Option B — Netlify / Vercel (drag-and-drop or CLI)
1. `netlify deploy --dir . --prod` (or drag the folder into the Netlify UI).
2. No build command, no publish subdir — serve the root as-is.
3. Smoke test (§5).

### Option C — any bucket/CDN (S3 + CloudFront, etc.)
1. Upload `index.html` + `src/*` (exclude `node_modules`, `tests`, `docs`).
2. Set `Cache-Control: max-age=31536000, immutable` on `/src/*`; `no-cache` on `index.html`.
3. Front with HTTPS. Smoke test (§5).

**Do not deploy** `node_modules/`, `tests/`, or `package-lock.json` — only `index.html`
and `src/`. (`.gitignore` already excludes `node_modules`.)

---

## 4. Rollback Steps

A static deploy has two independent rollback levers — both fast:

### Lever 1 — Feature flag (if a flagged feature misbehaves)
- Set `FLAGS.weeklyHabits = false` in `src/flags.js`, redeploy. **< 2 min.**
- Or tell affected users to clear the per-device override. Instant, no deploy.

### Lever 2 — Redeploy previous version (if the core app breaks)
1. `git revert <bad-commit> && git push` (or `git checkout <last-good-tag> -- . `), then re-run the chosen deploy option. **< 5 min.**
   - GitHub Pages: reverting `main` triggers an automatic re-publish.
   - Netlify/Vercel: one-click "rollback to previous deploy" in the dashboard, **< 1 min**, no git needed.
2. Verify via smoke test (§5).

### Data considerations
- No server data. User data lives in each browser's `localStorage`.
- A rollback does **not** touch user data. The `sanitizeDoc` boundary means an older
  app version safely reads a doc written by a newer one (unknown fields dropped, never
  crashes) — so forward/back deploys are safe for existing users.
- No destructive migration exists to reverse.

### Trigger conditions (adapted — no server metrics)
- App fails to load / blank page after deploy → Lever 2.
- A flagged feature causes errors in the console or broken UI → Lever 1.
- Habit data appears corrupted or lost on load → Lever 2 + investigate `sanitizeDoc`.

---

## 5. Post-Deploy Smoke Test (first 10 minutes)
1. Page loads over HTTPS, no console errors.
2. Add a habit → appears under Today.
3. Increment to target → status flips to "Done", streak → 1.
4. Reload → habit + streak persist (localStorage).
5. DevTools → Network: only same-origin requests; zero external calls.
6. With the flag OFF, confirm no weekly UI is present (spec-faithful default).
