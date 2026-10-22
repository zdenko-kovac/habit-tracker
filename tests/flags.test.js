import { describe, it, expect } from 'vitest';
import { isEnabled, FLAGS } from '../src/flags.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('isEnabled', () => {
  it('returns the compiled default when there is no override', () => {
    expect(isEnabled('weeklyHabits', fakeStorage())).toBe(FLAGS.weeklyHabits);
  });

  it('a localStorage override of "true" turns a flag on', () => {
    const s = fakeStorage({ 'habit-tracker:flag:weeklyHabits': 'true' });
    expect(isEnabled('weeklyHabits', s)).toBe(true);
  });

  it('a localStorage override of "false" turns a flag off', () => {
    const s = fakeStorage({ 'habit-tracker:flag:weeklyHabits': 'false' });
    expect(isEnabled('weeklyHabits', s)).toBe(false);
  });

  it('an unknown flag is off', () => {
    expect(isEnabled('nope', fakeStorage())).toBe(false);
  });

  it('never throws when storage is unavailable', () => {
    const broken = { getItem() { throw new Error('no storage'); } };
    expect(() => isEnabled('weeklyHabits', broken)).not.toThrow();
    expect(isEnabled('weeklyHabits', broken)).toBe(FLAGS.weeklyHabits);
  });
});
