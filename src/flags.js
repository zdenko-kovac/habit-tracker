// Client-side feature flags. This app is static and single-user, so "flag" means a
// compile-time/load-time constant, not a remote flag service. Flipping a flag is a
// one-line edit + redeploy (or, for local trials, override via localStorage below).
//
// Every flag MUST carry an owner and an expiration date (see shipping-and-launch).

export const FLAGS = {
  // Owner: product/you. Expires: 2026-12-01 (decide: ship weekly or remove the seam).
  // When ON, the UI offers a "weekly" habit cadence in addition to daily. When OFF,
  // the app behaves exactly as the approved spec (daily-only); no weekly UI, and any
  // weekly habit already in storage is still shown but treated as daily by the view.
  weeklyHabits: false,
};

/**
 * Resolve a flag. Allows a per-device override via localStorage for internal trials
 * without a redeploy: localStorage['habit-tracker:flag:weeklyHabits'] = 'true'.
 * Falls back to the compiled default. Never throws.
 */
export function isEnabled(name, storage = globalThis.localStorage) {
  try {
    const override = storage?.getItem(`habit-tracker:flag:${name}`);
    if (override === 'true') return true;
    if (override === 'false') return false;
  } catch {
    // storage unavailable (e.g. tests) — fall through to the default
  }
  return Boolean(FLAGS[name]);
}
