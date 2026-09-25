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
- **Feature registry is SSoT** ([js/app/features.js](js/app/features.js)):
  `{ id, icon, labelKey, view }` → the nav renders it, the smoke test opens it.
  No hand-written nav entry. The view is `<section data-partial="<view>-view">`
  in [index.html](index.html) + [partials/<view>-view.html](partials/).
- **Partials** are injected before `Alpine.start()` ([js/app.js](js/app.js)
  `loadPartials`) — they run in the root scope. **Cards** are `Alpine.data`
  sub-components in [js/cards/](js/cards/) (reference
  [note-card.js](js/cards/note-card.js)), registered in `js/app.js`.
- **State declared up front:** root state in [js/app/app-state.js](js/app/app-state.js),
  card state as initial fields. No lazy `this._x` that first appears in a method.
- **`x-html` only with pre-escaped content** (`escHtml()` from
  [js/utils.js](js/utils.js)), no runtime sanitizer. Reference: `bodyHtml` in
  note-card.js; gated by the harness spec `tests/e2e/notes-card.spec.js`.
- **Strings only via `t('area.field')`** — including `aria-label`, `data-tip`,
  placeholders. New key → `js/i18n/de.json` **and** `en.json`.
- **API calls via `api()`** ([js/utils.js](js/utils.js)): JSON in/out, throws on
  non-2xx, and a 401 dispatches `session-expired` → the root shows the session
  banner (no auto-redirect: unsaved input can be rescued). Don't handle 401 per feature.
- **Dates** only via `formatDate`/`tzOpts()` (app timezone), never bare
  `toLocaleString()`.
- **New UI ⇒ `npm run test:smoke`** — the only layer that sees swallowed Alpine
  template errors ([docs/testing.md](../docs/testing.md)).
