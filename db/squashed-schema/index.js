'use strict';
// Squashed final schema — the flattened result of running the whole migration
// chain. Brand-new installs apply this single batch instead of replaying every
// migration (fast path in db/schema.js).
//
// SQUASHED_VERSION MUST equal the highest migration number. The squashed DDL
// MUST stay equivalent (after whitespace normalization) to what the chain
// produces — tests/unit/squash-drift.test.mjs gates exactly that. When you add
// migration N, fold its DDL into the matching segment file below and bump
// SQUASHED_VERSION to N.
//
// The DDL is split across segment files purely to stay under the modularity
// limit (one segment per domain); they are concatenated back into one batch
// here. Segment order is execution order — a new segment goes where its FK
// targets are already defined. (A forward reference is legal in SQLite: the
// parent table must exist when a row is WRITTEN, not at CREATE time — but keep
// the order readable anyway.)
//
// A pure DATA migration (rows only, no DDL) folds nothing — only the version
// moves. Note it in a comment here so the gap in the segments is explained.
//
// The segments are JS template literals: no backticks inside SQL comments.
const SQUASHED_VERSION = 1;

const SQUASHED_SCHEMA = [
  require('./core'),
  require('./notes'),
  require('./jobs'),
].join('\n');

module.exports = { SQUASHED_SCHEMA, SQUASHED_VERSION };
