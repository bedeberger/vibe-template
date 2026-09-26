'use strict';
// Waiting for a background job — the one poll loop for every test.
//
//   const job = await waitForJob(() => queue.getJob(id));                        // in-process
//   const job = await waitForJob(async () => (await ctx.get(`/api/jobs/${id}`)).json()); // over HTTP
//
// Resolves with the job once it is done|error; throws after `timeoutMs` so a
// hanging runner fails the test with a message instead of timing out silently.

const FINAL = new Set(['done', 'error']);

async function waitForJob(read, { timeoutMs = 5000, intervalMs = 20 } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const job = await read();
    if (job && FINAL.has(job.status)) return job;
    if (Date.now() > until) throw new Error(`job did not finish within ${timeoutMs} ms (last status: ${job?.status})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

module.exports = { waitForJob };
