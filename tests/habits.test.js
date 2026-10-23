import { describe, it, expect } from 'vitest';
import { addHabit, recordDay, deleteHabit, editHabit, clearAll, newId } from '../src/habits.js';
import { emptyDoc } from '../src/storage.js';

describe('addHabit', () => {
  it('appends a habit with an id, createdOn=today, and an empty log', () => {
    const doc = addHabit(emptyDoc(), { name: 'Drink water', target: 6 }, '2026-10-22');
    expect(doc.habits).toHaveLength(1);
    const h = doc.habits[0];
    expect(h.id).toBeTruthy();
    expect(h.name).toBe('Drink water');
    expect(h.target).toBe(6);
    expect(h.createdOn).toBe('2026-10-22');
    expect(h.log).toEqual({});
  });

  it('trims the name', () => {
    const doc = addHabit(emptyDoc(), { name: '  Water  ', target: 1 }, '2026-10-22');
    expect(doc.habits[0].name).toBe('Water');
  });

  it('gives each habit a distinct id', () => {
    let doc = addHabit(emptyDoc(), { name: 'A', target: 1 }, '2026-10-22');
    doc = addHabit(doc, { name: 'B', target: 1 }, '2026-10-22');
    expect(doc.habits[0].id).not.toBe(doc.habits[1].id);
  });

  it('newId skips ids already in the provided set', () => {
    // Direct test of the collision-avoidance. Generate a batch, mark them all taken,
    // and require the next id to avoid every one. (The cross-reload scenario that
    // triggered the bug — a counter reset regenerating a stored id — is guarded at
    // the storage layer by the duplicate-id dedupe test, since it's inherently a
    // cross-process event this single-process suite can't reset the counter to force.)
    const taken = new Set([newId(new Set()), newId(new Set()), newId(new Set())]);
    const fresh = newId(taken);
    expect(taken.has(fresh)).toBe(false);
  });

  it('incrementing one of two habits does not change the other', () => {
    // End-to-end guard on the reported symptom. Build a two-habit doc the way a
    // reload would (fixed ids), then record a day on the first only.
    const loaded = {
      version: 1,
      habits: [
        { id: 'h_1', name: 'A', target: 6, createdOn: '2026-10-20', log: {} },
        { id: 'h_2', name: 'B', target: 6, createdOn: '2026-10-20', log: {} },
      ],
    };
    const doc = recordDay(loaded, 'h_1', 1, '2026-10-22');
    expect(doc.habits[0].log['2026-10-22']).toBe(1);
    expect(doc.habits[1].log['2026-10-22']).toBeUndefined();
  });

  it('rejects an empty name', () => {
    expect(() => addHabit(emptyDoc(), { name: '   ', target: 6 }, '2026-10-22'))
      .toThrow(/name/i);
  });

  it('rejects a target below 1', () => {
    expect(() => addHabit(emptyDoc(), { name: 'Water', target: 0 }, '2026-10-22'))
      .toThrow(/target/i);
  });

  it('rejects a non-integer target', () => {
    expect(() => addHabit(emptyDoc(), { name: 'Water', target: 2.5 }, '2026-10-22'))
      .toThrow(/target/i);
  });

  it('does not mutate the input document', () => {
    const doc = emptyDoc();
    addHabit(doc, { name: 'Water', target: 6 }, '2026-10-22');
    expect(doc.habits).toHaveLength(0);
  });
});

describe('recordDay', () => {
  const base = addHabit(emptyDoc(), { name: 'Water', target: 6 }, '2026-10-22');
  const id = base.habits[0].id;

  it("sets today's count in the habit log", () => {
    const doc = recordDay(base, id, 6, '2026-10-22');
    expect(doc.habits[0].log['2026-10-22']).toBe(6);
  });

  it('overwrites an earlier count for the same day (last write wins)', () => {
    let doc = recordDay(base, id, 3, '2026-10-22');
    doc = recordDay(doc, id, 6, '2026-10-22');
    expect(doc.habits[0].log['2026-10-22']).toBe(6);
  });

  it('rejects a negative count', () => {
    expect(() => recordDay(base, id, -1, '2026-10-22')).toThrow(/count/i);
  });

  it('throws for an unknown habit id', () => {
    expect(() => recordDay(base, 'nope', 6, '2026-10-22')).toThrow(/not found/i);
  });

  it('does not mutate the input document', () => {
    recordDay(base, id, 6, '2026-10-22');
    expect(base.habits[0].log).toEqual({});
  });
});

describe('deleteHabit', () => {
  it('removes the habit and its log', () => {
    const base = addHabit(emptyDoc(), { name: 'Water', target: 6 }, '2026-10-22');
    const id = base.habits[0].id;
    const doc = deleteHabit(base, id);
    expect(doc.habits).toHaveLength(0);
  });
});

describe('editHabit', () => {
  const base = addHabit(emptyDoc(), { name: 'Water', target: 6 }, '2026-10-20');
  const id = base.habits[0].id;

  it('updates the name and target, preserving createdOn and log', () => {
    const withLog = recordDay(base, id, 6, '2026-10-20');
    const doc = editHabit(withLog, id, { name: 'Hydrate', target: 8 });
    const h = doc.habits[0];
    expect(h.name).toBe('Hydrate');
    expect(h.target).toBe(8);
    expect(h.createdOn).toBe('2026-10-20');
    expect(h.log).toEqual({ '2026-10-20': 6 });
  });

  it('trims the new name', () => {
    const doc = editHabit(base, id, { name: '  Hydrate  ', target: 8 });
    expect(doc.habits[0].name).toBe('Hydrate');
  });

  it('rejects an empty name', () => {
    expect(() => editHabit(base, id, { name: '  ', target: 6 })).toThrow(/name/i);
  });

  it('rejects a target below 1', () => {
    expect(() => editHabit(base, id, { name: 'Water', target: 0 })).toThrow(/target/i);
  });

  it('throws for an unknown habit id', () => {
    expect(() => editHabit(base, 'nope', { name: 'Water', target: 6 }))
      .toThrow(/not found/i);
  });

  it('does not mutate the input document', () => {
    editHabit(base, id, { name: 'Hydrate', target: 8 });
    expect(base.habits[0].name).toBe('Water');
  });
});

describe('clearAll', () => {
  it('returns an empty version-1 document', () => {
    const base = addHabit(emptyDoc(), { name: 'Water', target: 6 }, '2026-10-22');
    expect(clearAll(base)).toEqual({ version: 1, habits: [] });
  });
});
