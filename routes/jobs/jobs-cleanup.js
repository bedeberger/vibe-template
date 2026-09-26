'use strict';
// Scheduled job type: "jobs-cleanup". Reference for a cron-driven job — the
// runner is registered like any other, and registerSchedule() next to it says
// WHEN the scheduler enqueues it (entity-less: note_id NULL). Housekeeping that
// every app needs anyway: finished jobs would otherwise pile up forever.
//
// The app setting jobs.retention_days (admin console, default 30) sets how
// long done/error jobs are kept; read per run, so a change applies next night.

const { registerRunner, purgeFinished } = require('./shared/queue');
const { registerSchedule } = require('./shared/scheduler');
const appSettings = require('../../lib/app-settings');

const TYPE = 'jobs-cleanup';
const CRON = '15 3 * * *'; // daily 03:15 app time

registerRunner(TYPE, async () => {
  const days = appSettings.get('jobs.retention_days');
  return { deleted: purgeFinished(days), retentionDays: days };
});
registerSchedule(TYPE, CRON);

module.exports = { TYPE, CRON };
