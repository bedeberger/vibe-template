'use strict';
// Domain errors — what a facade throws when a caller asked for something the
// domain refuses. The facade names the KIND of refusal; it knows nothing about
// HTTP. The route layer maps kind → status in ONE place (routes/_http.js).
//
//   const { invalid, notFound, conflict } = require('./errors');
//   if (!name) throw invalid('notebook name required');
//   if (!row)  throw notFound('unknown notebook');
//
// Anything that is NOT a DomainError (a DB failure, a bug) is an unexpected
// error: the central handler in server.js logs it and answers 500 — its message
// never reaches the client.

class DomainError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'DomainError';
    this.kind = kind; // 'invalid' | 'not_found' | 'conflict'
  }
}

const invalid = (message) => new DomainError('invalid', message);
const notFound = (message = 'not found') => new DomainError('not_found', message);
const conflict = (message) => new DomainError('conflict', message);

const isDomainError = (e) => e instanceof DomainError;

module.exports = { DomainError, invalid, notFound, conflict, isDomainError };
