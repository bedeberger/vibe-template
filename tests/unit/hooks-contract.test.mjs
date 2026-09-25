// Contract test for the Claude Code hooks in scripts/hooks/ (wired in
// .claude/settings.json). A hook that crashes or silently stops matching looks
// exactly like a green hook — nobody notices until the gate it was meant to
// pre-empt goes red in CI. Each hook is spawned with a sample payload on stdin,
// the way Claude Code calls it, and its exit code / output is pinned:
//   • style-guard: Edit/Write inline style in HTML → exit 2 (block); the same
//     via Bash → exit 0 + additionalContext (warn only); :style custom prop → silent;
//     raw domain SQL in a route → warn; vendor → silent; garbage stdin → silent
//   • i18n-check / loc-limits-check / drift-reminders: silent on the clean tree,
//     reminder on a new migration / unlinked CSS file
//   • session-git-status: valid SessionStart JSON; stop-run-unit-tests: honours
//     stop_hook_active (no recursive test run)
//   • every command in .claude/settings.json points to an existing hook file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ROOT, read } = require('../../scripts/hooks/_rules.js');

function run(hook, payload) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/hooks', hook)], {
    input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const abs = (rel) => join(ROOT, rel);

test('settings.json: jeder Hook-Befehl zeigt auf eine existierende Datei', () => {
  const settings = JSON.parse(read('.claude/settings.json'));
  const cmds = Object.values(settings.hooks).flat().flatMap((m) => m.hooks.map((h) => h.command));
  assert.ok(cmds.length >= 6, `nur ${cmds.length} Hook-Befehle in .claude/settings.json`);
  for (const c of cmds) {
    const m = c.match(/\$CLAUDE_PROJECT_DIR\/(scripts\/hooks\/[\w-]+\.js)/);
    assert.ok(m, `Hook-Befehl ohne "$CLAUDE_PROJECT_DIR/scripts/hooks/…": ${c}`);
    assert.ok(existsSync(abs(m[1])), `Hook-Datei fehlt: ${m[1]}`);
  }
  assert.ok(settings.permissions.deny.includes('Bash(git stash:*)'), 'deny-Liste fuer destruktive git-Befehle fehlt');
});

test('style-guard: blockt Inline-Style per Edit/Write, warnt per Bash', () => {
  const block = run('style-guard.js', { tool_name: 'Write', tool_input: { file_path: abs('public/partials/x.html'), content: '<div style="color:red"></div>' } });
  assert.equal(block.code, 2, 'Inline-Style per Write muss blocken (exit 2)');
  assert.match(block.err, /Inline-Styles sind verboten/);

  const bash = run('style-guard.js', { tool_name: 'Bash', tool_input: { command: 'sed -i "s/a/<b style=\\"x\\">/" public/partials/notes-view.html' } });
  assert.equal(bash.code, 0, 'per Bash nur warnen, nie blocken');
  assert.match(JSON.parse(bash.out).hookSpecificOutput.additionalContext, /per Bash/);

  const ok = run('style-guard.js', { tool_name: 'Edit', tool_input: { file_path: abs('public/partials/x.html'), new_string: `<div :style="{ '--p': x }"></div>` } });
  assert.deepEqual([ok.code, ok.out, ok.err], [0, '', '']);
});

test('style-guard: warnt bei Roh-SQL/datetime in Routen, still in db/ + vendor + Muell', () => {
  const sql = run('style-guard.js', { tool_name: 'Edit', tool_input: { file_path: abs('routes/x.js'), new_string: 'db.prepare("SELECT * FROM notes")' } });
  assert.equal(sql.code, 0);
  assert.match(JSON.parse(sql.out).hookSpecificOutput.additionalContext, /Facade/);
  const now = run('style-guard.js', { tool_name: 'Edit', tool_input: { file_path: abs('db/x.js'), new_string: "SET a = datetime('now')" } });
  assert.match(JSON.parse(now.out).hookSpecificOutput.additionalContext, /NOW_ISO_SQL/);
  for (const p of [
    { tool_name: 'Edit', tool_input: { file_path: abs('db/notes.js'), new_string: 'SELECT * FROM notes' } },
    { tool_name: 'Write', tool_input: { file_path: abs('public/vendor/x.html'), content: '<div style="a">' } },
    'not json',
  ]) {
    const r = run('style-guard.js', p);
    assert.deepEqual([r.code, r.out], [0, ''], `sollte still sein: ${JSON.stringify(p)}`);
  }
});

test('PostToolUse-Hooks: still auf sauberem Stand, Reminder bei neuer Migration/CSS', () => {
  for (const hook of ['i18n-check.js', 'loc-limits-check.js', 'drift-reminders.js']) {
    const r = run(hook, { tool_name: 'Edit', tool_input: { file_path: abs('public/js/i18n/de.json'), new_string: 'x' } });
    assert.deepEqual([r.code, r.out.trim()], [0, ''], `${hook} meldet auf dem aktuellen Stand etwas: ${r.out}`);
  }
  const mig = run('drift-reminders.js', { tool_name: 'Write', tool_input: { file_path: abs('db/migrations/9999_probe.js'), content: 'x' } });
  assert.match(mig.out, /squash:check/);
  assert.match(mig.out, /migrations:lock/);
  const css = run('drift-reminders.js', { tool_name: 'Write', tool_input: { file_path: abs('public/css/components/probe.css'), content: 'x' } });
  assert.match(css.out, /index\.html/);
  assert.match(css.out, /CSS file inventory/);
});

test('SessionStart liefert valides JSON; Stop-Hook respektiert stop_hook_active', () => {
  const s = run('session-git-status.js', {});
  assert.equal(s.code, 0);
  assert.equal(JSON.parse(s.out).hookSpecificOutput.hookEventName, 'SessionStart');
  const stop = run('stop-run-unit-tests.js', { stop_hook_active: true });
  assert.deepEqual([stop.code, stop.out, stop.err], [0, '', '']);
});
