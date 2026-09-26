'use strict';
// Scheduled job type: "jobs-cleanup". Reference for a cron-driven job — the
// runner is registered like any other, and registerSchedule() next to it says
// WHEN the scheduler enqueues it (entity-less: note_id NULL). Housekeeping that
// every app needs anyway: finished jobs would otherwise pile up forever.
//
// JOBS_RETENTION_DAYS (default 30) sets how long done/error jobs are kept.

const { registerRunner, purgeFinished } = require('./shared/queue');
const { registerSchedule } = require('./shared/scheduler');

const TYPE = 'jobs-cleanup';
const CRON = '15 3 * * *'; // daily 03:15 app time

function retentionDays() {
  const n = Number(process.env.JOBS_RETENTION_DAYS);
  return Number.isInteger(n) && n > 0 ? n : 30;
}

registerRunner(TYPE, async () => {
  const days = retentionDays();
  return { deleted: purgeFinished(days), retentionDays: days };
});
registerSchedule(TYPE, CRON);

module.exports = { TYPE, CRON };
