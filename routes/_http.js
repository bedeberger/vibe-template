'use strict';
// Shared HTTP helpers for every router — so a new route copies ONE pattern:
//
//   const { toIntId, handle } = require('./_http');
//
//   router.patch('/things/:id', handle((req, res) => {
//     const id = requireId(req.params.id);   // 400 on a bad id
//     setContext({ entity: id });
//     return thingStore.update(id, req.body); // facade throws DomainErrors
//   }));
//
// handle() awaits the handler, sends its return value as JSON (unless the
// handler already answered) and maps a DomainError to its status. Any other
// error goes to the central error handler in server.js (log + 500).

const { isDomainError, invalid } = require('../lib/errors');

const STATUS_BY_KIND = { invalid: 400, not_found: 404, conflict: 409 };

// A positive integer id, or null.
function toIntId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Like toIntId, but throws a 400 — for the common "no id, no request" case.
function requireId(v, message = 'invalid id') {
  const id = toIntId(v);
  if (!id) throw invalid(message);
  return id;
}

function sendDomainError(res, e) {
  res.status(STATUS_BY_KIND[e.kind] || 400).json({ error: e.message });
}

// Wraps a (sync or async) handler. Options: { status } for the success code
// (e.g. 201 on create, 202 on enqueue).
function handle(fn, { status = 200 } = {}) {
  return async (req, res, next) => {
    try {
      const result = await fn(req, res);
      if (!res.headersSent && result !== undefined) res.status(status).json(result);
    } catch (e) {
      if (isDomainError(e)) return sendDomainError(res, e);
      next(e);
    }
  };
}

module.exports = { toIntId, requireId, handle, sendDomainError, STATUS_BY_KIND };
