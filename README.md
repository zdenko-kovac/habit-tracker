# Habit Tracker

A personal, **on-device** habit tracker. Mark whether you hit each habit's daily
target, watch per-habit streaks grow, and know that **nothing ever leaves your
browser** — no accounts, no sync, no network calls.

**Live:** https://zdenko-kovac.github.io/habit-tracker/

## Features

- **Daily habits with a target count** — e.g. "drink water 6×", "5 short breaks in an 8-hour day". Mark the day done with a simple +/− stepper; a habit counts as *met* when the count reaches its target.
- **Per-habit streaks** — consecutive met days. Today-in-progress never breaks a streak; a missed past day resets it to zero (no grace days). The day rolls over at local midnight.
- **Add / edit / delete** habits, plus a **clear-all-data** control.
- **Private by design** — all state lives in your browser's `localStorage`. A strict Content-Security-Policy (`connect-src 'none'`) blocks all network egress, so the app physically cannot phone home.
- **Accessible** — full keyboard support, screen-reader labels, visible focus, and light/dark themes.

## How a streak works

A habit is *met* on a day when that day's recorded count ≥ the habit's target.
The current streak is the run of consecutive met days ending at the most recent met
day:

- **Today, not done yet** → neutral. Your streak reflects the run ending yesterday; it isn't broken just because today is incomplete.
- **A past day you didn't meet** → the streak resets to zero at that day.
- No freezes, no grace days — a miss is a miss.

The habit's day-by-day log is the source of truth; streaks are always derived from it.

## Tech

Vanilla HTML + CSS + ES modules. No framework, no build step, **no runtime
dependencies**. Vitest is the only dev dependency.

```
index.html        App shell (+ strict CSP)
src/
  main.js         UI wiring (the only module that touches the DOM or the clock)
  storage.js      localStorage load/save + untrusted-input sanitizer
  streak.js       Pure streak + date logic
  habits.js       Pure habit operations (add/edit/delete/record)
  flags.js        Client-side feature flags
  styles.css      Styling
tests/            Vitest unit tests
docs/LAUNCH.md    Pre-launch checklist, deploy & rollback plan
SPEC.md           Specification
```

## Develop

```bash
npm install        # installs Vitest (dev only)
npm test           # run the test suite (48 tests)
npm run test:watch # watch mode
npm run dev        # serve locally on a static server
```

All date/streak logic takes "today" as an argument, so the tests are deterministic
(no clock reads inside pure logic).

## Deploy

It's a static site — serve `index.html` and `src/` from any host. This repo deploys
to **GitHub Pages** automatically on every push to `main` (source: `main` / root).
Other options and the rollback plan are in [`docs/LAUNCH.md`](docs/LAUNCH.md).

## Feature flags

`src/flags.js` holds client-side flags. `weeklyHabits` (off by default) gates a future
weekly-cadence habit type; the shipped app is daily-only. For a local trial without a
redeploy, set in the browser console:

```js
localStorage['habit-tracker:flag:weeklyHabits'] = 'true'
```

## License

No license yet — all rights reserved by default until one is added.
