// Settings — the FEATURE CARD of the admin view (x-data="settingsCard" at the
// root of partials/settings.html). Owns the tab state, the server values and
// the draft; methods come from the domain module js/settings/settings-methods.js;
// lifecycle (load on open, refresh on re-click, reset) from card-lifecycle.js.

import { t } from '../i18n.js';
import { settingsMethods } from '../settings/settings-methods.js';
import { setupCardLifecycle } from './card-lifecycle.js';

export function settingsCard() {
  return {
    // state (declared up front)
    tab: 'general',
    tabs: [],
    meta: {},
    saved: {},
    draft: {},
    env: { oidcClientSecret: false },
    timezones: [],
    loading: false,
    loadError: '',
    busy: false,
    error: '',
    errorField: null,
    savedMsg: false,
    _lifecycle: null,

    t,

    init() {
      this._lifecycle = setupCardLifecycle(this, {
        feature: 'settings',
        load: (ctx) => ctx.loadSettings(),
        resetState: () => ({ tab: 'general', draft: {}, saved: {}, error: '', errorField: null, savedMsg: false }),
      });
    },
    destroy() { this._lifecycle?.destroy(); },

    ...settingsMethods,
  };
}

export function registerSettingsCard(Alpine) {
  Alpine.data('settingsCard', settingsCard);
}
