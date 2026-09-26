'use strict';
// Shared by the file hooks: WHICH files does this tool call touch, and with
// WHAT new text?
//
// Edit/Write/MultiEdit carry `tool_input.file_path`. A change via **Bash**
// (`sed -i`, a heredoc, `tee`, `cp`) carries none — without this helper it
// would slip past every hook silently, and a silent hook looks exactly like a
// green one. For Bash, "written" cannot be told apart from "read" (`grep x
// public/a.html` names the same path as `sed -i … public/a.html`), so paths
// are detected GENEROUSLY (any repo-plausible path in the command) and the
// consequence is MILDER: style-guard only warns on Bash, it blocks only on
// Edit/Write. A false alarm costs one hint line; a missed violation costs a
// red gate test later.

const path = require('node:path');
const { ROOT } = require('./_rules.js');

// File extensions any rule cares about.
const EXT = 'js|mjs|cjs|json|html|css|svg|md';
const PATH_IN_COMMAND = new RegExp(`[\\w@.\\-/]+\\.(?:${EXT})\\b`, 'g');

function payloadFrom(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

function isBash(payload) {
  return (payload.tool_name || '') === 'Bash' || typeof (payload.tool_input || {}).command === 'string';
}

// All touched paths, ABSOLUTE + POSIX-normalised, deduplicated; vendor and
// node_modules dropped. Bash commands name paths repo-relative, so they are
// resolved against ROOT — otherwise no path rule would ever match.
function touchedPaths(payload) {
  const ti = payload.tool_input || {};
  const out = [];
  if (typeof ti.file_path === 'string' && ti.file_path) out.push(ti.file_path);
  if (typeof ti.command === 'string') {
    for (const m of ti.command.match(PATH_IN_COMMAND) || []) out.push(m);
  }
  const seen = new Set();
  return out
    .map((p) => path.resolve(ROOT, p).split(path.sep).join('/'))
    .filter((p) => !p.includes('/node_modules/') && !p.includes('/vendor/'))
    .filter((p) => (seen.has(p) ? false : seen.add(p)));
}

// ROOT-relative form of an absolute touched path ('' when outside the repo).
function relOf(abs) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  return rel.startsWith('..') ? '' : rel;
}

// The newly written text. For Bash that is the command itself — a heredoc
// carries its content there, a sed expression its replacement.
function writtenText(payload) {
  const ti = payload.tool_input || {};
  let text = '';
  if (typeof ti.content === 'string') text += `${ti.content}\n`;
  if (typeof ti.new_string === 'string') text += `${ti.new_string}\n`;
  if (Array.isArray(ti.edits)) {
    for (const e of ti.edits) if (e && typeof e.new_string === 'string') text += `${e.new_string}\n`;
  }
  if (typeof ti.command === 'string') text += `${ti.command}\n`;
  return text;
}

// Read the hook payload from stdin, then call fn(payload).
function onPayload(fn) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    const payload = payloadFrom(raw);
    if (!payload) process.exit(0);
    fn(payload);
  });
}

// Hand a non-blocking hint to Claude. On exit 0 Claude reads ONLY
// hookSpecificOutput.additionalContext — plain stdout lands in the transcript
// view, where nobody acts on it. Every advisory hook goes through here.
function emitContext(hookEventName, text) {
  if (!text) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext: text } }));
}

module.exports = { payloadFrom, isBash, touchedPaths, relOf, writtenText, onPayload, emitContext };
