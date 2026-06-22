// Lightweight i18n, no dependencies. Loads de.json as fallback + the target
// locale, resolves 'bereich.feld' keys with {placeholder} interpolation.
// See CLAUDE.md → Harte Regeln: "UI-Strings nur in i18n/{de,en}.json".

const FALLBACK = 'de';
const SUPPORTED = ['de', 'en'];

let _locale = FALLBACK;
let _messages = {};
let _fallback = null;

async function _load(locale) {
  const r = await fetch(`/js/i18n/${locale}.json`);
  if (!r.ok) throw new Error(`locale ${locale} unavailable (${r.status})`);
  return r.json();
}

export async function configureI18n(locale) {
  if (!SUPPORTED.includes(locale)) locale = FALLBACK;
  if (!_fallback) _fallback = await _load(FALLBACK);
  _locale = locale;
  _messages = locale === FALLBACK ? _fallback : await _load(locale).catch(() => _fallback);
}

export function getLocale() {
  return _locale;
}

function _lookup(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Resolve a key (target locale → fallback → key itself), interpolate params.
export function t(key, params = {}) {
  let str = _lookup(_messages, key);
  if (str == null) str = _lookup(_fallback, key);
  if (str == null) return key;
  return String(str).replace(/\{(\w+)\}/g, (_, p) => (p in params ? params[p] : `{${p}}`));
}
