// UI wiring. Deliberately thin: all rules live in the tested pure modules. This file
// reads the real local date, talks to storage, and renders the DOM.

import { load, save } from './storage.js';
import { addHabit, recordDay } from './habits.js';
import { computeStreak, isMet } from './streak.js';

/** Today's date as a local 'YYYY-MM-DD' string (the one place we read the clock). */
function localToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const els = {
  notice: document.getElementById('notice'),
  form: document.getElementById('add-form'),
  name: document.getElementById('habit-name'),
  target: document.getElementById('habit-target'),
  addError: document.getElementById('add-error'),
  list: document.getElementById('habit-list'),
  emptyState: document.getElementById('empty-state'),
};

const TODAY = localToday();
let doc; // in-memory document; persisted after every change

function showNotice(message) {
  els.notice.textContent = message;
  els.notice.hidden = false;
}

function showAddError(message) {
  els.addError.textContent = message;
  els.addError.hidden = false;
}

function clearAddError() {
  els.addError.textContent = '';
  els.addError.hidden = true;
}

/** Status label + CSS modifier for a habit on today. */
function statusFor(habit) {
  const count = habit.log[TODAY] ?? 0;
  if (isMet(habit, TODAY)) return { label: 'Done today', mod: 'is-met' };
  if (count > 0) return { label: 'In progress', mod: 'is-progress' };
  return { label: 'Not started', mod: 'is-idle' };
}

function render() {
  els.list.replaceChildren();
  els.emptyState.hidden = doc.habits.length > 0;

  for (const habit of doc.habits) {
    const count = habit.log[TODAY] ?? 0;
    const streak = computeStreak(habit, TODAY);
    const { label, mod } = statusFor(habit);

    const li = document.createElement('li');
    li.className = `habit ${mod}`;

    const name = document.createElement('span');
    name.className = 'habit__name';
    name.textContent = habit.name;

    const streakEl = document.createElement('span');
    streakEl.className = 'habit__streak';
    // Emoji is decorative; the text carries the meaning for screen readers.
    streakEl.innerHTML =
      `<span aria-hidden="true">🔥</span> ` +
      `<span>${streak}‑day streak</span>`;

    const status = document.createElement('span');
    status.className = 'habit__status';
    status.textContent = `${count} / ${habit.target} — ${label}`;

    // Count stepper. Derives "met" from count >= target (SPEC data model).
    const stepper = document.createElement('div');
    stepper.className = 'stepper';

    const dec = document.createElement('button');
    dec.type = 'button';
    dec.textContent = '−';
    dec.setAttribute('aria-label', `Decrease ${habit.name} count`);
    dec.disabled = count <= 0;
    dec.addEventListener('click', () => changeCount(habit.id, count - 1));

    const value = document.createElement('output');
    value.className = 'stepper__value';
    value.textContent = String(count);
    value.setAttribute('aria-label', `${habit.name} count today`);

    const inc = document.createElement('button');
    inc.type = 'button';
    inc.textContent = '+';
    inc.setAttribute('aria-label', `Increase ${habit.name} count`);
    inc.addEventListener('click', () => changeCount(habit.id, count + 1));

    stepper.append(dec, value, inc);
    li.append(name, streakEl, status, stepper);
    els.list.append(li);
  }
}

function changeCount(id, next) {
  if (next < 0) return;
  doc = recordDay(doc, id, next, TODAY);
  save(doc);
  render();
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearAddError();
  const name = els.name.value;
  const target = Number.parseInt(els.target.value, 10);
  try {
    doc = addHabit(doc, { name, target }, TODAY);
    save(doc);
    els.form.reset();
    els.target.value = '1';
    els.name.focus();
    render();
  } catch (err) {
    showAddError(err.message);
  }
});

// Boot: load, surface storage problems without wiping, recompute happens naturally
// at render time (streaks are derived from the log).
function boot() {
  const result = load();
  if (!result.ok) {
    doc = { version: 1, habits: [] };
    showNotice(
      result.reason === 'unknown-version'
        ? 'Your saved data is from a newer version of this app and cannot be read. ' +
          'It has been left untouched; no changes will be saved until it is resolved.'
        : 'Your saved data could not be read. It has been left untouched; ' +
          'added habits will not be saved until it is resolved.'
    );
    render();
    return;
  }
  doc = result.doc;
  save(doc); // persist any forward-migrated shape
  render();
}

boot();
