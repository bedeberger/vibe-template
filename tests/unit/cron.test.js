'use strict';
// Unit: the pure cron parser/matcher (lib/cron.js) — no DB, no timers.

const test = require('node:test');
const assert = require('node:assert');
const { parseCron, wallClock, matches } = require('../../lib/cron');

// Wall-clock fields for a readable test case (dayOfWeek 0 = Sunday).
const wc = (minute, hour, dayOfMonth, month, dayOfWeek) => ({ minute, hour, dayOfMonth, month, dayOfWeek });

test('field syntax: *, number, range, list, step, range with step', () => {
  const p = parseCron('*/15 8-18/2 1,15 * *');
  assert.deepEqual([...p.minute.values], [0, 15, 30, 45]);
  assert.deepEqual([...p.hour.values], [8, 10, 12, 14, 16, 18]);
  assert.deepEqual([...p.dayOfMonth.values], [1, 15]);
  assert.equal(p.month.values.size, 12);
});

test('`5/20` means from 5 every 20', () => {
  assert.deepEqual([...parseCron('5/20 * * * *').minute.values], [5, 25, 45]);
});

test('day of week 7 is Sunday', () => {
  const p = parseCron('0 0 * * 7');
  assert.ok(matches(p, wc(0, 0, 4, 1, 0)));
});

test('macros expand', () => {
  assert.ok(matches(parseCron('@daily'), wc(0, 0, 9, 9, 3)));
  assert.ok(!matches(parseCron('@daily'), wc(1, 0, 9, 9, 3)));
  assert.ok(matches(parseCron('@monthly'), wc(0, 0, 1, 5, 2)));
});

test('dom + dow both restricted → either matches (classic cron)', () => {
  const p = parseCron('0 12 1 * 1'); // the 1st OR any Monday
  assert.ok(matches(p, wc(0, 12, 1, 3, 5)));  // 1st, a Friday
  assert.ok(matches(p, wc(0, 12, 17, 3, 1))); // a Monday
  assert.ok(!matches(p, wc(0, 12, 17, 3, 2)));
});

test('one restricted day field → only that one counts', () => {
  const p = parseCron('0 9 * * 1-5'); // weekdays
  assert.ok(matches(p, wc(0, 9, 6, 1, 1)));
  assert.ok(!matches(p, wc(0, 9, 7, 1, 0)));
  const q = parseCron('0 9 */2 * 1'); // `*/2` counts as unrestricted → Monday only
  assert.ok(!matches(q, wc(0, 9, 3, 1, 3)));
});

test('invalid expressions throw readable errors', () => {
  assert.throws(() => parseCron('* * * *'), /5 Felder/);
  assert.throws(() => parseCron('60 * * * *'), /ausserhalb/);
  assert.throws(() => parseCron('a * * * *'), /keine Zahl/);
  assert.throws(() => parseCron('10-5 * * * *'), /absteigend/);
  assert.throws(() => parseCron('*/0 * * * *'), /ausserhalb/);
});

test('wallClock follows the timezone incl. DST', () => {
  // 2026-07-01 01:15Z = 03:15 in Zurich (CEST, +2); 2026-01-15 02:15Z = 03:15 (CET, +1)
  assert.deepEqual(wallClock(new Date('2026-07-01T01:15:00Z'), 'Europe/Zurich'),
    { year: 2026, month: 7, dayOfMonth: 1, hour: 3, minute: 15, dayOfWeek: 3 });
  assert.equal(wallClock(new Date('2026-01-15T02:15:00Z'), 'Europe/Zurich').hour, 3);
  assert.equal(wallClock(new Date('2026-01-15T00:05:00Z'), 'UTC').hour, 0); // no 24 at midnight
});
