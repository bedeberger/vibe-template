// Shared frontend helpers. ESM, NO imports: tests/unit loads this file as a
// data: URL (escape-xss, api-errors-frontend). Event names are therefore
// literals here — their values in events.js are pinned by api-errors-frontend.test.

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

// A failed api() call. `status` is the HTTP status (0 = no answer: offline,
// server down), `message` the server's `{ error }` text — the API contract
// cards may map on (routes/CLAUDE.md → "Fehlertexte sind API-Vertrag").
export function apiError(status, message) {
  return Object.assign(new Error(message), { name: 'ApiError', status });
}
// By name, not instanceof: survives two instances of this module.
export const isApiError = (e) => e?.name === 'ApiError';

// i18n key of the generic, user-facing text for a failed call — what the
// global error toast shows when no card handled the error itself.
export function apiErrorKey(e) {
  const status = isApiError(e) ? e.status : -1;
  if (status === 0) return 'errors.network';
  if (status === 403) return 'errors.forbidden';
  if (status === 404) return 'errors.notFound';
  if (status === 409) return 'errors.conflict';
  if (status === 429) return 'errors.rateLimited';
  if (status >= 500) return 'errors.server';
  if (status >= 400) return 'errors.invalid';
  return 'errors.generic';
}

// Tiny fetch wrapper: JSON in/out, throws an ApiError (apiError()) on non-2xx or no answer.
// A 401 additionally fires session-expired (the root shows the banner).
// Uncaught in a card, the error ends up in the global error toast (js/app.js).
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw apiError(0, 'network error');
  }
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('session-expired')); // = EVT.SESSION_EXPIRED
    throw apiError(401, 'unauthenticated');
  }
  if (!res.ok) throw apiError(res.status, (await res.json().catch(() => ({}))).error || res.statusText);
  return res.status === 204 ? null : res.json();
}

// A toast from anywhere (card, job): kind 'ok' | 'err', text already translated.
export function notify(kind, text) {
  window.dispatchEvent(new CustomEvent('app:notify', { detail: { kind, text } })); // = EVT.NOTIFY
}
