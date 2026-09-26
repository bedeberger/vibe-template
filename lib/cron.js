'use strict';
// Minimal 5-field cron parser + matcher (no dependency). Pure — no DB, no clock
// of its own — so it is unit-testable in isolation. The scheduler in
// routes/jobs/shared/scheduler.js asks once a minute whether an expression
// matches the current wall-clock minute in the app timezone.
//
//   ┌ minute (0-59) ┌ hour (0-23) ┌ day of month (1-31) ┌ month (1-12) ┌ day of week (0-7, 0/7 = Sun)
//   *  *  *  *  *
//
// Per field: `*`, `5`, `1-5`, `1,15,30`, `*/10`, `8-18/2`. Macros: @hourly,
// @daily (= @midnight), @weekly, @monthly, @yearly (= @annually). No names
// (MON, JAN) and no seconds — keep expressions numeric.
// Day of month + day of week follow classic cron: if BOTH are restricted, a
// day matches when EITHER does.

const MACROS = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
};

const FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'dayOfMonth', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'dayOfWeek', min: 0, max: 7 },
];

function toInt(s, field, expr) {
  if (!/^\d+$/.test(s)) throw new Error(`cron "${expr}": ${field.name} "${s}" ist keine Zahl`);
  const n = Number(s);
  if (n < field.min || n > field.max) {
    throw new Error(`cron "${expr}": ${field.name} ${n} ausserhalb ${field.min}-${field.max}`);
  }
  return n;
}

function parseField(src, field, expr) {
  const values = new Set();
  for (const part of src.split(',')) {
    const [range, stepSrc] = part.split('/');
    const step = stepSrc === undefined ? 1 : toInt(stepSrc, { ...field, min: 1 }, expr);
    let lo;
    let hi;
    if (range === '*') {
      lo = field.min;
      hi = field.max;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-');
      lo = toInt(a, field, expr);
      hi = toInt(b, field, expr);
      if (lo > hi) throw new Error(`cron "${expr}": ${field.name} ${lo}-${hi} ist absteigend`);
    } else {
      lo = toInt(range, field, expr);
      hi = stepSrc === undefined ? lo : field.max; // `5/15` = from 5 every 15
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  if (field.name === 'dayOfWeek' && values.delete(7)) values.add(0);
  return { values, wildcard: src.startsWith('*') }; // Vixie: '*/2' counts as unrestricted
}

// Parse an expression once; throws with a readable message on a typo, so a bad
// schedule fails at boot instead of silently never running.
function parseCron(expr) {
  const src = MACROS[String(expr).trim()] || String(expr).trim();
  const parts = src.split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron "${expr}": erwartet 5 Felder, gefunden ${parts.length}`);
  const parsed = { expr };
  FIELDS.forEach((f, i) => { parsed[f.name] = parseField(parts[i], f, expr); });
  return parsed;
}

// Wall-clock fields of `date` in IANA timezone `tz` (DST-aware via Intl).
function wallClock(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', weekday: 'short',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    dayOfMonth: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    dayOfWeek: weekday,
  };
}

// Does the parsed expression match these wall-clock fields?
function matches(parsed, wc) {
  if (!parsed.minute.values.has(wc.minute)) return false;
  if (!parsed.hour.values.has(wc.hour)) return false;
  if (!parsed.month.values.has(wc.month)) return false;
  const dom = parsed.dayOfMonth.values.has(wc.dayOfMonth);
  const dow = parsed.dayOfWeek.values.has(wc.dayOfWeek);
  if (parsed.dayOfMonth.wildcard || parsed.dayOfWeek.wildcard) {
    return (parsed.dayOfMonth.wildcard || dom) && (parsed.dayOfWeek.wildcard || dow);
  }
  return dom || dow;
}

module.exports = { parseCron, wallClock, matches };
