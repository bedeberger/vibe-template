// __LABEL_EN__ — the FEATURE CARD (x-data="__CARD__" at the root of
// partials/__ID__.html). Owns the feature's state; methods come from the domain
// module js/__ID__/__ID__-methods.js; lifecycle (load on open, refresh on
// re-click, reset) from card-lifecycle.js. Anatomy: DESIGN.md → Feature anatomy.

import { t } from '../i18n.js';
import { __CAMEL__Methods } from '../__ID__/__ID__-methods.js';
import { setupCardLifecycle } from './card-lifecycle.js';

export function __CARD__() {
  return {
    // state (declared up front)
    items: [],
    loading: false,
    _lifecycle: null,

    t,

    init() {
      this._lifecycle = setupCardLifecycle(this, {
        feature: '__ID__',
        load: (ctx) => ctx.load__PASCAL__(),
        resetState: () => ({ items: [] }),
      });
    },
    destroy() { this._lifecycle?.destroy(); },

    ...__CAMEL__Methods,
  };
}

export function register__PASCAL__Card(Alpine) {
  Alpine.data('__CARD__', __CARD__);
}
