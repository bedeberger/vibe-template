'use strict';
// Server-side timezone-aware date formatting. Reads the same app.timezone
// setting the frontend uses (public/js/utils.js#tzOpts), so server-rendered
// and client-rendered timestamps agree.

const appSettings = require('./app-settings');

// Format an ISO+Z timestamp for display in the configured timezone.
function formatLocal(isoString, opts = {}) {
  if (!isoString) return '';
  const tz = appSettings.getTimezone();
  return new Date(isoString).toLocaleString('de-CH', { timeZone: tz, ...opts });
}

module.exports = { formatLocal };
