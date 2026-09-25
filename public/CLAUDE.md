# Frontend rules (`public/`)

Applies in addition to the root [CLAUDE.md](../CLAUDE.md); CSS rules in
[css/CLAUDE.md](css/CLAUDE.md). Pattern catalog: [DESIGN.md](../DESIGN.md).

- **Self-hosted, everything.** The browser loads only from our own origin:
  third-party code is a committed, versioned file in [vendor/](vendor/) with its
  licence in `vendor/LICENSES/` (changed only via `npm run vendor:sync`), fonts
  in [fonts/](fonts/), icons in [icons.svg](icons.svg). No CDN, no
  `<script src="https://…">`, no Google Fonts. The CSP stays `'self'`. **Why:**
  the deploy ships exactly the reviewed bytes, the app works in a closed
  network, and no third party sees our users. Gated:
  `tests/unit/vendor-integrity.test.mjs`.
- **Features have a fixed anatomy** (DESIGN.md → "Feature anatomy", gated by
  `feature-registry.test`) and are **generated**: `npm run feature:new -- <id>`.
  Registry entry in [js/app/features.js](js/app/features.js)
  `{ id, icon, labelKey, card, partial }` → nav, host, hash route, smoke. Feature
  card `js/cards/<id>-card.js` with `setupCardLifecycle`
  ([js/cards/card-lifecycle.js](js/cards/card-lifecycle.js)), domain module
  `js/<id>/`, partial `partials/<id>.html` rooted in the card, loaded on first
  open ([js/app/feature-host.js](js/app/feature-host.js)).
- **Card inventory is SSoT:** every `Alpine.data` is registered in
  [js/app/register-cards.js](js/app/register-cards.js) — a card missing there
  renders silently nothing. A card inside an existing feature: `/karte`.
- **The root is the shell** (session, navigation, routing —
  [js/app/app-state.js](js/app/app-state.js)); feature data lives in the feature
  card. Switch features only via `openFeature(id, sub)`. Root access from a card:
  `$app.x` in templates, `window.__app.x` in JS (`$root` is the card itself).
- **State declared up front:** card state as initial fields — including every
  field a domain module assigns (`this` = the card). No lazy `this._x`.
- **`x-html` only with pre-escaped content** (`escHtml()` from
  [js/utils.js](js/utils.js)), no runtime sanitizer. Reference: `bodyHtml` in
  note-item-card.js; gated by the harness spec `tests/e2e/notes-card.spec.js`.
- **Strings only via `t('area.field')`** — including `aria-label`, `data-tip`,
  placeholders. New key → `js/i18n/de.json` **and** `en.json`.
- **API calls via `api()`** ([js/utils.js](js/utils.js)): JSON in/out, throws on
  non-2xx, and a 401 dispatches `session-expired` → the root shows the session
  banner (no auto-redirect: unsaved input can be rescued). Don't handle 401 per feature.
- **Dates** only via `formatDate`/`tzOpts()` (app timezone), never bare
  `toLocaleString()`.
- **New UI ⇒ `npm run test:smoke`** — the only layer that sees swallowed Alpine
  template errors ([docs/testing.md](../docs/testing.md)).
