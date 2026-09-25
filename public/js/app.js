// Frontend entry point. No build step: Alpine is imported as an ESM module
// (committed under public/vendor/), so we control start order — i18n first,
// then all components (js/app/register-cards.js), then Alpine.start().
//
// The root scope is the SHELL: session, navigation, routing. Each feature is a
// card of its own (js/cards/<id>-card.js) whose partial is loaded on first
// open (js/app/feature-host.js). Anatomy: DESIGN.md → "Feature anatomy".

import Alpine from '/vendor/alpine-3.15.12.esm.min.js';
import { initialState } from '/js/app/app-state.js';
import { FEATURES, DEFAULT_FEATURE, findFeature } from '/js/app/features.js';
import { ensurePartial } from '/js/app/feature-host.js';
import { setupRouting, hashFor } from '/js/app/router.js';
import { registerCards } from '/js/app/register-cards.js';
import { EVT } from '/js/events.js';
import { configureI18n, t } from '/js/i18n.js';
import { api, setTimezone, formatDate } from '/js/utils.js';

function appRoot() {
  return {
    ...initialState(),
    features: FEATURES,
    t,
    fmt: formatDate,

    async init() {
      window.__app = this; // for cards' JS ($app in templates)
      // Global 401 handler — banner instead of redirect, so unsaved input can
      // be rescued (public/CLAUDE.md → api()).
      window.addEventListener(EVT.SESSION_EXPIRED, () => { this.sessionExpired = true; });
      try {
        const cfg = await api('/api/config');
        setTimezone(cfg.timezone);
        this.user = await api('/api/me');
      } catch (e) {
        console.error('[app] init failed', e);
      } finally {
        this.ready = true;
      }
      // Hosts are rendered by x-for — wait one tick, then route (#hash or default).
      await this.$nextTick();
      setupRouting(this, { isKnown: (id) => !!findFeature(id), fallback: DEFAULT_FEATURE });
    },

    // The ONE way to switch features (nav click, hash, code). Exclusive: one
    // feature visible at a time. Re-click on the active one = refresh.
    async openFeature(id, sub = '', { fromHash = false } = {}) {
      const feature = findFeature(id);
      if (!feature) return;
      if (!fromHash && id === this.activeFeature && sub === this.featureSub) {
        window.dispatchEvent(new CustomEvent(EVT.CARD_REFRESH, { detail: { id } }));
        return;
      }
      try {
        await ensurePartial(feature);
      } catch (e) {
        console.error(`[app] feature ${id} failed to load`, e);
        return;
      }
      this.activeFeature = id;
      this.featureSub = sub;
      const hash = hashFor(id, sub);
      if (location.hash !== hash) history.replaceState(null, '', hash);
    },
  };
}

async function boot() {
  // i18n BEFORE Alpine starts: the first render already has translated strings.
  await configureI18n('de');
  registerCards(Alpine);
  Alpine.data('app', appRoot);
  window.Alpine = Alpine;
  Alpine.start();
}

boot();
