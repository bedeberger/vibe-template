#!/usr/bin/env node
'use strict';
// Stop hook: runs `npm run test:unit` at the end of a turn as a local gate, so
// the drift/invariant guards (loc-limits, no-inline-style, i18n parity, icon
// sprite, squash-drift, migration-lock, …) go red BEFORE a commit/push — not
// only in CI.
//
// Only when the working tree has changes — pure conversation turns skip the
// suite. Green → exit 0, silent. Red → warning on stderr, but still exit 0
// (NON-BLOCKING): parallel sessions may share one checkout, and a blocking
// gate would lock one session for another's drift. CI is the binding gate.
// test:unit is browserless (seconds), no e2e/smoke.

const { spawnSync } = require('node:child_process');
const { ROOT } = require('./_rules.js');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  // stop_hook_active: we are already inside a Stop-hook-driven continuation →
  // don't test again (loop guard per the hook contract).
  try {
    if (JSON.parse(raw || '{}').stop_hook_active) process.exit(0);
  } catch { /* no/broken JSON → carry on */ }

  const status = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (status.status === 0 && !status.stdout.trim()) process.exit(0); // clean tree → nothing to check

  const res = spawnSync('npm', ['run', 'test:unit'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  if (res.status === 0) process.exit(0);

  const out = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
  const tail = out.split('\n').slice(-40).join('\n');
  process.stderr.write('[stop-gate] WARNUNG: `npm run test:unit` ist ROT — pruefen, ob es zu DEINER Arbeit gehoert '
    + `(bei Parallel-Sessions oft Fremd-Drift). CI ist das verbindliche Gate:\n${tail}\n`);
  process.exit(0);
});
