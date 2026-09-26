// Root-scope state, declared up front in slices (no lazy this._x).
// See CLAUDE.md → Harte Regeln: "State explizit deklariert".
//
// The root owns ONLY shell concerns: session, navigation, routing. Feature
// data (notes, …) lives in the feature's card (js/cards/<id>-card.js) — the
// root never knows a feature's fields.

import { DEFAULT_FEATURE } from './features.js';

export function initialState() {
  return {
    // shell
    ready: false,          // gates the UI until i18n + config + user are in
    sessionExpired: false, // set by the global 401 handler
    user: null,
    // navigation
    view: 'user',          // 'user' | 'admin' — follows the active feature's registry view
    activeFeature: DEFAULT_FEATURE,
    featureSub: '',        // optional 2nd hash segment (#<id>/<sub>) — the feature validates it
  };
}
