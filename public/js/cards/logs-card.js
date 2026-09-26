// Logs — the FEATURE CARD of the admin view (x-data="logsCard" at the root of
// partials/logs.html). Owns the list, the filter and the live-tail stream;
// methods come from the domain module js/logs/logs-methods.js; lifecycle
// (load on open, refresh on re-click, reset) from card-lifecycle.js. The
// stream is closed whenever the feature is left, so an idle admin tab in
// another view holds no server connection.

import { t } from '../i18n.js';
import { EVT } from '../events.js';
import { logsMethods, emptyFilter, LEVELS } from '../logs/logs-methods.js';
import { setupCardLifecycle } from './card-lifecycle.js';

export function logsCard() {
  return {
    // state (declared up front)
    entries: [],
    files: [],
    loading: false,
    loadError: '',
    hasMore: false,
    filter: emptyFilter(),
    appliedFilter: emptyFilter(),
    live: true,
    streamError: false,
    rotated: false,
    expanded: {},
    levels: LEVELS,
    _es: null,
    _seq: 0,
    _lifecycle: null,

    t,

    init() {
      this._lifecycle = setupCardLifecycle(this, {
        feature: 'logs',
        load: (ctx) => ctx.loadLogs(),
        resetState: () => ({ entries: [], files: [], filter: emptyFilter(), appliedFilter: emptyFilter(), expanded: {}, rotated: false }),
        extraListeners: [{ type: EVT.VIEW_RESET, handler: () => this.stopStream() }],
      });
      this.$watch(() => window.__app?.activeFeature, () => this.syncStream());
    },
    destroy() {
      this.stopStream();
      this._lifecycle?.destroy();
    },

    ...logsMethods,
  };
}

export function registerLogsCard(Alpine) {
  Alpine.data('logsCard', logsCard);
}
