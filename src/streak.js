// Pure streak logic for the habit tracker.
// No DOM, no storage, no clock reads — `today` is always passed in as 'YYYY-MM-DD'.

/** Is the habit's target met on the given local date? */
export function isMet(habit, date) {
  return (habit.log[date] ?? 0) >= habit.target;
}

/** Local-date string 'YYYY-MM-DD' shifted by `delta` days. */
function addDays(date, delta) {
  // Parse as UTC noon to avoid DST/timezone edge effects, then format back.
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Current streak: consecutive met days ending at the most recent met day.
 * Today-in-progress (not yet met) is neutral and never breaks the streak.
 * Any past unmet day (>= createdOn) breaks the run. No grace days.
 */
export function computeStreak(habit, today) {
  // Walk back from today to find the most recent met day.
  let cursor = isMet(habit, today) ? today : addDays(today, -1);

  // If the most recent candidate day is unmet, the streak is broken (0).
  if (!isMet(habit, cursor)) return 0;

  let streak = 0;
  while (cursor >= habit.createdOn && isMet(habit, cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
