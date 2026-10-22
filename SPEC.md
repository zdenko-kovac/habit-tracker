# Spec: On-Device Habit Tracker

## Objective

A personal, single-user habit tracker that runs entirely in the browser with all
data stored locally. Each day the user confirms whether they met each habit's daily
target; the app tracks a per-habit streak that grows by one for every met day and
resets to zero on any missed day.

**User:** One person, one device. No accounts, no sharing.

**Why:** The user has recurring workday habits (drink water 6×/day, 5 short breaks in
an 8h workday, no-phone hour, etc.) and nothing that tracks whether they actually hit
them day to day.

**Success looks like:** Open the app, see today's habits, mark each as met/not-met
against its target, and see an accurate per-habit streak count that reflects the
reset-on-miss rule — with zero data ever leaving the device.

## Tech Stack

- Vanilla HTML + CSS + JavaScript (ES modules). No framework, no build step required.
- `localStorage` for persistence.
- Vitest for unit tests of pure logic (streak + date functions).
- Modern evergreen browsers only.

## Commands

```
Install: npm install
Test:    npm test
Test watch: npm run test:watch
Lint:    npm run lint
Dev:     npm run dev      # serves index.html on a local static server
```

## Project Structure

```
index.html          → App shell, mounts the UI
src/
  main.js           → UI wiring, event handlers, render loop
  storage.js        → localStorage read/write + schema versioning
  streak.js         → PURE streak + date logic (no DOM, no storage)
  habits.js         → habit CRUD operations over the store
  styles.css        → Styling
tests/
  streak.test.js    → Unit tests for streak/date rules
  storage.test.js   → Unit tests for persistence + migration
docs/
SPEC.md             → This file
```

## Data Model (localStorage)

Single key `habit-tracker:v1` holding one JSON document. All dates are **local**
calendar dates formatted `YYYY-MM-DD` (never UTC, never timestamps).

```json
{
  "version": 1,
  "habits": [
    {
      "id": "h_9f3a",
      "name": "Drink water",
      "target": 6,
      "createdOn": "2026-10-20",
      "streak": 4,
      "lastMetOn": "2026-10-22",
      "log": {
        "2026-10-19": 6,
        "2026-10-20": 5,
        "2026-10-22": 6
      }
    }
  ]
}
```

Field notes:

- `id` — stable, generated once (e.g. `h_` + short random id).
- `target` — integer ≥ 1. A day is **met** when `log[date] >= target`.
- `log` — map of local date → count recorded that day. A missing date means no entry
  yet (not zero intentionally). Days before `createdOn` are never counted as misses.
- `streak` — **derived, cached** value. It is recomputed from the log on every load
  (see Streak Rules). The stored value is a convenience/consistency check, never the
  source of truth.
- `lastMetOn` — most recent date the target was met; used for display and quick
  reasoning. Also derived from the log.

**The log is the source of truth.** `streak` and `lastMetOn` are always recomputable
from `log` + `target` + the current local date. If stored and recomputed values ever
disagree, recomputed wins.

## Streak Rules

Let `today` = the device's current local date (`YYYY-MM-DD`). For a single habit:

1. A day `d` (where `createdOn <= d <= today`) is **met** iff `log[d] >= target`.
2. **Today in progress never breaks a streak.** If `today` is not yet met, it is
   treated as neutral (not a miss) — the streak reflects the run ending at the most
   recent *met* day.
3. The current streak = the count of consecutive met days ending at the latest met
   day, walking backward one calendar day at a time, stopping at the first unmet day.
4. **A past day that is unmet is a miss.** Any day strictly before `today` that is
   `>= createdOn` and not met breaks the streak (resets the consecutive run to zero
   at that point). No grace days, no freebies.
5. Day boundary is **local midnight**. Crossing midnight with the previous day unmet
   means that previous day is now a finished miss.

Worked example (`target: 6`, `createdOn: 2026-10-18`, `today: 2026-10-23`):

```
log = { "10-18": 6, "10-19": 6, "10-20": 3, "10-21": 6, "10-22": 6 }
```
- 10-20 is unmet (3 < 6) and in the past → miss, breaks the run there.
- Consecutive met run ending at latest met day (10-22): 10-21, 10-22 → streak = 2.
- 10-23 (today) has no entry → neutral, does not reset.

Edge cases:

- New habit created today, not yet met → streak 0, not a miss.
- User opens app after several idle days with prior unmet days → those idle days are
  past misses; streak correctly reads 0 (recomputed on load).
- Multiple entries same day: last write for that date wins (value is the day's count).

## Core Screens & States

Two views, toggled in one page.

### 1. Today (default view)

Lists every habit with its target and today's status.

- **Per-habit row:** name · `today's count / target` · current streak (🔥 N) · a
  control to record today's count.
- **Recording a day:** a stepper/number input for today's count, or a quick "mark met"
  that sets count to `target`. Updates `log[today]` and re-renders.
- **Row states:**
  - *Met today* — count ≥ target, visually affirmed, streak includes today.
  - *In progress* — count > 0 but < target; neutral, streak excludes today.
  - *Not started today* — no entry; neutral.
  - *Streak broken* — streak shows 0 because a past day was missed (surfaced calmly,
    no alarming treatment).
- **Empty state:** no habits yet → prompt to add the first habit.

### 2. Manage Habits

- Add a habit (name + target).
- Edit name / target of an existing habit.
- Delete a habit (with confirm; removes its log too).
- Validation at the boundary: non-empty name, integer target ≥ 1.

### Global states

- **First run:** empty store initialized to `{ version: 1, habits: [] }`.
- **Load/recompute:** on every load, recompute `streak` and `lastMetOn` for all habits
  from their logs against today's local date, then persist the refreshed doc.
- **Corrupt/unreadable storage:** if JSON parse fails or `version` is unknown, do not
  silently wipe — surface a clear message and offer to reset; never crash.

## Testing Strategy

- **Framework:** Vitest. Tests live in `tests/`.
- **Focus:** the pure logic in `streak.js` and `storage.js`. The DOM layer (`main.js`)
  is kept thin and is verified manually; no browser/e2e harness in scope.
- **Determinism:** all date-dependent functions take `today` as an explicit argument
  (never read the clock internally) so tests are deterministic. `main.js` injects the
  real local date.
- **Required `streak.js` cases:**
  - Empty log → streak 0.
  - Unbroken run including today → counts today.
  - Today in progress (count < target) → streak excludes today, no reset.
  - Past unmet day → streak resets at that day.
  - Idle gap of several unmet past days → streak 0.
  - Habit created today, unmet → streak 0, not a miss.
  - `createdOn` boundary: days before creation never count as misses.
- **Required `storage.js` cases:**
  - Round-trip save/load preserves the document.
  - First run initializes empty v1 doc.
  - Unknown/future `version` → surfaced, not auto-wiped.
  - Corrupt JSON → handled gracefully.
- **Coverage expectation:** 100% of `streak.js` branches; `storage.js` happy-path +
  each failure mode.

## Boundaries

- **Always:** keep `streak.js` pure (no DOM, no storage, no clock reads); run tests
  before committing; use local `YYYY-MM-DD` dates; treat the log as source of truth.
- **Ask first:** adding any dependency; bumping the storage `version` / changing the
  schema; adding a new screen or persisted field.
- **Never:** send data off-device (no network calls, analytics, or sync); add
  accounts; auto-wipe user data on a load error; read the clock inside pure logic.

## Success Criteria

- All streak rules above hold, verified by passing unit tests.
- Marking a habit met today increments its streak by exactly 1 vs. yesterday's value
  when yesterday was also met.
- A past missed day resets that habit's streak to 0; "today not yet done" never does.
- Closing and reopening the app (same device) preserves all habits, logs, and
  correctly recomputed streaks.
- Inspecting network activity shows zero outbound requests.

## Non-Goals (Explicit)

- Weekly (or any non-daily) habit cadence.
- Grace days, streak freezes, or any forgiveness on a miss.
- Multi-device sync, cloud backup, or export/import.
- Accounts, login, or multi-user support.
- Reminders, notifications, or scheduling.
- Real-time / per-event logging (user self-reports the day's count; no live counters).
- Social features, sharing, or leaderboards.
- History/calendar visualizations beyond the current per-habit streak number.
- A backend of any kind.

## Open Questions

1. **Marking UX:** number stepper for the exact count, or a single "mark met" button
   that jumps straight to target? (Spec assumes a count input that derives met; a
   plain toggle is simpler if you never care about partial counts.)
2. **Manage-habits placement:** separate view vs. inline edit on the Today screen?
3. Any desire for a manual "reset app / clear all data" control, or leave that to
   browser devtools?
