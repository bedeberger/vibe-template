'use strict';
// Log reader for the admin console (routes/admin-logs.js) — the one place that
// knows the file format of logger.js and its rotation scheme:
//
//   2026-01-01T09:30:00.123Z INFO [scope|user|entity|jobId] message
//   <lines without a timestamp belong to the previous entry (stack traces)>
//
// The tag is optional (lines logged outside a context have none). Files:
// app.log (newest) → app1.log → … → app4.log (winston `tailable`). Everything
// is read backwards in chunks, never a whole file into the heap. Malformed
// lines never throw — they are appended to the previous entry or dropped.

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const MAX_FILES = 5; // matches the File transport in logger.js
const CHUNK = 64 * 1024;
const LEVELS = ['error', 'warn', 'info', 'debug'];

const LINE_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) ([A-Z]+) (?:\[([^|\]]*)\|([^|\]]*)\|([^|\]]*)\|([^|\]]*)\] )?(.*)$/;

const slot = (v) => (v === undefined || v === '' || v === '-' ? null : v);

// One header line → entry, or null if the line is a continuation/garbage.
function parseHeader(line) {
  const m = LINE_RE.exec(line);
  if (!m) return null;
  const [, ts, level, scope, user, entity, jobId, msg] = m;
  return { ts, level: level.toLowerCase(), scope: slot(scope), user: slot(user), entity: slot(entity), jobId: slot(jobId), msg, stack: null };
}

// Lines in chronological order → entries in chronological order.
function* parseLines(lines) {
  let pending = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    const header = parseHeader(line);
    if (header) {
      if (pending) yield pending;
      pending = header;
    } else if (pending && line.trim() !== '') {
      (pending.stack ||= []).push(line);
    }
  }
  if (pending) yield pending;
}

// Lines of one file, newest first.
async function* readLinesReverse(file) {
  let fd;
  try { fd = await fs.promises.open(file, 'r'); } catch { return; }
  try {
    let pos = (await fd.stat()).size;
    let carry = Buffer.alloc(0);
    while (pos > 0) {
      const len = Math.min(CHUNK, pos);
      pos -= len;
      const buf = Buffer.alloc(len);
      await fd.read(buf, 0, len, pos);
      // Split on bytes, not on a decoded string: a chunk boundary may cut a
      // multi-byte UTF-8 character, a newline byte never does.
      const data = Buffer.concat([buf, carry]);
      let end = data.length;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i] !== 0x0a) continue;
        if (i + 1 < end) yield data.toString('utf8', i + 1, end);
        end = i;
      }
      carry = data.subarray(0, end);
    }
    if (carry.length) yield carry.toString('utf8');
  } finally {
    await fd.close().catch(() => {});
  }
}

// Entries of the file chain, newest first. Stack lines precede their header
// when read backwards, so they are collected until the header shows up.
async function* readEntriesReverse(files) {
  for (const file of files) {
    let stack = [];
    for await (const line of readLinesReverse(file)) {
      const entry = parseHeader(line.replace(/\r$/, ''));
      if (!entry) {
        if (line.trim() !== '') stack.unshift(line);
        continue;
      }
      if (stack.length) entry.stack = stack;
      stack = [];
      yield entry;
    }
  }
}

// Current file first, then the rotated ones that exist.
function listFiles(base = logger.logFile) {
  const ext = path.extname(base);
  const stem = path.join(path.dirname(base), path.basename(base, ext));
  const all = [base];
  for (let i = 1; i < MAX_FILES; i++) all.push(`${stem}${i}${ext}`);
  return all.filter((f) => fs.existsSync(f));
}

function fileInfos(base = logger.logFile) {
  return listFiles(base).map((f, idx) => {
    const st = fs.statSync(f);
    return { key: idx === 0 ? 'current' : String(idx), name: path.basename(f), size: st.size, mtime: st.mtime.toISOString() };
  });
}

// 'current' | '1' … → absolute path, or null.
function resolveFile(key, base = logger.logFile) {
  const files = listFiles(base);
  const idx = key === 'current' || key === undefined ? 0 : Number(key);
  return Number.isInteger(idx) && idx >= 0 && idx < files.length ? files[idx] : null;
}

// Query params → normalised filter (empty → null).
function normalizeFilter(q = {}) {
  const s = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const level = s(q.level)?.toLowerCase() || null;
  return { level: LEVELS.includes(level) ? level : null, scope: s(q.scope), user: s(q.user), entity: s(q.entity), q: s(q.q) };
}

function matches(e, f) {
  if (f.level && e.level !== f.level) return false;
  if (f.scope && e.scope !== f.scope) return false;
  if (f.user && (e.user || '').toLowerCase() !== f.user.toLowerCase()) return false;
  if (f.entity && !(e.entity || '').toLowerCase().includes(f.entity.toLowerCase())) return false;
  if (f.q) {
    const hay = `${e.msg}\n${(e.stack || []).join('\n')}`.toLowerCase();
    if (!hay.includes(f.q.toLowerCase())) return false;
  }
  return true;
}

// Newest first, up to `limit` matches older than the cursor `before` (the ts of
// the last entry of the previous page). Entries sharing that exact millisecond
// with the cursor are skipped — accepted for a viewer.
async function search({ filter = {}, before = null, limit = 200, base = logger.logFile } = {}) {
  const f = normalizeFilter(filter);
  const max = Math.min(1000, Math.max(1, Number(limit) || 200));
  const entries = [];
  for await (const e of readEntriesReverse(listFiles(base))) {
    if (before && e.ts >= before) continue;
    if (!matches(e, f)) continue;
    if (entries.length === max) return { entries, hasMore: true };
    entries.push(e);
  }
  return { entries, hasMore: false };
}

// Live tail of the current file: calls onEntry for each new entry and
// onRotated when the file shrank (rotation). fs.watch misses the inode change
// of a rename, so a 2 s poll backs it up. Returns stop().
function follow({ onEntry, onRotated, base = logger.logFile, pollMs = 2000 }) {
  let offset = fs.existsSync(base) ? fs.statSync(base).size : 0;
  let partial = '';
  let busy = false;
  let stopped = false;

  async function drain() {
    if (busy || stopped) return;
    busy = true;
    try {
      let size;
      try { size = (await fs.promises.stat(base)).size; } catch { return; }
      if (size < offset) { offset = 0; partial = ''; onRotated?.(); }
      if (size === offset) return;
      let chunk = partial;
      for await (const buf of fs.createReadStream(base, { start: offset, end: size - 1 })) chunk += buf.toString('utf8');
      offset = size;
      const lines = chunk.split('\n');
      partial = lines.pop();
      for (const e of parseLines(lines)) if (!stopped) onEntry(e);
    } finally {
      busy = false;
    }
  }

  let watcher = null;
  try { watcher = fs.watch(base, { persistent: false }, () => { drain(); }); } catch { /* poll only */ }
  const poll = setInterval(drain, pollMs);
  poll.unref?.();
  drain();

  return function stop() {
    stopped = true;
    clearInterval(poll);
    try { watcher?.close(); } catch { /* already closed */ }
  };
}

module.exports = { LEVELS, parseHeader, parseLines, readLinesReverse, listFiles, fileInfos, resolveFile, normalizeFilter, matches, search, follow };
