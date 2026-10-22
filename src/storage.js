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

  const version = parsed.version ?? 0;
  if (version > CURRENT_VERSION) {
    return { ok: false, reason: 'unknown-version', raw };
  }
  if (version < CURRENT_VERSION) {
    return { ok: true, doc: migrate(parsed, version) };
  }
  return { ok: true, doc: parsed };
}

/** Persist the document as JSON. */
export function save(doc, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(doc));
}

// Bring an older document forward to the current schema. v0 (no version field) only
// lacked the version tag, so migration is additive.
function migrate(doc, _fromVersion) {
  return { version: CURRENT_VERSION, habits: doc.habits ?? [] };
}
