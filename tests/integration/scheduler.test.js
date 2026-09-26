'use strict';
// Integration: the cron scheduler against a real (temp) DB and the real queue.
// tick(now, tz) is driven with fixed instants — no timers, no waiting a minute.

const test = require('node:test');
const assert = require('node:assert');
const { bootstrap } = require('./_helpers/setup');
const { waitForJob } = require('../_helpers/jobs');

const ctx = bootstrap({ LOCAL_DEV_MODE: '1' });
test.before(ctx.start);
test.after(ctx.stop);

const TZ = 'Europe/Zurich';
const waitDone = (queue, id) => waitForJob(() => queue.getJob(id));

test('jobs-cleanup is registered with its cron', () => {
  const scheduler = require('../../routes/jobs/shared/scheduler');
  assert.deepEqual(scheduler.listSchedules().find((s) => s.type === 'jobs-cleanup'),
    { type: 'jobs-cleanup', cron: '15 3 * * *' });
});

test('a matching minute enqueues once, a non-matching one not at all', async () => {
  const queue = require('../../routes/jobs/shared/queue');
  const scheduler = require('../../routes/jobs/shared/scheduler');
  let release;
  const gate = new Promise((r) => { release = r; });
  queue.registerRunner('test-cron', async () => { await gate; return { ok: true }; });
  scheduler.registerSchedule('test-cron', '*/5 * * * *');

  assert.equal(scheduler.tick(new Date('2026-03-02T10:03:00Z'), TZ).length, 0);

  const [job] = scheduler.tick(new Date('2026-03-02T10:05:00Z'), TZ);
  assert.equal(job.type, 'test-cron');
  assert.equal(job.note_id, null);

  // Same wall-clock minute again (timer jitter, DST fall-back) → no second run.
  assert.equal(scheduler.tick(new Date('2026-03-02T10:05:30Z'), TZ).length, 0);

  // Next match while the first still runs → dedup returns the active job.
  const [again] = scheduler.tick(new Date('2026-03-02T10:10:00Z'), TZ);
  assert.equal(again.id, job.id);

  release();
  assert.equal((await waitDone(queue, job.id)).status, 'done');
});

test('cron is evaluated in the app timezone, not UTC', () => {
  const scheduler = require('../../routes/jobs/shared/scheduler');
  // 03:15 Zurich summer time = 01:15Z; at 03:15Z nothing is due.
  assert.ok(!scheduler.tick(new Date('2026-07-01T03:15:00Z'), TZ).some((j) => j.type === 'jobs-cleanup'));
  assert.ok(scheduler.tick(new Date('2026-07-01T01:15:00Z'), TZ).some((j) => j.type === 'jobs-cleanup'));
});

test('jobs-cleanup deletes only old finished jobs', async () => {
  const queue = require('../../routes/jobs/shared/queue');
  const { db } = require('../../db/schema');
  queue.registerRunner('test-noop', async () => ({}));
  const old = queue.createJob('test-noop', null);
  await waitDone(queue, old.id);
  db.prepare("UPDATE jobs SET finished_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(old.id);
  const fresh = queue.createJob('test-noop', null);
  await waitDone(queue, fresh.id);

  const run = queue.createJob('jobs-cleanup', null);
  const done = await waitDone(queue, run.id);
  assert.equal(done.status, 'done');
  assert.ok(JSON.parse(done.result_json).deleted >= 1);
  assert.equal(queue.getJob(old.id), undefined);
  assert.ok(queue.getJob(fresh.id));
  assert.ok(queue.getJob(run.id));
});

test('a bad expression fails at registration', () => {
  const scheduler = require('../../routes/jobs/shared/scheduler');
  assert.throws(() => scheduler.registerSchedule('test-bad', '99 * * * *'), /ausserhalb/);
  assert.throws(() => scheduler.registerSchedule('jobs-cleanup', '@daily'), /doppelt/);
});
