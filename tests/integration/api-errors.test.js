'use strict';
// Integration: the error contract of the API — every failure is JSON with a
// stable status: 400 bad input, 404 missing, 500 without internals. The status
// codes and messages are what the frontend maps on; change them deliberately.

const test = require('node:test');
const assert = require('node:assert');
const { bootstrap } = require('./_helpers/setup');

const ctx = bootstrap({ LOCAL_DEV_MODE: '1' });
test.before(ctx.start);
test.after(ctx.stop);

const { get, send } = ctx;

async function expectError(resPromise, status, error) {
  const res = await resPromise;
  assert.equal(res.status, status);
  assert.match(res.headers.get('content-type') || '', /json/);
  if (error) assert.deepEqual(await res.json(), { error });
}

async function firstNotebookId() {
  return (await (await get('/api/notebooks')).json())[0].id;
}

test('notes: invalid ids and missing parameters answer 400', async () => {
  await expectError(get('/api/notes'), 400, 'notebook_id required');
  await expectError(get('/api/notes/abc'), 400, 'invalid id');
  await expectError(send('/api/notes', 'POST', { title: 'x' }), 400, 'notebook_id required');
  await expectError(send('/api/notebooks', 'POST', { name: '  ' }), 400, 'notebook name required');
});

test('notes: unknown ids answer 404', async () => {
  await expectError(get('/api/notes/999999'), 404, 'not found');
  await expectError(send('/api/notes/999999', 'PATCH', { title: 'x' }), 404, 'not found');
  await expectError(send('/api/notes', 'POST', { notebook_id: 999999, title: 'x' }), 404, 'unknown notebook');
});

test('PATCH /api/notes/:id edits, and refuses a blank title', async () => {
  const nbId = await firstNotebookId();
  const note = await (await send('/api/notes', 'POST', { notebook_id: nbId, title: 'Before' })).json();

  const res = await send(`/api/notes/${note.id}`, 'PATCH', { body: 'new body' });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.deepEqual([updated.title, updated.body], ['Before', 'new body']);

  await expectError(send(`/api/notes/${note.id}`, 'PATCH', { title: '   ' }), 400, 'note title required');
});

test('jobs: bad input answers 400, unknown job 404', async () => {
  await expectError(send('/api/jobs', 'POST', {}), 400, 'note_id required');
  await expectError(send('/api/jobs', 'POST', { note_id: 1, type: 'nope' }), 400, 'unknown job type: nope');
  await expectError(get('/api/jobs/999999'), 404, 'not found');
});

test('malformed JSON body answers a JSON 400, not an HTML error page', async () => {
  const res = await fetch(ctx.url('/api/notes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"title": ',
  });
  await expectError(Promise.resolve(res), 400);
});
