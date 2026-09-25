// Unit: deploy.yml and scripts/prepare-lxc.sh are one contract split over two
// files. A privileged call the workflow makes but the sudoers rule doesn't
// allow fails only on the real LXC, mid-deploy — and the diagnostic
// `systemctl status` call fails SILENTLY (it hangs on `|| true`), so the boot
// log is missing exactly when it is needed. Gate the pairing here.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const deploy = fs.readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const prepare = fs.readFileSync(new URL('../../scripts/prepare-lxc.sh', import.meta.url), 'utf8');

test('every sudo systemctl call in deploy.yml is allowed by the sudoers rule', () => {
  const calls = [...deploy.matchAll(/sudo \/usr\/bin\/systemctl (\w+) "\$\{SERVICE\}\.service"([^|\n]*)/g)];
  assert.ok(calls.length >= 3, 'expected restart/stop/status calls in deploy.yml');
  for (const [, verb, rest] of calls) {
    const args = rest.trim();
    if (args) {
      assert.ok(
        prepare.includes(`/usr/bin/systemctl ${verb} \${APP_NAME}.service ${args}"`),
        `sudoers lacks the exact line for: systemctl ${verb} <app>.service ${args}`
      );
    } else {
      assert.match(prepare, /for verb in restart start stop status; do/);
      assert.ok(['restart', 'start', 'stop', 'status'].includes(verb), `verb ${verb} not in sudoers loop`);
    }
  }
});

test('deploy.yml runs only env/sqlite3 as the service user', () => {
  const asApp = [...deploy.matchAll(/sudo -u "\$\{APP_NAME\}" (\S+)/g)].map((m) => m[1]);
  assert.ok(asApp.length > 0);
  assert.deepEqual([...new Set(asApp)].sort(), ['env', 'sqlite3']);
  assert.match(prepare, /NOPASSWD: \/usr\/bin\/env, \/usr\/bin\/sqlite3/);
});

test('public/vendor is writable in the unit and created by the deploy', () => {
  assert.match(prepare, /ReadWritePaths=\$\{DATA_DIR\} \$\{APP_DIR\}\/public\/vendor/);
  assert.match(deploy, /mkdir -p "\$\{APP_DIR\}\/public\/vendor"/);
});

test('prepare-lxc.sh is self-contained (pasted onto an empty LXC, no checkout)', () => {
  // No sourcing or copying of sibling files from the repo.
  assert.doesNotMatch(prepare, /^\s*(source|\.)\s+\S/m, 'must not source other files');
  assert.doesNotMatch(prepare, /\$\(dirname|BASH_SOURCE/, 'must not locate sibling files');
});
