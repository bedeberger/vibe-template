// Shared lifecycle for feature cards (pattern from schreibwerkstatt). Every
// feature card needs the same wiring — load when its feature is opened, reload
// on a re-click of the active nav item (card:refresh), drop local state on
// view:reset, clear its timers, remove its listeners on destroy. Hand-wiring
// that per card drifts: one forgets the refresh, another leaks a listener.
//
//   import { setupCardLifecycle } from './card-lifecycle.js';
//
//   _lifecycle: null,                       // declared up front (state rule)
//   init() {
//     this._lifecycle = setupCardLifecycle(this, {
//       feature: 'notes',                   // registry id
//       load: (ctx) => ctx.loadNotebooks(), // on open (first + every re-open) and on refresh
//       resetState: () => ({ notes: [] }),  // factory (fresh arrays), applied on view:reset
//       timerKeys: ['_pollTimer'],          // intervals/timeouts cleared on reset/destroy
//     });
//   },
//   destroy() { this._lifecycle.destroy(); },
//
// Optional cfg: onRefresh(ctx) (instead of load on card:refresh),
// reloadOnReopen (default true — false: load only the first time),
// extraListeners [{ type, handler }] (auto-removed).
// Returns { signal, destroy } — attach own window listeners with { signal }.

import { EVT } from '../events.js';

export function setupCardLifecycle(ctx, cfg) {
  const abort = new AbortController();
  const { signal } = abort;
  const root = () => window.__app;
  let loadedOnce = false;

  const clearTimers = () => {
    for (const k of cfg.timerKeys || []) {
      if (ctx[k]) { clearInterval(ctx[k]); clearTimeout(ctx[k]); ctx[k] = null; }
    }
  };
  const applyReset = () => {
    const state = typeof cfg.resetState === 'function' ? cfg.resetState() : cfg.resetState;
    if (state) Object.assign(ctx, state);
  };
  const load = async () => {
    if (!cfg.load) return;
    if (loadedOnce && cfg.reloadOnReopen === false) return;
    loadedOnce = true;
    await cfg.load(ctx, root());
  };

  // Open → load. The card is mounted lazily on FIRST open, so the feature is
  // usually already active at init: load right away in that case.
  ctx.$watch(() => root()?.activeFeature, (id) => { if (id === cfg.feature) load(); });
  if (root()?.activeFeature === cfg.feature) load();

  window.addEventListener(EVT.VIEW_RESET, () => { clearTimers(); applyReset(); loadedOnce = false; }, { signal });
  window.addEventListener(EVT.CARD_REFRESH, (e) => {
    if (e.detail?.id !== cfg.feature) return;
    if (cfg.onRefresh) cfg.onRefresh(ctx, root());
    else if (cfg.load) cfg.load(ctx, root());
  }, { signal });
  for (const { type, handler } of cfg.extraListeners || []) window.addEventListener(type, handler, { signal });

  return {
    signal,
    destroy() { clearTimers(); abort.abort(); },
  };
}
