import { describe, it, expect } from 'vitest';
import { computeStreak } from '../src/streak.js';

// A habit is "met" on a day when log[date] >= target.
// computeStreak(habit, today) returns the length of the consecutive run of met
// days ending at the most recent met day, stopping at the first past unmet day.
// `today` is always passed in (no clock reads) so tests are deterministic.

describe('computeStreak', () => {
  it('returns 0 for a habit with an empty log', () => {
    const habit = { target: 6, createdOn: '2026-10-20', log: {} };
    expect(computeStreak(habit, '2026-10-22')).toBe(0);
  });

  it('counts consecutive met days up to and including today', () => {
    const habit = {
      target: 6,
      createdOn: '2026-10-20',
      log: { '2026-10-20': 6, '2026-10-21': 6, '2026-10-22': 6 },
    };
    expect(computeStreak(habit, '2026-10-22')).toBe(3);
  });

  it('does NOT reset when today is not done yet (today is neutral)', () => {
    const habit = {
      target: 6,
      createdOn: '2026-10-20',
      log: { '2026-10-20': 6, '2026-10-21': 6 }, // nothing logged for today
    };
    // streak reflects the run ending yesterday; today-in-progress never breaks it
    expect(computeStreak(habit, '2026-10-22')).toBe(2);
  });

  it('treats a partial count today as in-progress, not a reset', () => {
    const habit = {
      target: 6,
      createdOn: '2026-10-20',
      log: { '2026-10-20': 6, '2026-10-21': 6, '2026-10-22': 3 },
    };
    expect(computeStreak(habit, '2026-10-22')).toBe(2);
  });

  it('resets the run at a missed PAST day', () => {
    const habit = {
      target: 6,
      createdOn: '2026-10-18',
      // 10-20 is a past day with 3 < 6 -> a miss
      log: {
        '2026-10-18': 6,
        '2026-10-19': 6,
        '2026-10-20': 3,
        '2026-10-21': 6,
        '2026-10-22': 6,
      },
    };
    // run ending at latest met day (10-22): 10-21, 10-22 => 2
    expect(computeStreak(habit, '2026-10-22')).toBe(2);
  });

  it('returns 0 after an idle gap of several unmet past days', () => {
    const habit = {
      target: 6,
      createdOn: '2026-10-10',
      log: { '2026-10-10': 6, '2026-10-11': 6 }, // then nothing for days
    };
    // 10-12 .. 10-22 are all past unmet days -> most recent met run is broken
    expect(computeStreak(habit, '2026-10-22')).toBe(0);
  });

  it('is 0 (not a miss) for a habit created today and not yet met', () => {
    const habit = { target: 6, createdOn: '2026-10-22', log: {} };
    expect(computeStreak(habit, '2026-10-22')).toBe(0);
  });

  it('counts a habit created today that was already met today', () => {
    const habit = { target: 6, createdOn: '2026-10-22', log: { '2026-10-22': 6 } };
    expect(computeStreak(habit, '2026-10-22')).toBe(1);
  });

  it('does not count days before createdOn as misses', () => {
    // Only one met day, which is also createdOn; nothing before it should break it.
    const habit = { target: 1, createdOn: '2026-10-22', log: { '2026-10-22': 1 } };
    expect(computeStreak(habit, '2026-10-22')).toBe(1);
  });
});
