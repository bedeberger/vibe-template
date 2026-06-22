'use strict';
// SQL fragment for an ISO-8601 timestamp with Z suffix. Use this in INSERT/
// UPDATE statements instead of `datetime('now')`.
//
// Why: `datetime('now')` yields "YYYY-MM-DD HH:MM:SS" (UTC, no TZ marker).
// JS `new Date("...")` parses that as *local* browser time, so a display
// formatter with { timeZone: appTimezone } shows the UTC clock under the
// local label — an off-by-hours drift. ISO+Z parses unambiguously as UTC.
//
// See CLAUDE.md → Harte Regeln: "DB-Timestamps: ISO+Z via NOW_ISO_SQL".

const NOW_ISO_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

module.exports = { NOW_ISO_SQL };
