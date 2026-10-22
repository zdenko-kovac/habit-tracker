// Pure operations over the store document. Every function returns a new document
// and never mutates its input. Validation happens here, at the boundary.

let idCounter = 0;

function newId() {
  // Deterministic-enough unique id without reading the clock or RNG (both banned in
  // pure logic). A monotonic counter plus a short base-36 suffix avoids collisions
  // within a session; ids are opaque and never parsed.
  idCounter += 1;
  return `h_${idCounter.toString(36)}${(idCounter * 2654435761 % 1000).toString(36)}`;
}

/** Validate and normalize a habit's name and target. Throws on invalid input. */
function validateFields({ name, target }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('Habit name is required');
  if (!Number.isInteger(target) || target < 1) {
    throw new Error('Target must be a whole number of 1 or more');
  }
  return { name: trimmed, target };
}

/** Add a habit. Validates name (non-empty) and target (integer >= 1). */
export function addHabit(doc, fields, today) {
  const { name, target } = validateFields(fields);
  const habit = { id: newId(), name, target, createdOn: today, log: {} };
  return { ...doc, habits: [...doc.habits, habit] };
}

/** Edit a habit's name and target. createdOn and log are preserved. */
export function editHabit(doc, id, fields) {
  const { name, target } = validateFields(fields);
  let found = false;
  const habits = doc.habits.map((h) => {
    if (h.id !== id) return h;
    found = true;
    return { ...h, name, target };
  });
  if (!found) throw new Error(`Habit not found: ${id}`);
  return { ...doc, habits };
}

/** Record today's count for a habit. Last write for a given day wins. */
export function recordDay(doc, id, count, today) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Count must be zero or a positive whole number');
  }
  let found = false;
  const habits = doc.habits.map((h) => {
    if (h.id !== id) return h;
    found = true;
    return { ...h, log: { ...h.log, [today]: count } };
  });
  if (!found) throw new Error(`Habit not found: ${id}`);
  return { ...doc, habits };
}

/** Remove a habit and its log. */
export function deleteHabit(doc, id) {
  return { ...doc, habits: doc.habits.filter((h) => h.id !== id) };
}

/** Remove all habits, returning a fresh empty document. */
export function clearAll(doc) {
  return { ...doc, version: doc.version ?? 1, habits: [] };
}
