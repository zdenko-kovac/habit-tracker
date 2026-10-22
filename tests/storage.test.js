import { describe, it, expect } from 'vitest';
import { load, save, emptyDoc, STORAGE_KEY } from '../src/storage.js';

// A minimal in-memory fake of the Web Storage API — closer to real behavior than a
// mock, and keeps these tests deterministic and isolated (no real localStorage).
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('emptyDoc', () => {
  it('is a version-1 document with no habits', () => {
    expect(emptyDoc()).toEqual({ version: 1, habits: [] });
  });
});

describe('load', () => {
  it('returns an empty doc on first run (key missing)', () => {
    const result = load(fakeStorage());
    expect(result).toEqual({ ok: true, doc: { version: 1, habits: [] } });
  });

  it('round-trips a saved document', () => {
    const storage = fakeStorage();
    const doc = {
      version: 1,
      habits: [{ id: 'h_1', name: 'Water', target: 6, createdOn: '2026-10-22', log: {} }],
    };
    save(doc, storage);
    expect(load(storage)).toEqual({ ok: true, doc });
  });

  it('flags corrupt JSON without wiping it', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{not valid json' });
    const result = load(storage);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('corrupt');
    // original bytes preserved so nothing is destroyed
    expect(storage.getItem(STORAGE_KEY)).toBe('{not valid json');
  });

  it('refuses a newer/unknown version without wiping it', () => {
    const raw = JSON.stringify({ version: 2, habits: [] });
    const storage = fakeStorage({ [STORAGE_KEY]: raw });
    const result = load(storage);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unknown-version');
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('migrates an older version (0) up to the current schema', () => {
    // v0 shape: no version field, habits present.
    const storage = fakeStorage({
      [STORAGE_KEY]: JSON.stringify({
        habits: [{ id: 'h_1', name: 'Water', target: 6, createdOn: '2026-10-20', log: {} }],
      }),
    });
    const result = load(storage);
    expect(result.ok).toBe(true);
    expect(result.doc.version).toBe(1);
    expect(result.doc.habits).toHaveLength(1);
  });
});

describe('save', () => {
  it('writes the document as JSON under the storage key', () => {
    const storage = fakeStorage();
    const doc = emptyDoc();
    save(doc, storage);
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual(doc);
  });
});
