#!/usr/bin/env node
'use strict';
// SessionStart hook: writes branch + working-tree status into the session
// context, so it is visible BEFORE work starts what already lies uncommitted
// in the tree. A parallel session (or the user) may be working in the same
// checkout — foreign uncommitted work must not slip into your own commit, and
// must never be "cleaned up" (no git stash / checkout -- / restore; those are
// denied in .claude/settings.json). Clean tree → a one-line message.
// Plus setup hints for a fresh clone (npm install, /projekt-init) — _setup.js.

const { spawnSync } = require('node:child_process');
const { ROOT } = require('./_rules.js');
const { setupHints } = require('./_setup.js');

const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });

const branch = (git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || '').trim() || '?';
const lines = (git(['status', '--porcelain']).stdout || '').replace(/\s+$/, '');

let context;
if (!lines) {
  context = `[git] Branch ${branch}, Working Tree sauber.`;
} else {
  const all = lines.split('\n');
  const shown = all.slice(0, 40).join('\n') + (all.length > 40 ? `\n… (+${all.length - 40} weitere)` : '');
  context = `[git] Branch ${branch} — ${all.length} uncommittete Aenderung(en) beim Session-Start:\n${shown}\n`
    + 'Achtung: nicht alles davon stammt zwingend aus dieser Session (parallele Session / Live-Commit des Users). '
    + 'Vor eigenen Commits pruefen, was wirklich zu deiner Arbeit gehoert — kein git stash, kein '
    + 'git checkout -- <file> auf fremde Aenderungen.';
}

const hints = setupHints(ROOT);
if (hints.length) context = `${hints.join('\n')}\n${context}`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
}));
process.exit(0);
