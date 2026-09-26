// Alpine plugins — the ONE place they are registered. Called before
// Alpine.start() by js/app.js AND tests/fixtures/_harness.js, so a harness
// renders the same directives as the app. ESM builds from public/vendor/
// (scripts/vendor-sync.js); no lazy loading possible: a directive met before
// its plugin is registered only logs a warning.
//
// Inventory + rules per directive: DESIGN.md → "Alpine-Plugins". A new plugin
// is justified there first, then vendored and registered here.

import anchor from '/vendor/alpine-anchor-3.15.12.esm.min.js';
import focus from '/vendor/alpine-focus-3.15.12.esm.min.js';
import collapse from '/vendor/alpine-collapse-3.15.12.esm.min.js';
import resize from '/vendor/alpine-resize-3.15.12.esm.min.js';

export function registerPlugins(Alpine) {
  Alpine.plugin(anchor);   // x-anchor — popover pinned to its trigger
  Alpine.plugin(focus);    // x-trap, $focus — overlays that are not a <dialog>
  Alpine.plugin(collapse); // x-collapse — animated height of a collapsible panel
  Alpine.plugin(resize);   // x-resize — ResizeObserver as a directive
}
