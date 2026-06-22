'use strict';
// Server-side HTML escape. Mirror of escHtml() in public/js/utils.js.
//
// The escape invariant (CLAUDE.md → Harte Regeln) says user/dynamic content
// must be escaped *before* it reaches an HTML sink — there is no runtime
// sanitizer. Use this whenever the server emits dynamic HTML.

function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { escHtml };
