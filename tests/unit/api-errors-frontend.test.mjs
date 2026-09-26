// Unit: the frontend's error contract (public/js/utils.js) — api() turns every
// failure into an ApiError with a status, apiErrorKey() picks the user-facing
// text for the global toast (js/app/toast.js), and the event names utils.js
// must spell as literals (it has no imports) match events.js.
//
// Browser modules are loaded as data: URLs (public/ is not an ESM package for
// Node); window is a plain EventTarget, fetch is stubbed per test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (rel) => import(`data:text/javascript,${encodeURIComponent(readFileSync(join(ROOT, rel), 'utf8'))}`);
const utils = await load('public/js/utils.js');
const { EVT } = await load('public/js/events.js');

globalThis.window = new EventTarget();
const realFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = realFetch; delete globalThis.window; });

const answer = (status, body) => async () => new Response(body === undefined ? null : JSON.stringify(body), { status });

async function failure(fetchImpl) {
  globalThis.fetch = fetchImpl;
  try {
    await utils.api('/api/x');
  } catch (e) {
    return e;
  }
  assert.fail('api() did not throw');
}

test('api() keeps the server message and the status', async () => {
  const e = await failure(answer(404, { error: 'not found' }));
  assert.ok(utils.isApiError(e));
  assert.deepEqual([e.status, e.message], [404, 'not found']);
});

test('no answer at all (offline, server down) is status 0', async () => {
  const e = await failure(async () => { throw new TypeError('fetch failed'); });
  assert.deepEqual([e.status, utils.apiErrorKey(e)], [0, 'errors.network']);
});

test('401 fires session-expired and is still an ApiError', async () => {
  let fired = 0;
  window.addEventListener(EVT.SESSION_EXPIRED, () => { fired++; });
  const e = await failure(answer(401, { error: 'unauthenticated' }));
  assert.equal(fired, 1, `utils.js dispatches a name other than EVT.SESSION_EXPIRED ("${EVT.SESSION_EXPIRED}")`);
  assert.equal(e.status, 401);
});

test('notify() dispatches EVT.NOTIFY with kind + text', () => {
  let detail = null;
  window.addEventListener(EVT.NOTIFY, (ev) => { detail = ev.detail; });
  utils.notify('ok', 'Gespeichert');
  assert.deepEqual(detail, { kind: 'ok', text: 'Gespeichert' }, `utils.js dispatches a name other than EVT.NOTIFY ("${EVT.NOTIFY}")`);
});

test('apiErrorKey maps each status class to a key that exists in both locales', () => {
  const cases = [[400, 'errors.invalid'], [403, 'errors.forbidden'], [404, 'errors.notFound'], [409, 'errors.conflict'],
    [422, 'errors.invalid'], [429, 'errors.rateLimited'], [500, 'errors.server'], [503, 'errors.server']];
  for (const [status, key] of cases) assert.equal(utils.apiErrorKey(utils.apiError(status, 'x')), key, String(status));
  assert.equal(utils.apiErrorKey(new Error('a bug, not an API answer')), 'errors.generic');

  for (const loc of ['de', 'en']) {
    const errors = JSON.parse(readFileSync(join(ROOT, `public/js/i18n/${loc}.json`), 'utf8')).errors;
    for (const key of [...cases.map((c) => c[1]), 'errors.network', 'errors.generic']) {
      assert.ok(errors?.[key.split('.')[1]], `${loc}.json: ${key} fehlt`);
    }
  }
});
