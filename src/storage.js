// The only module that touches localStorage. load() never throws and never wipes
// data — it returns a result object so callers can surface a reset prompt instead.

export const STORAGE_KEY = 'habit-tracker:v1';
export const CURRENT_VERSION = 1;

export function emptyDoc() {
  return { version: CURRENT_VERSION, habits: [] };
}

/**
 * Read the document from storage.
 * @returns {{ok: true, doc}} on success (including first run and migrated-up data),
 *          or {{ok: false, reason: 'corrupt'|'unknown-version', raw}} on failure.
 *          Never mutates or removes stored data on failure.
 */
export function load(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw == null) return { ok: true, doc: emptyDoc() };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt', raw };
  }

  const version = isObject(parsed) ? parsed.version ?? 0 : 0;
  if (version > CURRENT_VERSION) {
    return { ok: false, reason: 'unknown-version', raw };
  }
  // Everything parseable and not-newer is coerced into the known schema. localStorage
  // is untrusted (hand-editable, writable by any script on the origin), so malformed
  // habits are dropped and bad fields repaired rather than handed through.
  return { ok: true, doc: sanitizeDoc(parsed) };
}

/** Persist the document as JSON. */
export function save(doc, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(doc));
}

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Coerce an arbitrary parsed value into a valid v1 document. Drops habits that can't
 * be repaired (bad name or target); repairs recoverable fields (log). This is the
 * trust boundary for stored data — downstream code can assume the shape holds.
 */
function sanitizeDoc(parsed) {
  if (!isObject(parsed) || !Array.isArray(parsed.habits)) return emptyDoc();
  const habits = parsed.habits.map(sanitizeHabit).filter(Boolean);
  return { version: CURRENT_VERSION, habits };
}

function sanitizeHabit(h) {
  if (!isObject(h)) return null;
  if (typeof h.name !== 'string' || h.name.trim() === '') return null;
  if (!Number.isInteger(h.target) || h.target < 1) return null;
  return {
    id: typeof h.id === 'string' && h.id ? h.id : fallbackId(),
    name: h.name,
    target: h.target,
    createdOn: isDateString(h.createdOn) ? h.createdOn : '1970-01-01',
    log: sanitizeLog(h.log),
  };
}

function sanitizeLog(log) {
  if (!isObject(log)) return {};
  const clean = {};
  for (const [date, count] of Object.entries(log)) {
    if (isDateString(date) && Number.isInteger(count) && count >= 0) {
      clean[date] = count;
    }
  }
  return clean;
}

function isDateString(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

let fallbackCounter = 0;
function fallbackId() {
  fallbackCounter += 1;
  return `h_recovered_${fallbackCounter}`;
}
