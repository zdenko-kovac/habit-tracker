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

// localStorage is untrusted: it can be hand-edited, tampered with, or written by
// another script on the origin. load() must coerce whatever it finds into the known
// schema and drop anything malformed — never hand through arbitrary structure.
describe('load — untrusted/tampered shapes', () => {
  function withRaw(value) {
    return load(fakeStorage({ [STORAGE_KEY]: JSON.stringify(value) }));
  }

  it('returns an empty doc when the top level is not an object', () => {
    expect(withRaw(42)).toEqual({ ok: true, doc: { version: 1, habits: [] } });
    expect(withRaw(null)).toEqual({ ok: true, doc: { version: 1, habits: [] } });
    expect(withRaw('a string')).toEqual({ ok: true, doc: { version: 1, habits: [] } });
  });

  it('coerces a non-array habits field to an empty array', () => {
    const { doc } = withRaw({ version: 1, habits: 'not an array' });
    expect(doc.habits).toEqual([]);
  });

  it('drops habits with a missing or non-string name', () => {
    const { doc } = withRaw({
      version: 1,
      habits: [
        { id: 'h_1', target: 6, createdOn: '2026-10-20', log: {} }, // no name
        { id: 'h_2', name: 42, target: 6, createdOn: '2026-10-20', log: {} }, // non-string
      ],
    });
    expect(doc.habits).toEqual([]);
  });

  it('drops habits whose target is not a positive integer', () => {
    const { doc } = withRaw({
      version: 1,
      habits: [
        { id: 'h_1', name: 'A', target: 'boom', createdOn: '2026-10-20', log: {} },
        { id: 'h_2', name: 'B', target: 0, createdOn: '2026-10-20', log: {} },
        { id: 'h_3', name: 'C', target: 2.5, createdOn: '2026-10-20', log: {} },
      ],
    });
    expect(doc.habits).toEqual([]);
  });

  it('repairs a habit with a null/invalid log into an empty log', () => {
    const { doc } = withRaw({
      version: 1,
      habits: [{ id: 'h_1', name: 'A', target: 6, createdOn: '2026-10-20', log: null }],
    });
    expect(doc.habits).toHaveLength(1);
    expect(doc.habits[0].log).toEqual({});
  });

  it('keeps only non-negative integer counts in the log', () => {
    const { doc } = withRaw({
      version: 1,
      habits: [{
        id: 'h_1', name: 'A', target: 6, createdOn: '2026-10-20',
        log: { '2026-10-20': 6, '2026-10-21': -3, '2026-10-22': 'x', '2026-10-23': 2.5 },
      }],
    });
    expect(doc.habits[0].log).toEqual({ '2026-10-20': 6 });
  });

  it('preserves a malicious habit name verbatim as data (escaping is the view layer)', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { doc } = withRaw({
      version: 1,
      habits: [{ id: 'h_1', name: evil, target: 1, createdOn: '2026-10-20', log: {} }],
    });
    // Storage keeps the raw string; it must never be executed, which the DOM layer
    // guarantees by using textContent. Storage's job is only not to lose/alter it.
    expect(doc.habits[0].name).toBe(evil);
  });
});
