// Shared frontend helpers. ESM, no dependencies.

// Escape invariant: any dynamic/user content that flows into an x-html sink
// MUST pass through escHtml() first. There is no runtime sanitizer.
// See CLAUDE.md → Harte Regeln: "x-html nur mit vorab-escaptem Content".
export function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Display timezone, set once from /api/config at boot.
let _tz = 'UTC';
export function setTimezone(tz) {
  if (tz) _tz = tz;
}

// Wrap toLocale* options so every date display uses the configured timezone.
// See CLAUDE.md → Harte Regeln: "Frontend-Datums-Display: nur via tzOpts()".
export function tzOpts(opts = {}) {
  return { timeZone: _tz, ...opts };
}

// Format an ISO+Z timestamp in the configured timezone.
export function formatDate(iso, opts = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, tzOpts(opts));
}

// Tiny fetch wrapper: JSON in/out, throws on non-2xx.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('session-expired'));
    throw new Error('unauthenticated');
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.status === 204 ? null : res.json();
}
