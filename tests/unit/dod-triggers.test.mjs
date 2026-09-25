// Unit gate: the Definition of Done itself — its trigger table, its detection
// of the write path, and its parity with CLAUDE.md (scripts/hooks/_dod.js,
// used by the Stop hook scripts/hooks/session-stop-check.js).
//
// Why: every hole in the trigger table fails SILENTLY — the hook says nothing
// for a directory it doesn't know, and a hook that says nothing looks exactly
// like a green one. Same for a Bash write (`sed -i`, heredoc, `tee`) that
// carries no `file_path`.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dod = createRequire(import.meta.url)('../../scripts/hooks/_dod.js');

// Tracked + untracked-but-not-ignored: a brand-new file must be covered too.
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && fs.existsSync(path.join(ROOT, f)));

// ── 1. Coverage: every app source file triggers something ───────────────────
// Formulated as EXCLUSION, not inclusion: a list "db|lib|routes|public" would be
// tested against itself, and a new directory would silently drop out.
const SOURCE_EXT = /\.(?:js|mjs|cjs|html|css)$/;
const NOT_APP = [
  { re: /^tests\//, why: 'test code is the criterion, not the trigger' },
  { re: /^scripts\//, why: 'tools and hooks, not the app' },
  { re: /^\.claude\//, why: 'the Claude Code layer (commands, skills), never shipped' },
  { re: /^playwright(?:\.app)?\.config\.js$/, why: 'tool configuration' },
  { re: /^public\/vendor\//, why: 'vendored (scripts/vendor-sync.js), we do not write it' },
  { re: /^public\/js\/i18n\//, why: 'locale bundles — own gates (i18n-*) + the PostToolUse hook' },
];

test('every app source file triggers a DoD criterion', () => {
  const candidates = tracked.filter((f) => SOURCE_EXT.test(f)).filter((f) => !NOT_APP.some((x) => x.re.test(f)));
  assert.ok(candidates.length > 20, `only ${candidates.length} candidates — detection broken?`);
  const uncovered = candidates.filter((f) => dod.classify(f).length === 0);
  assert.deepEqual(uncovered, [],
    'These app files trigger NOTHING in scripts/hooks/_dod.js — a change to them passes without any '
      + 'test/doc/mobile check. Add them to TRIGGERS or exclude them here with a reason (NOT_APP).');
});

test('the vendored tree triggers nothing', () => {
  const fp = tracked.filter((f) => /^public\/vendor\//.test(f)).filter((f) => dod.classify(f).length > 0);
  assert.deepEqual(fp, [], 'A trigger reaches into a foreign tree.');
});

test('a route asks for unit + integration tests + docs', () => {
  assert.deepEqual(dod.classify('routes/notes.js'), ['backend']);
  assert.deepEqual(dod.missingCriteria(['routes/notes.js']).map((c) => c.key), ['unit', 'integration', 'docs']);
});

test('pages and partials ask for e2e and mobile', () => {
  for (const page of ['public/index.html', 'public/login.html']) {
    assert.ok(fs.existsSync(path.join(ROOT, page)), `${page} missing — renamed?`);
    assert.deepEqual(dod.classify(page), ['frontend', 'layout'], `${page}`);
    assert.ok(dod.missingCriteria([page]).some((c) => c.key === 'smoke'), `${page} asks for no e2e spec`);
  }
});

test('a migration asks for the dev seed', () => {
  assert.ok(dod.missingCriteria(['db/migrations/0002_x.js']).some((c) => c.key === 'seed'));
  assert.ok(!dod.missingCriteria(['db/migrations/0002_x.js', 'lib/dev-seed.js']).some((c) => c.key === 'seed'));
});

// ── 2. Write path detection ─────────────────────────────────────────────────
test('a Bash write is detected, a read is not', () => {
  const line = (name, input) => `${JSON.stringify({ message: { content: [{ type: 'tool_use', name, input }] } })}\n`;
  const writes = [
    "sed -i 's/a/b/' lib/x.js",
    'cat > public/js/y.js <<EOF\nconst a = 1;\nEOF',
    'printf "x" >> routes/z.js',
    'node -e "require(\'fs\').writeFileSync(\'lib/x.js\', \'\')"',
    'cp lib/a.js lib/x.js',
    'tee lib/x.js < /dev/null',
  ];
  for (const cmd of writes) {
    const found = dod.editedPaths(line('Bash', { command: cmd }), '/repo');
    assert.ok([...found].some((f) => /^(?:lib|routes|public)\//.test(f)), `not detected as write: ${cmd}`);
  }
  const reads = [
    'grep -n pattern lib/x.js',
    'cat public/js/y.js',
    'sed -n "1,20p" routes/z.js',
    'node --test tests/unit/x.test.mjs',
    // a probe naming paths as DATA, and the BODY of a heredoc written outside the tree
    'node -e "for (const f of [\'public/index.html\']) console.log(f)"',
    'cat > /tmp/probe.jsonl <<EOF\n{"file_path":"/repo/public/css/entities/notes.css"}\nEOF',
    'git status --porcelain public/index.html lib/x.js',
    'wc -l lib/a.js lib/b.js',
  ];
  for (const cmd of reads) {
    assert.equal(dod.editedPaths(line('Bash', { command: cmd }), '/repo').size, 0, `a read counts as write: ${cmd}`);
  }
  assert.deepEqual([...dod.editedPaths(line('Edit', { file_path: '/repo/lib/x.js' }), '/repo')], ['lib/x.js']);
});

test('the TARGET of a write is detected, not every path mentioned', () => {
  assert.deepEqual(dod.writeTargets('cp lib/source.js lib/target.js'), ['lib/target.js']);
  assert.deepEqual(dod.writeTargets('cat > lib/target.js <<EOF\nrequire("./lib/other.js");\nEOF'), ['lib/target.js']);
  assert.deepEqual(dod.writeTargets('sed -i s/a/b/ lib/a.js && printf x >> public/js/b.js').sort(), ['lib/a.js', 'public/js/b.js']);
  assert.deepEqual(dod.writeTargets('npm test 2>&1 | grep lib/x.js'), []);
});

// ── 3. Parity hook ↔ CLAUDE.md ──────────────────────────────────────────────
test('CLAUDE.md carries the Definition of Done with the same criteria', () => {
  const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
  const from = claude.indexOf('## Definition of Done');
  assert.ok(from > 0, 'CLAUDE.md has no "## Definition of Done" section — the Stop hook points there.');
  const next = claude.indexOf('\n## ', from + 4);
  const section = claude.slice(from, next < 0 ? undefined : next);
  const missing = dod.CRITERIA.filter((c) => !section.includes(c.label)).map((c) => c.key);
  assert.deepEqual(missing, [], 'The CLAUDE.md section does not name every criterion the hook checks (labels verbatim).');
  for (const dir of ['db/', 'lib/', 'routes/', 'public/']) assert.ok(section.includes(dir), `trigger table in CLAUDE.md lacks ${dir}`);
  assert.match(section, /\bCI\b/, 'The section must say that CI is the binding gate — the hook is a reminder, not a lock.');
});

// ── 4. Mobile: name the specs instead of asking ─────────────────────────────
test('mobile coverage names specs per view, and reports a stem without any', () => {
  const [cov] = dod.phoneCoverage(ROOT, ['public/partials/notes.html']);
  assert.equal(cov.stem, 'notes');
  assert.ok(cov.any.length >= 1, `notes has specs, got ${JSON.stringify(cov)}`);
  const [none] = dod.phoneCoverage(ROOT, ['public/css/entities/zzz-no-such-view.css']);
  assert.deepEqual(none.phone, []);
  assert.deepEqual(none.any, []);
});
