// Shared loader for feature harnesses (tests/fixtures/<id>-harness.html).
// Mounts ONE feature exactly the way the app does — the real card inventory
// (register-cards.js), the real lazy partial loader (feature-host.js), the real
// i18n — under a minimal stub root instead of the app shell. The feature's API
// calls hit the mocks of tests/server.js.
//
//   <main x-data="harnessRoot"><section data-feature="notes"></section></main>
//   <script type="module">
//     import { mountFeature } from '/tests/fixtures/_harness.js';
//     mountFeature('notes');
//   </script>
//
// window.__harnessReady turns true once Alpine has started.

import Alpine from '/vendor/alpine-3.15.12.esm.min.js';
import { configureI18n, t } from '/js/i18n.js';
import { formatDate } from '/js/utils.js';
import { findFeature } from '/js/app/features.js';
import { ensurePartial } from '/js/app/feature-host.js';
import { registerCards } from '/js/app/register-cards.js';

export async function mountFeature(id, rootOverrides = {}) {
  const feature = findFeature(id);
  if (!feature) throw new Error(`harness: unknown feature ${id}`);
  await configureI18n('de');
  await ensurePartial(feature);

  // Stub root: the shell fields cards may read via $app / window.__app.
  Alpine.data('harnessRoot', () => ({
    t,
    fmt: formatDate,
    ready: true,
    sessionExpired: false,
    user: { email: 'harness@local' },
    activeFeature: id,
    featureSub: '',
    openFeature() {},
    init() { window.__app = this; },
    ...rootOverrides,
  }));
  registerCards(Alpine);
  window.Alpine = Alpine;
  Alpine.start();
  window.__harnessReady = true;
}
