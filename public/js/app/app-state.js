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
    toast: null,           // { kind: 'ok' | 'err', text } — js/app/toast.js, DESIGN.md → "Job-Toast"
    _toastTimer: null,     // fades an 'ok' toast
    // navigation
    view: 'user',          // 'user' | 'admin' — follows the active feature's registry view
    activeFeature: DEFAULT_FEATURE,
    featureSub: '',        // optional 2nd hash segment (#<id>/<sub>) — the feature validates it
    // shell chrome (js/app/shell.js)
    isNarrow: false,        // below the 960px desktop breakpoint → sidebar is a drawer
    drawerOpen: false,      // phone: off-canvas sidebar open
    sidebarCollapsed: false, // desktop: icon rail (per device, localStorage)
    userMenuOpen: false,
    theme: 'system',        // 'system' | 'light' | 'dark' (per device, js/theme-boot.js)
    // command palette (⌘K)
    paletteOpen: false,
    paletteQuery: '',
    paletteIndex: 0,
  };
}
