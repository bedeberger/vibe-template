'use strict';
// Console/runtime error guard for Playwright. Collects every unhandled browser
// error during a test and turns the test red if any is left that is not on the
// allowlist.
//
// Why this is the most important net against Alpine/library breakage: Alpine 3
// does NOT throw expression errors hard (typo in x-data, undefined method in a
// template, broken x-effect). It logs "Alpine Expression Error" via
// console.warn and re-throws via `setTimeout(() => { throw error })` — that
// async throw arrives as `pageerror`. Both channels are observed here.
//
// The default allowlist covers network noise (missing mock routes, 401/403/404,
// benign ResizeObserver loops). Specs extend it per run (`guard.ignore(/…/)`)
// or switch the assertion off for negative tests (`guard.skip()`).

const DEFAULT_ALLOW = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /the server responded with a status of (401|403|404)/i,
  /ResizeObserver loop/i,
];

// console.warn entries count only with these markers — otherwise every
// legitimate warning would break a test.
const ALPINE_WARN_MARKERS = [/Alpine Expression Error/i, /Alpine Warn/i, /Alpine Error/i];

function attachConsoleGuard(page, opts = {}) {
  const allow = [...DEFAULT_ALLOW, ...(opts.allow || [])];
  const errors = [];
  let enabled = true;

  function record(channel, text, detail) {
    if (enabled) errors.push({ channel, text: String(text || ''), detail });
  }

  page.on('pageerror', (err) => record('pageerror', err?.message || String(err), err?.stack));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') record('console.error', text);
    else if (msg.type() === 'warning' && ALPINE_WARN_MARKERS.some((re) => re.test(text))) record('alpine.warn', text);
  });

  const unmatched = () => errors.filter((e) => !allow.some((re) => re.test(e.text)));

  return {
    errors,
    allow,
    ignore(re) { allow.push(re); return this; },
    skip() { enabled = false; return this; },
    resume() { enabled = true; return this; },
    unmatched,
    assertClean(label = '') {
      if (!enabled) return;
      const bad = unmatched();
      if (!bad.length) return;
      const lines = bad.map((e) => `  [${e.channel}] ${e.text}${e.detail ? '\n    ' + String(e.detail).split('\n').slice(0, 4).join('\n    ') : ''}`);
      throw new Error(`${bad.length} unerwartete(r) Browser-Fehler${label ? ' bei ' + label : ''}:\n${lines.join('\n')}`);
    },
  };
}

module.exports = { attachConsoleGuard, DEFAULT_ALLOW, ALPINE_WARN_MARKERS };
