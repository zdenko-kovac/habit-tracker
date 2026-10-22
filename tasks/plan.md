# Implementation Plan: On-Device Habit Tracker

## Overview

Build a vanilla JS habit tracker (per SPEC.md) where all data lives in `localStorage`.
Work is ordered bottom-up: the two pure modules (`storage.js`, `streak.js`) come first
because every feature depends on them and they carry the hardest logic (date math,
reset-on-miss). The UI slices stack on top, each delivering a working end-to-end path.

## Architecture Decisions

- **Pure logic isolated.** `streak.js` takes `today` as an argument and never touches
  the DOM, storage, or the clock → fully deterministic and unit-testable.
- **Log is source of truth.** `streak`/`lastMetOn` are recomputed on every load; never
  trusted as stored state.
- **No framework / no build step.** ES modules served statically; Vitest for tests.
- **Resolved open questions (default answers — veto if wrong):**
  1. Marking UX → **count stepper** (`log[today] = N`), met derived as `N >= target`.
  2. Manage habits → **separate view** toggled from Today.
  3. Reset → **in-app "clear all data"** control in the Manage view (with confirm).

## Task List

### Phase 1: Foundation (pure, test-first)

- [ ] **Task 1: localStorage persistence layer** (`storage.js`)
  - **Description:** Read/write the single `habit-tracker:v1` document; initialize an
    empty v1 doc on first run; handle corrupt JSON and unknown versions without wiping.
  - **Acceptance criteria:**
    - [ ] `load()` returns `{version:1, habits:[]}` on first run (no key present).
    - [ ] `save(doc)` then `load()` round-trips the document unchanged.
    - [ ] Corrupt JSON or unknown `version` returns a distinguishable error/flag — never auto-wipes.
  - **Verification:**
    - [ ] Tests pass: `npm test tests/storage.test.js`
    - [ ] Manual check: corrupt the key in devtools → app surfaces a reset prompt, no crash.
  - **Dependencies:** None
  - **Files:** `src/storage.js`, `tests/storage.test.js`
  - **Scope:** S

- [ ] **Task 2: streak + date logic** (`streak.js`)
  - **Description:** Pure functions: `isMet(log, date, target)`, `computeStreak(habit, today)`,
    `lastMetOn(habit, today)`. Implements all streak rules (today-in-progress neutral,
    past unmet = reset, local-midnight rollover, `createdOn` boundary).
  - **Acceptance criteria:**
    - [ ] All required `streak.js` cases in SPEC pass (empty log, unbroken-incl-today,
          today-in-progress, past-miss reset, idle-gap, created-today, createdOn boundary).
    - [ ] No function reads the clock or the DOM; `today` is always a parameter.
  - **Verification:**
    - [ ] Tests pass: `npm test tests/streak.test.js`
    - [ ] Coverage: 100% branches in `streak.js`.
  - **Dependencies:** None
  - **Files:** `src/streak.js`, `tests/streak.test.js`
  - **Scope:** M

### Checkpoint: Foundation
- [ ] `npm test` green; `streak.js` at 100% branch coverage.
- [ ] Both modules pure and clock-free. Review before building UI.

### Phase 2: Habit operations + Add-a-habit slice

- [ ] **Task 3: habit CRUD over the store** (`habits.js`)
  - **Description:** `addHabit(doc, {name,target,today})`, `editHabit`, `deleteHabit`,
    `recordDay(doc, id, count, today)`, `recomputeAll(doc, today)`. Validates name
    non-empty and target integer ≥ 1 at the boundary; generates stable ids.
  - **Acceptance criteria:**
    - [ ] `addHabit` appends a habit with id, `createdOn=today`, empty log, streak 0.
    - [ ] `recordDay` sets `log[today]=count` (last write wins) and recomputes that habit.
    - [ ] Invalid name/target is rejected with a clear error; `deleteHabit` removes habit + its log.
  - **Verification:**
    - [ ] Tests pass: `npm test tests/habits.test.js`
  - **Dependencies:** Task 1, Task 2
  - **Files:** `src/habits.js`, `tests/habits.test.js`
  - **Scope:** M

- [ ] **Task 4: app shell + render loop + recompute-on-load** (`index.html`, `main.js`, `styles.css`)
  - **Description:** Mount the page, load the doc, run `recomputeAll` with the real local
    date on load and persist, render the Today list container. Thin DOM layer only.
  - **Acceptance criteria:**
    - [ ] On load, doc is read, recomputed against today's local date, and re-saved.
    - [ ] Empty state renders "add your first habit" when no habits exist.
    - [ ] `npm run dev` serves the page with no console errors.
  - **Verification:**
    - [ ] Build/serve succeeds: `npm run dev`
    - [ ] Manual check: fresh browser → empty state shows.
  - **Dependencies:** Task 1, Task 2, Task 3
  - **Files:** `index.html`, `src/main.js`, `src/styles.css`
  - **Scope:** M

- [ ] **Task 5: Manage view — add / edit / delete habit** (UI slice)
  - **Description:** Separate Manage view toggled from Today. Form to add (name + target),
    edit existing, delete with confirm. Validation surfaced inline.
  - **Acceptance criteria:**
    - [ ] Adding a valid habit makes it appear in the Today list immediately.
    - [ ] Invalid input (empty name / target < 1) shows an inline error, nothing saved.
    - [ ] Delete asks for confirm, then removes the habit and its log from storage.
  - **Verification:**
    - [ ] Manual check: add "Drink water" target 6 → appears on Today, persists across reload.
  - **Dependencies:** Task 3, Task 4
  - **Files:** `src/main.js`, `src/styles.css`
  - **Scope:** M

### Checkpoint: Add-a-habit works end to end
- [ ] Can add/edit/delete a habit; it persists across reloads. Review before marking logic.

### Phase 3: Mark a day & show stats

- [ ] **Task 6: mark a day done on Today view** (UI slice)
  - **Description:** Per-habit count stepper / "mark met" on each Today row; writes
    `log[today]` via `recordDay` and re-renders. Row reflects met / in-progress /
    not-started states.
  - **Acceptance criteria:**
    - [ ] Entering count ≥ target marks the row met and shows today's count/target.
    - [ ] Count > 0 but < target shows in-progress; streak excludes today.
    - [ ] Value persists across reload (written to the log).
  - **Verification:**
    - [ ] Manual check: mark water 6/6 → row met; reload → still met.
  - **Dependencies:** Task 4, Task 5
  - **Files:** `src/main.js`, `src/styles.css`
  - **Scope:** S

- [ ] **Task 7: show streak stats on each row** (UI slice)
  - **Description:** Render the per-habit current streak (🔥 N) from `computeStreak`,
    and the broken state (0) calmly. Updates live after marking a day.
  - **Acceptance criteria:**
    - [ ] Row shows correct streak matching `streak.js` for its log + today.
    - [ ] Marking today met when yesterday was met increments streak by exactly 1.
    - [ ] A past missed day shows streak 0; today-not-yet-done never shows 0 due to today.
  - **Verification:**
    - [ ] Manual check: seed a log with a past miss → streak reads 0; fill today → increments.
  - **Dependencies:** Task 2, Task 6
  - **Files:** `src/main.js`, `src/styles.css`
  - **Scope:** S

- [ ] **Task 8: clear-all-data control** (UI slice)
  - **Description:** "Clear all data" button in Manage view, with confirm, resets store
    to empty v1 doc. Also wires the corrupt-storage reset path from Task 1.
  - **Acceptance criteria:**
    - [ ] Confirming clear empties all habits and logs; cancel does nothing.
    - [ ] Corrupt-storage prompt (Task 1) offers the same reset.
  - **Verification:**
    - [ ] Manual check: clear → empty state; reload → still empty.
  - **Dependencies:** Task 1, Task 5
  - **Files:** `src/main.js`
  - **Scope:** S

### Checkpoint: Complete
- [ ] All SPEC success criteria met; `npm test` green; zero outbound network requests in devtools.
- [ ] Ready for review.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Local-date / midnight-rollover bugs | High | `today` is an explicit arg to all pure logic; dedicated tests for boundary + idle-gap cases (Task 2). |
| Cached `streak` drifting from the log | Med | Always `recomputeAll` on load (Task 4); stored streak is never trusted. |
| Accidental data loss on load errors | Med | Never auto-wipe; surface reset prompt instead (Task 1, Task 8). |
| DOM layer accumulating logic | Low | Keep `main.js` thin; all rules live in tested pure modules. |

## Open Questions

Resolved by the default answers in Architecture Decisions above — flag if any is wrong:
marking = count stepper, Manage = separate view, reset = in-app clear-all.

## Task List Target

Tasks recorded inline in this file (`tasks/plan.md`) as the checklist above — no
external tracker designated for this project.
