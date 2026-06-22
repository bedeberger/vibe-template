'use strict';
// Per-request / per-job logging context via AsyncLocalStorage. The logger
// reads the active store and renders a tag `[scope|user|entity|jobId]` on
// every line, so a request and the job it spawns share one searchable trace.
//
// See CLAUDE.md → Harte Regeln: "Logging-Kontext".

const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

// Run `fn` within a fresh context. Express middleware wraps each request;
// the job queue wraps each run.
function runWithContext(initial, fn) {
  return als.run({ ...initial }, fn);
}

// Merge fields into the current context (no-op if outside a context).
function setContext(fields) {
  const store = als.getStore();
  if (store) Object.assign(store, fields);
}

function getContext() {
  return als.getStore() || {};
}

// Render the tag in fixed slot order. Missing slots collapse to '-'.
function contextTag() {
  const c = getContext();
  if (!c.scope && !c.user && !c.entity && !c.jobId) return '';
  return `[${c.scope || '-'}|${c.user || '-'}|${c.entity || '-'}|${c.jobId || '-'}]`;
}

module.exports = { runWithContext, setContext, getContext, contextTag };
