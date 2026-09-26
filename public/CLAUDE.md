# Frontend-Regeln (`public/`)

Gilt zusätzlich zur Root-[CLAUDE.md](../CLAUDE.md); CSS-Regeln in
[css/CLAUDE.md](css/CLAUDE.md). Pattern-Katalog: [DESIGN.md](../DESIGN.md).

- **Self-hosted, alles.** Der Browser lädt nur aus dem eigenen Origin:
  Drittcode ist eine committete, versionierte Datei in [vendor/](vendor/) mit
  ihrer Lizenz in `vendor/LICENSES/` (geändert nur via `npm run vendor:sync`),
  Fonts in [fonts/](fonts/), Icons in [icons.svg](icons.svg). Kein CDN, kein
  `<script src="https://…">`, keine Google Fonts. Die CSP bleibt `'self'`.
  **Warum:** der Deploy liefert genau die geprüften Bytes aus, die App
  funktioniert in einem geschlossenen Netz, und kein Dritter sieht unsere
  Nutzer. Gegated: `tests/unit/vendor-integrity.test.mjs`.
- **Vendor-Libs laden je nach Grösse:** Alpine + Plugins beim Boot
  ([js/app/alpine-plugins.js](js/app/alpine-plugins.js), App **und** Harness),
  Chart.js/SortableJS erst bei Bedarf über [js/lazy-libs.js](js/lazy-libs.js)
  — nie als `<script>` in index.html. Eine Lib-Instanz kommt nie in den
  Alpine-State. Inventar + Regeln: DESIGN.md → "Vendor-Libs", "Alpine-Plugins".
- **Features haben eine feste Anatomie** (DESIGN.md → "Feature-Anatomie",
  gegated durch `feature-registry.test`) und werden **generiert**:
  `npm run feature:new -- <id>`. Registry-Eintrag in
  [js/app/features.js](js/app/features.js) `{ id, icon, labelKey, card, partial }`
  → Nav, Host, Hash-Route, Smoke. Feature-Karte `js/cards/<id>-card.js` mit
  `setupCardLifecycle` ([js/cards/card-lifecycle.js](js/cards/card-lifecycle.js)),
  Fachmodul `js/<id>/`, Partial `partials/<id>.html` mit der Karte als Wurzel,
  geladen beim ersten Öffnen ([js/app/feature-host.js](js/app/feature-host.js)).
- **Karten-Inventar ist SSoT:** jedes `Alpine.data` ist in
  [js/app/register-cards.js](js/app/register-cards.js) registriert — eine Karte,
  die dort fehlt, rendert stillschweigend nichts. Eine Karte in einem
  bestehenden Feature: `/karte`.
- **Die Root ist die Shell** (Session, Navigation, Routing —
  [js/app/app-state.js](js/app/app-state.js)); Feature-Daten leben in der
  Feature-Karte. Features nur via `openFeature(id, sub)` wechseln. Root-Zugriff
  aus einer Karte: `$app.x` in Templates, `window.__app.x` in JS (`$root` ist die
  Karte selbst).
- **State vorab deklariert:** Karten-State als Initialfelder — inklusive jedes
  Felds, das ein Fachmodul zuweist (`this` = die Karte). Kein lazy `this._x`.
- **`x-html` nur mit vorab-escaptem Content** (`escHtml()` aus
  [js/utils.js](js/utils.js)), kein Runtime-Sanitizer. Referenz: `bodyHtml` in
  note-item-card.js; gegated durch die Harness-Spec `tests/e2e/notes-card.spec.js`.
- **Combobox statt `<select>`** — jede Auswahl aus einer Werteliste nutzt
  `Alpine.data('combobox')` ([js/components/combobox.js](js/components/combobox.js)):
  leeres Wrapper-Div mit `x-data="combobox(…)" x-modelable="value" x-model="…"`,
  Optionen via `x-effect="options = …"`. Natives `<select>` nur mit Begründung
  im Markup-Kommentar. Details: DESIGN.md → "Combobox".
- **Strings nur via `t('area.field')`** — inklusive `aria-label`, `data-tip`,
  Placeholder. Neuer Key → `js/i18n/de.json` **und** `en.json`.
- **API-Aufrufe via `api()`** ([js/utils.js](js/utils.js)): JSON rein/raus, wirft
  bei Nicht-2xx, und ein 401 feuert `session-expired` → die Root zeigt das
  Session-Banner (kein Auto-Redirect: ungespeicherte Eingaben lassen sich
  retten). 401 nicht pro Feature behandeln.
- **Datum** nur via `formatDate`/`tzOpts()` (App-Zeitzone), nie nacktes
  `toLocaleString()`.
- **Neue UI ⇒ `npm run test:smoke`** — die einzige Schicht, die verschluckte
  Alpine-Template-Fehler sieht ([docs/testing.md](../docs/testing.md)).
