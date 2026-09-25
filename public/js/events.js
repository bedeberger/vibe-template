// Window event names — SSoT, so dispatcher and listener can't drift apart on a
// string. Root dispatches, cards listen (via setupCardLifecycle, with the
// lifecycle's AbortSignal, so a destroyed card never keeps a listener).

export const EVT = {
  // A 401 from api() — the root shows the session banner (no auto-redirect).
  SESSION_EXPIRED: 'session-expired',
  // The root resets the whole view (e.g. after logout/user switch) — cards
  // drop their local state.
  VIEW_RESET: 'view:reset',
  // Re-click on the ACTIVE nav item: detail { id } — that feature reloads.
  CARD_REFRESH: 'card:refresh',
};
