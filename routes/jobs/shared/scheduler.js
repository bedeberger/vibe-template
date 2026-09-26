'use strict';
// In-process cron scheduler. It does NO work itself: on a matching minute it
// only enqueues a job via queue.createJob(type, null), so every scheduled run
// gets the queue's dedup, status row, lifecycle and log context for free
// (CLAUDE.md → Harte Regeln: Langläufer nur via Job-Queue).
//
// Expressions are evaluated in the app timezone (app.timezone, same as date
// display), not in the process timezone. Semantics (routes/jobs/CLAUDE.md):
//   - one tick per wall-clock minute, aligned to the minute boundary;
//   - a run whose previous job is still queued/running is skipped (dedup);
//   - no catch-up: minutes missed while the process was down are not replayed;
//   - DST: a skipped wall-clock minute never fires, a repeated one fires once.
// Started by server.js start() only — importing the app (tests) never ticks.

const queue = require('./queue');
const { parseCron, wallClock, matches } = require('../../../lib/cron');
const appSettings = require('../../../lib/app-settings');
const { runWithContext } = require('../../../lib/log-context');
const logger = require('../../../logger');

const schedules = []; // { type, cron, parsed, lastKey }

// Declare a schedule next to the runner (one job-type file owns both). Throws
// at require time on a bad expression, so a typo breaks the boot, not 3 a.m.
function registerSchedule(type, cron) {
  if (schedules.some((s) => s.type === type)) throw new Error(`Schedule für "${type}" doppelt registriert`);
  schedules.push({ type, cron, parsed: parseCron(cron), lastKey: null });
}

function listSchedules() {
  return schedules.map(({ type, cron }) => ({ type, cron }));
}

// Evaluate every schedule for the minute containing `now`. Exported for tests;
// returns the jobs it enqueued (or found active).
function tick(now = new Date(), tz = appSettings.getTimezone()) {
  const wc = wallClock(now, tz);
  const key = `${wc.year}-${wc.month}-${wc.dayOfMonth} ${wc.hour}:${wc.minute}`;
  const started = [];
  runWithContext({ scope: 'cron' }, () => {
    for (const s of schedules) {
      if (s.lastKey === key || !matches(s.parsed, wc)) continue;
      s.lastKey = key;
      try {
        started.push(queue.createJob(s.type, null));
      } catch (e) {
        logger.error(`Cron ${s.type} (${s.cron}) nicht eingereiht: ${e.message}`);
      }
    }
  });
  return started;
}

let _timer = null;

function msToNextMinute(now = Date.now()) {
  return 60000 - (now % 60000) + 50; // +50 ms: land safely inside the new minute
}

function start() {
  if (_timer) return;
  const loop = () => {
    _timer = setTimeout(() => {
      tick();
      loop();
    }, msToNextMinute());
    _timer.unref(); // never keep the process alive on its own
  };
  loop();
  logger.info(`Scheduler gestartet (${schedules.length} Zeitplan/Zeitpläne).`);
}

function stop() {
  clearTimeout(_timer);
  _timer = null;
}

module.exports = { registerSchedule, listSchedules, tick, start, stop };
