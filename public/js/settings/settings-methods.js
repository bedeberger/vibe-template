// Settings — domain module of the admin feature "settings" (CLAUDE.md ".env nur
// minimal"): the runtime configuration from lib/app-settings.js, grouped in
// tabs. Methods spread into the feature card (js/cards/settings-card.js); `this`
// is the card, so every field assigned here is declared in the card's initial
// state. Pure helpers are plain exports (unit-testable without Alpine).

import { api, setTimezone } from '../utils.js';

// Server refusal "<key>: <reason>" (lib/app-settings.js) → i18n key.
const REASON_KEYS = {
  'out of range': 'settings.err.range',
  'unknown value': 'settings.err.value',
  'unknown timezone': 'settings.err.timezone',
  'invalid url': 'settings.err.url',
  'required for oidc': 'settings.err.oidcRequired',
};

export function parseError(message) {
  const m = /^([a-z_.]+): (.+)$/.exec(message || '');
  return { key: m ? m[1] : null, i18n: (m && REASON_KEYS[m[2]]) || 'settings.err.generic' };
}

// Pure: { key: value } of everything the server sent.
export function toValues(settings) {
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

// Pure: only the keys whose draft differs from the saved value (as strings —
// a number input hands back "30" for 30).
export function diffValues(draft, saved) {
  return Object.fromEntries(Object.entries(draft).filter(([k, v]) => String(v) !== String(saved[k])));
}

// Pure: the IANA zones the browser knows, with the current value guaranteed in
// the list (UTC is missing from supportedValuesOf in some engines).
export function timezoneOptions(current) {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const all = current && !zones.includes(current) ? [current, ...zones] : zones;
  return all.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
}

export const settingsMethods = {
  async loadSettings() {
    this.loading = true;
    this.loadError = '';
    try {
      this.applyView(await api('/api/admin/settings'));
    } catch (e) {
      this.loadError = this.t(parseError(e.message).i18n);
    } finally {
      this.loading = false;
    }
  },

  applyView(view) {
    this.tabs = view.tabs;
    this.meta = Object.fromEntries(view.settings.map((s) => [s.key, s]));
    this.saved = toValues(view.settings);
    this.draft = { ...this.saved };
    this.env = view.env;
    this.timezones = timezoneOptions(this.saved['app.timezone']);
  },

  isDirty() {
    return Object.keys(diffValues(this.draft, this.saved)).length > 0;
  },

  discard() {
    this.draft = { ...this.saved };
    this.error = '';
    this.errorField = null;
    this.savedMsg = false;
  },

  async save() {
    const patch = diffValues(this.draft, this.saved);
    if (!Object.keys(patch).length) return;
    this.busy = true;
    this.error = '';
    this.errorField = null;
    this.savedMsg = false;
    try {
      this.applyView(await api('/api/admin/settings', { method: 'PATCH', body: patch }));
      // Date display follows the new zone at once — no reload.
      if ('app.timezone' in patch) setTimezone(this.saved['app.timezone']);
      this.savedMsg = true;
    } catch (e) {
      const { key, i18n } = parseError(e.message);
      this.errorField = key;
      this.error = this.t(i18n);
      // Show the offending field: switch to its tab.
      if (key && this.meta[key]) this.tab = this.meta[key].tab;
    } finally {
      this.busy = false;
    }
  },
};
