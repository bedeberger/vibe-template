# DESIGN.md — UI-Musterkatalog

Die eine Referenz für UI-Muster. **Vor jeder neuen Komponente hier
nachsehen.** Ein bestehendes Muster wiederverwenden; fehlt es, zuerst hier
dokumentieren (Abschnitt nach der Vorlage unten), dann bauen. Siehe
CLAUDE.md → Harte Regeln: "DESIGN.md-Pattern-Katalog vor neuer UI prüfen".

Das Design-System ist **Papier/Tinte, editorial**: warmer Papier-Schreibtisch,
weisse Karten mit schmalem Akzentband, tintenschwarzer Text, Inter für die UI,
Source Serif 4 für Titel und Lesetext, eckige Badges, Haarlinien-Rahmen, kaum
Schatten. Aufgeführt sind nur Muster, deren CSS in `public/css/` ausgeliefert
wird.

## Inhalt

- [Doku-Vorlage](#doku-vorlage-pflicht-für-neue-abschnitte) ·
  [Token-Pflicht](#token-pflicht-keine-ad-hoc-werte) ·
  [Cascade-Layer](#cascade-layer) ·
  [Dark Mode](#dark-mode) · [Mobile-Breakpoints](#mobile-breakpoints) ·
  [Bewegung](#bewegung) · [Z-Index-Stapel](#z-index-stapel)
- [App-Shell](#app-shell) · [Zeile / Listenkopf / Tabellen-Scroll](#zeile--listenkopf--tabellen-scroll)
- [Karte](#karte-card) · [Karten-Innenraum](#karten-innenraum) · [Überschriften-Hierarchie](#überschriften-hierarchie)
- [Buttons](#buttons) · [Badges](#badges) · [Aktions-Icon-Bibliothek](#aktions-icon-bibliothek-verbindlich) · [Icon-System](#icon-system-lucide-sprite) ·
  [Icon-Button](#icon-button-icon-btn) · [Schliessen-Button](#schliessen-button) ·
  [Tooltip](#tooltip-data-tip)
- [Formulare](#formulare) · [Combobox](#combobox-auswahlfeld) · [Schalter (Toggle)](#schalter-toggle) · [Tabs](#tabs--modus-umschalter)
- [Status / Laden / Leer / Fehler](#status--laden--leer--fehler) ·
  [Bestätigungsdialog](#bestätigungsdialog-modal) · [Gefahrenzone](#gefahrenzone) ·
  [Job-Toast](#job-toast) · [Sitzungs-Banner](#sitzungs-banner)
- [Feature-Anatomie](#feature-anatomie) · [Entity-Karte (Notizen)](#entity-karte-notizen) · [Benennung](#benennung) ·
  [CSS-Inventar](#css-inventar)

---

## Doku-Vorlage (Pflicht für neue Abschnitte)

Jeder Muster-Abschnitt folgt dieser Reihenfolge — sonst sind ähnliche
Abschnitte nicht auf einen Blick vergleichbar.

```markdown
## <Mustername>

**Einsatz:** Ein Satz: was es ist und wann es gilt.

**Markup:** (optional, wenn nicht trivial)
\`\`\`html
<div class="…">…</div>
\`\`\`

**Klassen** [css/path.css](public/css/path.css):
- `.foo` — Zweck
- `.foo--variant` — Zweck des Modifiers

**Regeln:** (optional — Anti-Patterns, harte Vorgaben)

**Beispiele:** [partial.html](public/partials/partial.html)
```

Die Reihenfolge ist fest: **Einsatz → Markup → Klassen → Regeln → Beispiele**.
Ein Abschnitt ohne `**Einsatz:**`-Zeile hat im Katalog nichts verloren.

---

## Token-Pflicht (keine Ad-hoc-Werte)

Alle visuellen Werte sind Custom Properties in [public/css/tokens/](public/css/tokens/),
importiert von der Facade [public/css/tokens.css](public/css/tokens.css) (der
einzige Token-`<link>`). Komponenten konsumieren Tokens; rohes Hex/RGB für
themenabhängige Werte ist verboten. Ein Rohwert ist nur zulässig, wenn kein
Token passt — und ein zum zweiten Mal verwendeter Wert wird zum Token. Neuer
Token → das passende Modul; kein zusätzlicher `<link>` nötig.

| Bereich | Tokens (Modul) | Einsatz |
|---|---|---|
| **Textfarben** | `--color-text`, `--color-muted`, `--color-subtle`, `--color-faint`, `--color-text-inverse` (colors) | Fliesstext / sekundär / tertiär (AA) / nur dekorativ (nie lesbarer Text) / auf dunklen Flächen. |
| **Flächen** | `--color-bg` (Papier-Schreibtisch), `--color-surface` (Karten), `--color-card-bg`, `--color-neutral-bg`, `--color-tooltip-bg` | |
| **Linien + Tönungen** | `--color-border`, `--color-border-input`, `--color-border-focus`, `--color-hover`, `--color-hover-light`, `--color-hover-strong`, `--color-tag-bg`, `--icon-ghost-fill(-hover)` | Rahmen sind Alpha auf dem Grund und funktionieren darum auf jeder Fläche. |
| **Marke** | `--color-primary(-hover/-light)`, `--color-on-primary`, `--color-accent` (+ `-bg/-text/-hover/-soft`), `--color-on-accent`, `--color-running` | Primary = Markenblau (CTA, aktiver Zustand). Accent = Federgold (Auswahl, Hervorhebungen). |
| **Status** | `--color-ok-{bg,text,border}`, `--color-warn-{bg,text}`, `--color-err-{bg,text,border,light,hover}`, `--color-pending`, `--color-success(-hover)` | Nur für Betriebsstatus (Banner, Validierung, Jobs). Nie ein Karten-Akzent. |
| **Karten-Akzent** | `--card-accent-<key>-base` → `--card-accent-<key>` → `.card--<key>` | Siehe [Karte](#karte-card). |
| **Schatten** | `--shadow-sm` (Blatt-Anhebung), `--shadow-md` (Popover, Tooltip, Toast), `--shadow-lg` (Modal), `--shadow-inset-top` (motion) | Karten sind flach — kein Schatten. |
| **Abstände** | `--space-xs` 4 · `--space-sm` 8 · `--space-md` 12 · `--space-lg` 16 · `--space-xl` 24 · `--space-2xl` 32, dazu `--space-1/2xs/3/5/6/10/14/18/20` (spacing); `--space-page-end` 56 (unteres Body-Padding) | 4px-Raster; Zwischenstufen nur für dichte Zeilen. Rohe rem/px in margin/padding/gap sperrt `spacing-scale.test.mjs`. |
| **Karten-Rhythmus** | `--card-gap-section` (16), `--card-gap-tight` (8) | Die einzigen zwei Abstände in einem Karten-Body — siehe [Karten-Innenraum](#karten-innenraum). |
| **Padding** | `--pad-btn-compact`, `--pad-badge`, `--pad-detail` | Wiederkehrende Zellgrössen. |
| **Rahmenbreite** | `--border-thin` (0.5px), `--border-thick` (2px) | Nur die Abweichungen sind Tokens; der 1px-Standard bleibt literal (`1px solid var(--color-border)`). |
| **Radius** | `--radius-sm` 0 (Badges, Tags) · `--radius-md` 3px (Inputs, Buttons) · `--radius-lg` 6px (Karten) · `--radius-xl` 10px (Modal) | Leitmotiv: editorial-eckig. |
| **Schrift** | `--font-sans` (Inter, UI), `--font-serif` (Source Serif 4, Titel + Lesetext), `--font-mono` (typography) | |
| **Schriftgrösse** | `--font-size-micro` 10 · `xs` 11 · `mini` 12 · `sm` 13 · `base` 14 · `md` 15 · `reading` 16 · `lg` 18 · `xl` 22 · `2xl` 26 · `3xl` 30; `--font-em-80/85/90` | xs–md = UI; lg = Kartentitel; 2xl/3xl = Seiten-/Site-Titel. |
| **Gewicht / Zeilenhöhe** | `--fw-regular/medium/semibold/bold`; `--lh-tight` 1.2 · `--lh-base` 1.45 · `--lh-relaxed` 1.6 | |
| **Bedienelemente** | `--size-default-padding-y`, `--size-compact-font-size`, `--size-compact-padding`, `--icon-size-action` | Gleiche Höhe für Bedienelemente in einer Zeile. |
| **Bewegung** | `--transition-fast/base/slow/emphasized`, `--ease-out` (motion) | Siehe [Bewegung](#bewegung). |
| **Deckkraft** | `--opacity-disabled` 0.6 · `muted` 0.5 · `hint` 0.4 · `faint` 0.35 · `strong` 0.75 | |
| **Z-Index** | `--z-*` (scale) | Siehe [Z-Index-Stapel](#z-index-stapel). |

**Fokusring:** keine globale `:focus-visible`-Regel — die Standard-Outline des
Browsers bleibt. Komponenten mit eigenem Fokussignal (Rahmenfarbe, Tönung)
setzen `outline: none` ohne `!important`; listenartige Bedienelemente
(`.nav-item`, `.tabs-btn`) definieren eine explizite `:focus-visible`-Outline.

---

## Cascade-Layer

`@layer base, components, utilities;` wird **einmal** deklariert, in
[tokens.css](public/css/tokens.css) — utilities schlägt components schlägt base
bei gleicher Spezifität. Tokens und `@font-face` bleiben **ohne Layer** (Custom
Properties sind global und konkurrieren nicht in der Cascade).

**Jede andere CSS-Datei legt ihre Regeln in einen Layer** — eine Regel ohne
Layer schlägt jede Regel mit Layer, unabhängig von der Spezifität, und der Bug
zeigt sich erst, wenn ein gezielter Override still versagt. `layout/base.css`
schreibt `base`; alles andere schreibt `components` (dazu `utilities` in
`layout/utilities.css`). Innerhalb eines Layers entscheidet die Link-Reihenfolge
in [index.html](public/index.html) — Feature-/Entity-CSS lädt zuletzt und darf
generische Klassen über die Quellreihenfolge überschreiben.

**Selektor pro Datei eindeutig:** denselben Selektor nie zweimal in einer Datei
definieren (der zweite Block verschmilzt still mit dem ersten). Gewollte
Variation nutzt eine Modifier-Klasse oder einen anderen `@media`/`@layer`-Scope.

---

## Dark Mode

**Einsatz:** jede Farbe folgt automatisch dem Theme.

Jeder Farb-Token wird **einmal** mit `light-dark(<light>, <dark>)` in
[tokens/colors.css](public/css/tokens/colors.css) deklariert. `:root { color-scheme: light dark }`
folgt dem Betriebssystem; `<html data-theme="light|dark">` erzwingt ein Theme
(Hook für einen künftigen Umschalter — das Attribut umzuschalten genügt).

**Regeln:**
- Farben, Hintergründe, Rahmen, Schatten nur über Tokens — kein Hex/RGB im
  Komponenten-CSS, keine komponentenweisen `[data-theme]`- oder
  `prefers-color-scheme`-Overrides.
- Neuer Farbton/neue Fläche/neuer Rahmen → ein Token mit beiden Hälften in
  `colors.css`.
- Karten-Akzente: nur der helle `-base`-Farbton wird von Hand gewählt; der
  dunkle Wert wird mit OKLCH Relative Color Syntax abgeleitet
  (`--accent-dark-lift/-chroma/-floor`).
- Checkliste pro neuer Klasse: dunkler Textkontrast ≥ 4.5:1 auf
  `--color-surface`; Rahmen sichtbar; SVG-Icons nutzen `currentColor`.

---

## Mobile-Breakpoints

**Einsatz:** jede neue Komponente liefert ihr mobiles Verhalten im selben
Commit mit, in derselben Datei (kein zentrales `mobile.css`).

Custom Properties funktionieren in `@media` nicht, darum sind die Werte literal
— **nur** aus dieser Leiter wählen:

| Wert | Rolle |
|---|---|
| `480px` | kleines Smartphone — harter Umbruch (`.row` stapelt) |
| `600px` | grosses Smartphone — **Standard-Mobile-Breakpoint** |
| `768px` | Tablet — Formularfelder auf 16px (kein iOS-Fokus-Zoom) |
| `960px` | Desktop — [twocolumn.css](public/css/layout/twocolumn.css) wechselt auf Sidebar + Main |

Dokumentierte Abweichung: `700px` für Kartenköpfe/Aktionsleisten (card-shell,
card-actions), die vor der Tablet-Breite umbrechen müssen.

- `max-width: 959.98px` neben `min-width: 960px` ist Absicht (gebrochene
  Viewport-Breiten beim Zoomen), kein Tippfehler.
- `max-width: N` und `min-width: N` greifen beide bei genau N — ein Paar nutzt
  `N` / `N+1` (oder den `.98`-Trick).
- Touch: `@media (pointer: coarse)` vergrössert Icon-only-Buttons auf ≥ 40px.

---

## Bewegung

**Einsatz:** Einblendungen von Karten, Popovers, Toasts. Drei Mechaniken —
kein neues Bewegungsvokabular.

1. **Karten-Einblendung `cardFadeIn`** ([card-shell.css](public/css/components/card-form/card-shell.css),
   `--transition-emphasized` = 0.3s `--ease-out`, translateY 8px → 0). Kommt
   automatisch mit `.card`. **Nie `x-transition` an eine `.card` hängen** —
   Translate × Scale konkurrieren und es wackelt; neue Karte = nur `x-show` +
   `x-cloak`. Die Animation nutzt `backwards` (nicht `both`), damit kein
   Transform hängen bleibt.
2. **Popover-/Menü-Einblendung über `@starting-style`** — nur Opacity (kein
   Transform, Messungen bleiben korrekt).
3. **Toast** — `jobToastFadeIn` (160ms Einblenden + Gleiten).

**Hover** hat zwei zulässige Mechaniken: (A) Alpha-Tönung (`--color-hover`,
`color-mix`-Tönungen — Buttons, Zeilen, Ghost-Icon-Buttons); (B) Rand-/Füllwechsel
auf einen benachbarten Flächen-Token (umrandeter `.icon-btn`, `.card`-Rahmen
Richtung Akzent).

**Reduzierte Bewegung** ([tokens/motion.css](public/css/tokens/motion.css)): die
Transition-Tokens fallen auf `0s` und alle Animationen werden global sofort —
pro Komponente ist nichts zu tun. Einen Transition-Token nie als
`--x: var(--x)` definieren (ungültig → fällt überall auf 0s zurück).

---

## Z-Index-Stapel

**Einsatz:** jede positionierte Ebene nimmt einen Token aus
[tokens/scale.css](public/css/tokens/scale.css); `position: fixed` ohne Token
ist ein Bug.

| Token | Wert | Einsatz |
|---|---|---|
| `--z-base` | 1 | Anker im Fluss |
| `--z-sticky` | 100 | Sticky-Sidebar, Sticky-Listenköpfe |
| `--z-header` | 200 | Sticky-Karten-/Toolbar-Köpfe |
| `--z-popover` | 1000 | Tooltip, Dropdowns |
| `--z-overlay` | 2000 | nicht-modale Vollbild-Overlays |
| `--z-modal` | 9500 | Backdrop eines Overlays ohne `<dialog>` |
| `--z-banner` | 10000 | Sitzungs-Banner |
| `--z-modal-front` | 11000 | Modal-Panel über Bannern |
| `--z-toast` | 12000 | Toast, Skip-Link |

Ein natives `<dialog>`, geöffnet mit `showModal()`, lebt im Top Layer und
braucht keinen Z-Index. Ein Stapelverstoss wird in der Tabelle behoben, nicht
lokal geflickt.

---

## App-Shell

**Einsatz:** der Rahmen von [index.html](public/index.html): Skip-Link,
Sitzungs-Banner, Kopfzeile, zweispaltiges Layout mit der Feature-Navigation.

**Markup:**
```html
<div class="app-shell" x-data="app" x-cloak>
  <a class="skip-link" href="#main-content" x-text="t('a11y.skipToMain')"></a>
  <header class="site-header-row">
    <div class="site-header-center">
      <h1 class="site-title"><img class="site-logo" src="/icon.svg" alt=""><span x-text="t('app.title')"></span></h1>
      <p class="subtitle" x-text="t('app.subtitle')"></p>
    </div>
    <div class="site-header-aside">
      <span class="site-header-user" x-text="user.email"></span>
      <a class="icon-btn icon-btn--ghost" href="/auth/logout" …>…</a>
    </div>
  </header>
  <div class="layout">
    <aside class="layout-sidebar">
      <nav class="card card--nav app-nav" :aria-label="t('nav.label')">
        <template x-for="f in features" :key="f.id">
          <button type="button" class="nav-item" :aria-current="activeFeature === f.id ? 'page' : null" @click="selectFeature(f.id)">
            <svg class="icon" aria-hidden="true"><use :href="'/icons.svg#' + f.icon"/></svg>
            <span x-text="t(f.labelKey)"></span>
          </button>
        </template>
      </nav>
    </aside>
    <main id="main-content" class="layout-main">…Ansichten…</main>
  </div>
</div>
```

**Klassen:**
- [layout/base.css](public/css/layout/base.css): `.skip-link`, `.site-title`, `.site-logo`; Element-Standards (`html` Papier-Schreibtisch mit Vignette + Körnung, `body`-Spalte max-width 860 → 1600px ab 960px, `h1`, `a`, `kbd`, `code`, `::selection`, `[x-cloak]`).
- [layout/layout-base.css](public/css/layout/layout-base.css): `.site-header-row`, `.site-header-center`, `.site-header-aside`, `.site-header-user`, `.subtitle`, `.login-shell`, `.login-btn`.
- [layout/twocolumn.css](public/css/layout/twocolumn.css): `.layout` (Grid ab 960px, `--sidebar-w`, Standard 240px), `.layout--no-sidebar`, `.layout-sidebar` (sticky, eigener Scroll auf Desktop), `.layout-main` (`min-width: 0`).
- [layout/app-nav.css](public/css/layout/app-nav.css): `.app-nav`, `.nav-item` (`[aria-current="page"]` = Akzentrahmen + sanfte Akzentfüllung). Unter 960px wird die Navigation zu einem horizontalen Streifen.

**Regeln:**
- Navigationseinträge kommen **nur** aus der Feature-Registry
  ([features.js](public/js/app/features.js), `icon` = Sprite-ID). Nie ein
  `.nav-item` von Hand schreiben.
- `h1` ist für den Site-Titel reserviert (einer pro Seite).

---

## Zeile / Listenkopf / Tabellen-Scroll

**Einsatz:** kleine Layout-Utilities für Zeilen aus Inputs/Buttons,
Titel+Aktion-Zeilen und breite Tabellen.

**Klassen** [layout/utilities.css](public/css/layout/utilities.css):
- `.row` — Flex-Zeile, Kinder wachsen, Buttons behalten ihre Breite; ≤ 480px gehen Inputs auf volle Breite.
- `.list-header` (+ `.list-header--between`, `.list-header--wrap`) — Zeile aus Titel + Aktionen; stapelt ≤ 600px.
- `.table-scroll` — Wrapper, der eine breite `<table>` horizontal scrollt.
- `.tabular-nums`, `.display-contents`, `.visually-hidden` (Text nur für Screenreader).

---

## Karte (`.card`)

**Einsatz:** jeder Hauptblock einer Ansicht — eine Feature-Ansicht, ein
Listeneintrag mit eigenen Aktionen, die Sidebar-Navigation.

**Markup:**
```html
<div class="card card--notes">
  <div class="card-header card-header--subline">
    <div class="card-header-titlebar">
      <span class="card-eyebrow">Context</span>
      <h2 class="card-title" x-text="t('…')"></h2>
      <div class="card-subline"><span class="card-timestamp">…</span></div>
    </div>
    <div class="card-actions">…Icon-Buttons…</div>
  </div>
  …Karten-Body (siehe Karten-Innenraum)…
</div>
```

**Klassen** [card-form/card-shell.css](public/css/components/card-form/card-shell.css):
- `.card` — flache Fläche: Haarlinien-Rahmen, 2px-Akzentband oben, schwache Akzent-Tönung in die Fläche, akzentgetönter Hover-Rahmen, Einblendung `cardFadeIn`.
- `.card-header` — Flex-Zeile mit unterer Linie; `--subline` für Titel + Metazeile (oben ausgerichtet).
- `.card-header-titlebar` — Spalte: optional `.card-eyebrow`, `.card-title`, optional `.card-subline`.
- `.card-title` — Serif, `--font-size-lg`, 30% Richtung Akzent getönt.
- `.card-eyebrow` — gesperrtes Versal-Kontextlabel über dem Titel.
- `.card-subline`, `.card-timestamp` — Metazeile (Zeitstempel, Spinner, Links).
- `.card-header-aside` — rechte Seite für Badges/Status (nicht für Buttons).
- `.card-actions` ([card-actions.css](public/css/components/card-form/card-actions.css)) — rechte Seite für Aktions-Buttons; `--grouped` + `.action-sep` für semantische Bündel; `.action-group` (`display: contents`) umschliesst ein Bündel, ohne die Flex-Zeile zu brechen.
- `.card-toolbar` — Aktionszeile im Karten-**Body**.

**Akzent pro Karte (SSoT):**
- Farbton in [tokens/colors.css](public/css/tokens/colors.css): eine
  `--card-accent-<key>-base`- + eine gemappte `--card-accent-<key>: light-dark(base, oklch(from base …))`-Zeile
  (Nachbarzeile kopieren).
- Mapping `.card--<key> { --card-accent: var(--card-accent-<key>); }` in
  [card-accents.css](public/css/card-accents.css).
- `card--<key>` an der Karten-Wurzel. Band, Tönung und Titelfarbe folgen
  automatisch; Feature-CSS *konsumiert* nur `var(--card-accent)`.
- Ausgelieferte Keys: `nav` (Sidebar), `notes` (Beispiel-Entity).

**Regeln:**
- Animation nur über CSS — kein `x-transition` an `.card`.
- Kopf-Buttons: `.card-actions` mit `icon-btn icon-btn--ghost`. Buttons nie
  direkt in `.card-header-aside` (dessen Gap ist für Status-Cluster).
- Mobile (≤ 700px): ein Kopf **mit** Titelleiste bleibt einzeilig (Aktionen
  oben rechts verankert, Titel bricht um); ein Kopf ohne Titelleiste stapelt.
- Karteninhalt nutzt die volle Kartenbreite — kein künstliches `max-width` auf
  Listen (Lesebreite nur für Einleitungsabsätze: `.card-hint--lead`).

**Beispiele:** [notes.html](public/partials/notes.html)

---

## Karten-Innenraum

**Einsatz:** alles INNERHALB einer `.card` unter dem Kopf. `.card` besitzt
Rahmen, Akzent und Kopf; [card-form/card-blocks.css](public/css/components/card-form/card-blocks.css)
besitzt das Vokabular des Bodys.

**Warum das ein Muster ist und keine Geschmacksfrage:** Tokens allein erzeugen
nicht dieselbe Ordnung — sie garantieren nur, dass ein *beliebiger* Abstand aus
einer Liste gewählt wird. Solange jeder Block seinen eigenen Margin mitbringt,
ist der sichtbare Abstand zwischen zwei Blöcken die Summe kollidierender
Margins und ändert sich, sobald ein Block dazwischenrutscht.

**Rhythmus — zwei Stufen, nicht mehr:**

| Token | Wert | Für |
|---|---|---|
| `--card-gap-section` | 16px | zwischen zwei unabhängigen Blöcken |
| `--card-gap-tight` | 8px | innerhalb eines Blocks (Titel → Inhalt, Leiste → Statuszeile) |

Blöcke bekommen `.card-section`; der **Nachbar-Selektor** setzt den Abstand,
nicht der Block:

```html
<div class="card-section">
  <div class="card-section-head">
    <h3 class="card-section-title" x-text="t('…')"></h3>
    <button class="btn-compact" x-text="t('…')"></button>
  </div>
  <p class="card-hint" x-text="t('…')"></p>
</div>
<div class="card-section">…</div>
<div class="card-section card-section--tight">…gehört zum Block darüber…</div>
```

`+` statt `margin-bottom` + `:last-child`: Blöcke hängen an `x-show`, und ein
Element mit `display:none` zählt für `:last-child` trotzdem mit. Mit `+` trägt
der nächste **sichtbare** Block den Abstand; ein versteckter Nachbar erzeugt
keinen.

**Bausteine:**

| Klasse | Rolle | Modifier |
|---|---|---|
| `.card-section` | Block im Body | `--tight` |
| `.card-section-head` | Titel links, Aktionen/Zähler rechts | `--baseline`, `--flush` |
| `.card-section-title` | gesperrte Versalzeile über einem Abschnitt | — |
| `.card-hint` | grauer Erklärsatz | `--sm`, `--right`, `--warn`, `--lead` (60ch) |
| `.card-status` | Zeile für Laden / Leer / Fehler | `--error` |
| `.muted-msg` | gedämpfte Zustandsmeldung | `.muted-msg--sm`, `.muted-msg--block`, `.muted-msg--spaced` |
| `.progress-bar-wrap` + `.progress-bar` | Job-Fortschritt | — |
| `.filter-bar` (+ `.filter-search-input`, `.filter-toggle`, `.filter-count`) | Filterzeile einer Liste | `.filter-bar--inline` (in einer `.card-toolbar`), `.filter-search-input--wide` |

`.card-hint` **erklärt** (steht unter seinem Element); `.muted-msg` **meldet
einen Zustand** ("keine Einträge") dort, wo der fehlende Inhalt stünde.

**Regeln (Karten-Innenraum):**
1. **Ein Hinweis bringt keinen Abstand mit** (`margin: 0`). Der Abstand kommt
   aus dem Fluss.
2. **Kein feature-eigener Nachbau** dieser Blöcke (`.xyz-hint`,
   `.abc-section-head` sind das Anti-Pattern). Eine Abweichung wird über die
   Feature-Klasse **neben** der generischen deklariert und enthält nur die
   Abweichung.
3. **Toolbars:** eigene horizontale Geometrie ja, eigener vertikaler Abstand
   nein — `--card-gap-section` darunter, nichts darüber (das liefert der Kopf).
4. **Abstände aus der Token-Skala**, nie rohe `rem`/`px` (`em` ist ausgenommen
   — schriftrelativ ist eine andere, bewusste Aussage).
5. **Besitzer-Regel:** ein Klassenname, den mehrere Karten nutzen, lebt in
   `card-blocks.css` / `status-msg.css` — nicht in der Feature-Datei, die ihn
   zufällig zuerst brauchte. Sonst hängt sein Aussehen von der Ladereihenfolge
   zweier unabhängiger Dateien ab.

---

## Überschriften-Hierarchie

**Einsatz:** konsistente Überschriftenebenen, ohne gegen eine globale
Überschriften-Cascade anzukämpfen.

- `h1.site-title` — der App-/Site-Titel, einmal pro Seite.
- `.card-title` — Kartentitel (`h2` für eine Ansichtskarte, `h3` für
  Listeneintrags-Karten).
- `.card-section-title` — Abschnittslabel in einer Karte (`h3`/`h4`, Versalien).
- `.card-eyebrow` — Kontextlabel über einem Kartentitel (kein
  Überschriftenelement).

Keine nackten `<h2>`–`<h6>` in Karten ohne eine dieser Klassen.

---

## Buttons

**Einsatz:** jede klickbare Aktion, die nicht Icon-only ist.

**Markup:**
```html
<button type="button" class="primary"><svg class="icon" aria-hidden="true"><use href="/icons.svg#plus"/></svg><span x-text="t('…')"></span></button>
<button type="button" x-text="t('…')"></button>
<button type="button" class="danger" x-text="t('…')"></button>
```

**Klassen** [buttons-badges.css](public/css/components/buttons-badges.css):
- `button` (Element-Standard) — sekundär: transparent, Haarlinie, Hover-Tönung, `:active` Scale 0.98, `:disabled` `--opacity-hint`.
- `.primary` — der EINE Haupt-CTA pro Karte (Markenblau). `.success` — bestätigende Aktion. `.danger` — destruktiv, rot umrandet.
- `.btn-compact` — kompakte Grösse (passt zu anderen kompakten Bedienelementen).
- `.btn-count` — Zähler in einem Button. `.btn-group` — Button-Zeile.
- Icon + Label: [icons.css](public/css/components/icons.css) macht `button:has(> .icon)` zu einem Inline-Flex mit Gap.

**Regeln:**
- Varianten sind Klassen auf `<button>`, nie eine Neudefinition. Ein Link, der
  sich wie ein Button verhält, ist entweder ein `.icon-btn` oder ein `<form>` +
  `<button>` (siehe [login.html](public/login.html)).
- `button:active { transform }` *ersetzt* jedes eigene Transform: ein absolut
  zentrierter Button braucht eine eigene `:active`-Regel
  (`translateY(-50%) scale(0.98)`) oder `transform: none`.
- Eine Zeile = eine Grösse der Bedienelemente (alle Standard oder alle kompakt).

---

## Badges

**Einsatz:** kleine Inline-Labels für Status oder Klassifizierung.

**Klassen** [buttons-badges.css](public/css/components/buttons-badges.css):
- `.badge` + `.badge-ok` / `.badge-warn` / `.badge-err` — Betriebsstatus.
- `.badge` + `.badge-neutral` — wertfreie Klassifizierung oder eine Anzahl (kein Status).

**Regeln:** eckig (`border-radius: 0`) — nie Pills. Status-Badges nutzen die
Status-Tokens, nie den Karten-Akzent.

---

## Aktions-Icon-Bibliothek (verbindlich)

**Einsatz:** das **verbindliche** Vokabular für Aktions-Buttons in der ganzen
App. Jedes neue Feature nutzt es — keine parallelen Button-Erfindungen. Ziel:
ein konsistentes Frontend, das wie eine "echte App" wirkt. Gesichert durch die
Icon-Guard-Tests unten (`npm run test:unit`).

**Bausteine:**
- [Icon-System](#icon-system-lucide-sprite) — Lucide-Sprite `<svg class="icon"><use href="/icons.svg#name"/></svg>`. Die **einzige** Icon-Quelle.
- [Icon-Button](#icon-button-icon-btn) — `.icon-btn` (umrandet) / `.icon-btn--ghost` (zurückhaltend bis Hover) für Icon-only-Aktionen; `.icon-btn--success` / `.icon-btn--danger` für das bestätigende / destruktive Signal.
- [Schliessen-Button](#schliessen-button) — Primitive `.btn-close`, `.btn-card-close` allein in einem Kartenkopf.
- `.action-sep` — der einzige Trenner zwischen Aktionsbündeln.
- [Tooltip](#tooltip-data-tip) — `data-tip` (Pflicht bei Icon-only) + `aria-label`.

**Regeln (verbindlich):**
- **Icon-only** für: Toolbars, Aktions-Cluster im Kopf (`.card-actions`),
  Schliessen, Inline-Aktionen an Einträgen (löschen/entfernen), Toasts.
  Pflicht: `data-tip` **und** `aria-label` (das Label lebt im Tooltip),
  `type="button"`, `aria-hidden="true"` am inneren `<svg>`.
- **Icon + Label** bleibt für primäre Formularaktionen (Speichern im
  Formular-Fuss) und prominente Textnavigation. Konsistenz kommt dort aus
  [Buttons](#buttons), nicht aus Icon-only. Ein beschrifteter Button in
  `.card-actions` trägt `data-label-ok` für "bewusst beschriftet".
- **Schliessen = immer `x`** (Sprite), nie `×` / `&#x2715;` / ein Text
  "Schliessen".
- **Destruktiv** (löschen) = `trash`; **entfernen / Chip / verwerfen** = `x` —
  andere Semantik als Schliessen.
- **Bündel-Trenner = `.action-sep`.** Wenn sich eine Icon-Zeile semantisch
  teilt (bearbeiten/ausführen ↔ löschen), trennt nur
  `<span class="action-sep" aria-hidden="true"></span>` die Bündel — nie ein
  Rahmen-Hack oder `<hr>` pro Feature.
- **Eine Glyphengrösse** für Icon-only-Aktions-/Schliessen-Buttons: `.icon` ist
  `1em` und würde mit der Schriftgrösse jedes Buttons wandern, darum
  normalisiert [icon-btn.css](public/css/components/icon-btn.css) die Glyphe auf
  `var(--icon-size-action)` ([tokens/typography.css](public/css/tokens/typography.css)),
  auf Desktop und Mobile (wo das Tap-Target auf 40px wächst, die Glyphe nicht).
  Eine neue Icon-only-Schliessen-/Aktionsklasse kommt dort in BEIDE
  Selektorlisten.
- **Reaktive Icons** über `<use :href="…">`, nie `x-text` (das zerstört das SVG).
- **Verboten:** Unicode-Glyphen als Icon-Inhalt eines Buttons (`× ✕ ↑ ↓ ← → ⤢ ⛶ ▾ …`).
- **Neue Aktion** → zuerst die [Icon-Zuordnung](#icon-system-lucide-sprite)
  prüfen/erweitern, das Symbol bei Bedarf in [public/icons.svg](public/icons.svg)
  ergänzen.

**Guard-Tests:**
- [button-icons.test.mjs](tests/unit/button-icons.test.mjs) — über alle
  `public/**/*.html`: (1) kein Button, dessen Inhalt ein Unicode-Glyphen-Icon
  ist; (2) jedes `.icon-btn` enthält `<svg class="icon"><use…>`; (3) jeder
  Button in einer `.card-actions`-Zeile ist ein Icon-Button **oder** trägt
  `data-label-ok` (`.tabs-btn`-Modus-Umschalter sind ausgenommen).
- [action-icons-tripwire.test.mjs](tests/unit/action-icons-tripwire.test.mjs) —
  jedes Icon-only-`.icon-btn` / `.btn-card-close` / `.btn-close`: `type="button"`
  (an `<button>`), `aria-label`, `data-tip` (nicht an `.btn-close`, das sein
  Host benennt), `aria-hidden="true"`-SVG.
- [icon-size-consistency.test.mjs](tests/unit/icon-size-consistency.test.mjs) —
  Menge der Coarse-Pointer-Tap-Targets ⊆ Menge der Glyphen-Normalisierung in
  `icon-btn.css`.
- [icons-sprite.test.mjs](tests/unit/icons-sprite.test.mjs) — eindeutige
  Symbol-IDs, jede `#name`-Referenz (und jedes `icon` der Feature-Registry)
  existiert, kein Query-String an `/icons.svg`, die Liste unten == der Sprite.

---

## Icon-System (Lucide-Sprite)

**Einsatz:** Single Source of Truth für UI-Icons — das Lucide-Set (ISC,
[lucide.dev](https://lucide.dev)) als statischer SVG-Sprite. Kein Icon-JS,
keine Unicode-Glyphen als Icons.

**Markup:**
```html
<svg class="icon" aria-hidden="true"><use href="/icons.svg#pencil"/></svg>
<svg class="icon" aria-hidden="true"><use :href="open ? '/icons.svg#chevron-up' : '/icons.svg#chevron-down'"/></svg>
```
Nie `x-text` an einem Icon-Button mit zwei Zuständen — `x-text` setzt
`textContent` und zerstört das SVG. `<use :href="…">` reaktiv binden oder zwei
`<template x-if>`-Zweige nutzen.

**Sprite** [public/icons.svg](public/icons.svg) — ein `<symbol id="<lucide-name>" viewBox="0 0 24 24">`
pro Icon; Lizenztext in [public/icons.LICENSE.txt](public/icons.LICENSE.txt).
Stroke/Fill sind **nicht** an den Pfaden gesetzt — sie erben von der
`.icon`-Klasse am konsumierenden `<svg>` (Shadow-Tree-Cascade). Ausgeliefert
als `/icons.svg#name` ohne Query-String (jede `?v=`-Variante ist eine eigene
URL und ein eigener Fetch).

**Klassen** [icons.css](public/css/components/icons.css):
- `.icon` — `1em`-Quadrat, `fill: none`, `stroke: currentColor`, `stroke-width: 2`, runde Enden/Ecken, `vertical-align: -0.125em`, `pointer-events: none`; die Grösse folgt der `font-size` des Elternelements.
- `.icon--sm` — 14px mit kräftigerem Strich (die einzige Grössenvariante — jede andere Grösse gehört ans Elternelement).
- `button:has(> .icon)` — Buttons mit Icon + Label werden `inline-flex` mit Gap.
- `--icon-chevron-right`, `--icon-check`, `--icon-image` — Masken-Data-URLs für CSS-Pseudo-Icons (`.card-form-saved::before`).

**Ausgelieferte Symbole** (Lucide-Namen; das Gate vergleicht diese Liste mit dem Sprite):
<!-- icon-list:start -->
- Chevrons + Pfeile: `chevron-right`, `chevron-left`, `chevron-down`, `chevron-up`, `chevron-last`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`
- Kernaktionen: `check`, `x`, `plus`, `minus`, `pencil`, `trash`, `search`, `copy`, `download`, `external-link`, `share-2`, `unlink`, `undo`, `redo`, `rotate-cw`, `rotate-ccw`, `more-horizontal`, `grip-vertical`, `pin`, `archive`, `lock`, `lock-open`, `log-out`
- Status + Mediensteuerung: `circle`, `square`, `alert-triangle`, `circle-help`, `loader`, `activity`, `play`, `pause`, `zap`
- Viewport: `focus`, `maximize-2`, `minimize-2`, `scan`, `move-horizontal`, `separator-horizontal`
- Text + Editor: `heading`, `pilcrow`, `quote`, `spell-check`, `message-square`, `lightbulb`, `mic`, `headphones`, `radio`
- Dateien + Struktur: `file-text`, `file-plus`, `folder-plus`, `list`, `list-tree`, `book-open`, `scroll`, `image`, `package`, `calendar`
- Personen + Orte: `user`, `users`, `map-pin`, `compass`, `landmark`, `mountain`, `plane`, `truck`
- Themen + Diverses (noch ohne feste Bedeutung): `heart`, `heart-crack`, `heart-handshake`, `heart-off`, `baby`, `skull`, `swords`, `git-fork`, `trophy`, `banknote`, `bomb`, `cpu`, `scale`, `laptop-minimal`, `smartphone`, `puzzle`
<!-- icon-list:end -->

**Icon-Zuordnung (verbindlich — ein Icon pro Aktion):**

| Aktion | Icon |
|---|---|
| Schliessen / verwerfen / Chip entfernen | `x` |
| Löschen (destruktiv) | `trash` |
| Bearbeiten | `pencil` |
| Hinzufügen / erstellen | `plus` (neue Datei / neuer Ordner: `file-plus` / `folder-plus`) |
| Speichern / bestätigen | `check` |
| Suchen | `search` |
| Kopieren / teilen / extern öffnen | `copy` / `share-2` / `external-link` |
| Exportieren / herunterladen | `download` |
| Rückgängig / wiederholen | `undo` / `redo` |
| Job ausführen / neu berechnen | `activity` (Statistik) oder `rotate-cw` (erneut ausführen / neu laden) |
| Abspielen / pausieren / stoppen | `play` / `pause` / `square` |
| Überlauf-Menü | `more-horizontal` |
| Ziehgriff | `grip-vertical` |
| Anheften / archivieren | `pin` / `archive` |
| Sperren / entsperren | `lock` / `lock-open` |
| Hinein- / herauszoomen, an Ansicht anpassen | `plus` / `minus`, `scan` |
| Vollbild ein / aus | `maximize-2` / `minimize-2` |
| Aufklappen / zuklappen (alle) | `chevron-down` / `chevron-up` |
| Warnung / Hilfe | `alert-triangle` / `circle-help` |
| Laden | `loader` (statische Glyphe; der Spinner ist `.spinner`) |
| Abmelden | `log-out` |

Neue Aktionen erweitern diese Tabelle **und** den Sprite.

**Masken-Variante für CSS-Pseudo-Elemente:** wo ein Icon aus CSS gezeichnet
wird (drehender Aufklapp-Marker, `.card-form-saved::before`), die
`--icon-…`-Custom-Properties aus `icons.css` nutzen:
```css
.my-thing::before {
  content: '';
  display: inline-block;
  width: 1em; height: 1em;
  background-color: currentColor;
  -webkit-mask: var(--icon-chevron-right) center / contain no-repeat;
          mask: var(--icon-chevron-right) center / contain no-repeat;
}
```
Eine Maske dort in `:root` ergänzen, sobald sie ein zweites Mal gebraucht wird.

**Erlaubtes Unicode (keine Icons):** mathematische/typografische Zeichen im
Fliesstext (`·`, `–`, `∑`).

**Regeln:**
- **Keine Icon-Bibliothek über `<script>`** (Lucide JS, Icon-Fonts) — der Sprite
  braucht kein JS und keinen Build-Schritt.
- **Neues Icon:** die Lucide-Pfade von [lucide.dev](https://lucide.dev) in ein
  `<symbol id="<lucide-name>" viewBox="0 0 24 24">` in der passenden Gruppe des
  Sprites kopieren — kein `fill`/`stroke` am Symbol (die Vererbung funktioniert
  nur, wenn die Eigenschaften am konsumierenden `<svg>` sitzen) — und den Namen
  in die Liste oben aufnehmen (sonst schlägt das Sprite-Gate fehl).
- **`aria-hidden="true"`** an jedem dekorativen Icon; Icon-only-Buttons tragen
  `aria-label` am **Button**, nicht am SVG.
- **Keine Hex-Farbe / kein Inline-Stroke** — die Farbe kommt aus `color` des
  Elternelements.
- Die Grösse folgt der `font-size` des Elternelements (`1em`); eine feste Grösse
  ist eine Klasse am Elternelement in `public/css/`, nie ein `style`-Attribut.

---

## Icon-Button (`.icon-btn`)

**Einsatz:** SSoT für jeden Icon-only-Button (Kopf-Aktionen, Toolbars,
Abmelden). Funktioniert an `<button>` und `<a>`.

**Markup:**
```html
<div class="card-actions">
  <button type="button" class="icon-btn icon-btn--ghost" :aria-label="t('notes.edit')" :data-tip="t('notes.edit')">
    <svg class="icon" aria-hidden="true"><use href="/icons.svg#pencil"/></svg>
  </button>
  <span class="action-sep" aria-hidden="true"></span>
  <button type="button" class="icon-btn icon-btn--ghost icon-btn--danger tip--end" …>…trash…</button>
</div>
```

**Klassen** [icon-btn.css](public/css/components/icon-btn.css):
- `.icon-btn` — umrandetes Quadrat (mind. 28px) — Canvas-/Viewport-Toolbars; `[aria-pressed="true"]` = aktiver Umschalter.
- `.icon-btn--ghost` — zurückhaltender Chip bis Hover — **Standard für Kopf-Cluster**; `.is-active` / `[aria-pressed="true"]` = Primary-Tönung.
- `.icon-btn--success` / `.icon-btn--danger` — bestätigendes / destruktives Hover-Signal.
- `.icon-btn-badge-wrap` + `.icon-btn-badge` — Zähl-Badge an der Ecke.
- `.action-sep` ([card-actions.css](public/css/components/card-form/card-actions.css)) — der einzige Trenner zwischen Aktionsbündeln.

**Regeln:**
- Tooltip (`data-tip`) **und** `aria-label` sind an Icon-only-Buttons Pflicht.
- Die Glyphengrösse ist auf `--icon-size-action` normalisiert; eine neue
  Icon-only-Schliessen-/Aktionsklasse kommt in beide Selektorlisten in
  `icon-btn.css` (Glyphengrösse + Coarse-Pointer-Tap-Target).
- Keine parallele Icon-Button-Basisklasse pro Feature; Anpassungen über eine
  Scoping-Klasse.

---

## Schliessen-Button

**Einsatz:** ein Panel, einen Dialog oder einen Toast schliessen — immer das
`x`-Icon.

**Klassen:**
- `.btn-close` ([btn-close.css](public/css/components/btn-close.css)) — die Primitive: randlos, zentriertes Icon; Variation über `--close-size` / `--close-pad`.
- `.btn-card-close` ([card-actions.css](public/css/components/card-form/card-actions.css)) — ein Schliessen-Button, der **allein** in einem Kartenkopf steht (auf Mobile oben rechts verankert). In einem `.card-actions`-Cluster ist das Schliessen stattdessen ein `icon-btn icon-btn--ghost`.
- `.job-toast-close` — das Schliessen des Toasts.

**Regeln:** destruktives Entfernen ist kein Schliessen — `trash`, nicht `x`.

---

## Tooltip (`data-tip`)

**Einsatz:** sofortiger Hover-/Fokus-Hinweis, Pflicht an Icon-only-Buttons.
Dem nativen `title` vorzuziehen (nicht abschaltbare Verzögerung von ~500ms).

**Markup:** `<button … :data-tip="t('…')" :aria-label="t('…')">`

**Klassen** [tooltip.css](public/css/components/tooltip.css) — nur CSS: das
`::after` des Ziels rendert `attr(data-tip)` darüber bei `:hover` /
`:focus-visible`.
- `.tip--below` — Blase darunter (Ziele nahe am oberen Rand, z. B. der Kopf).
- `.tip--end` — rechtsbündige Blase (Ziele nahe am rechten Rand, letzte Aktion).

**Regeln:**
- Das `::after` des Ziels gehört dem Tooltip: kein `data-tip` an Elementen, die
  ihr eigenes `::after` nutzen (`.tabs-btn`).
- Wird von Vorfahren mit `overflow: hidden/auto` abgeschnitten — nicht in
  Scroll-Containern verwenden.
- Auf Touch ausgeblendet (`hover: none`) — das `aria-label` trägt die Bedeutung.
- Das Label kommt immer aus i18n.

---

## Formulare

**Einsatz:** Eingaben in Karten — eine gemeinsame Geometrie, kein
kartenweises Formularvokabular.

**Markup (Label/Wert-Raster):**
```html
<div class="card-form-grid">
  <div class="card-form-row">
    <label class="card-form-label" for="x" x-text="t('…')"></label>
    <div class="card-form-field">
      <input id="x" type="text" :aria-invalid="!!err" aria-describedby="x-err">
      <p class="card-form-field-note" x-text="t('…')"></p>
    </div>
  </div>
</div>
<p class="card-form-error" id="x-err" x-show="err" x-text="err"></p>
```

**Klassen** [card-form/form-elements.css](public/css/components/card-form/form-elements.css):
- Element-Standards: `label`, `input[type=text|email|password|url|search|tel|number|date|month|datetime-local]`, `select`, `.card-form-input`, `.card-form-textarea` — 1px `--color-border-input`, `--radius-md`, Fokus = `--color-border-focus`, deaktiviert = `--opacity-hint`; ≥ 16px unter 768px (kein iOS-Zoom).
- Raster: `.card-form-grid`, `.card-form-row` (170px-Labelspalte; einspaltig ≤ 600px), `--top`, `--full` (volle Breite ohne Label), `.card-form-label`, `.card-form-field`, `.card-form-section-divider`.
- Wertspalte: `.form-stack` (vertikal), `.form-inline` + `.form-inline-field`, `.form-num`, `.form-check` (+ `.form-check-title`, `.form-check-desc`), `.form-radio-group` + `.form-radio-option` (`.form-radio-group--card` = umrandete Optionen, getönt mit `--card-accent`), `.form-lead`, `.form-section`.
- Ergebniszeilen: `.card-form-saved` (✓-Präfix, OK-Farbe), `.card-form-error`, `.card-form-warn` (Aktion erfolgreich, mit einer Folge, die der Benutzer kennen muss — getönt, `role="status"`, kein automatisches Ausblenden).
- Hinweise: `.card-form-hint`, `.card-form-field-note` (siehe [Karten-Innenraum](#karten-innenraum)).

**Regeln:**
- Labels tragen keinen Margin — der Abstand kommt aus dem `gap` des Containers.
- Validierung = `aria-invalid="true"` + `aria-describedby`; keine parallele
  Invalid-Klasse.
- Gleiche Höhe pro Zeile: alle Standard-Bedienelemente oder alle kompakt, nie
  gemischt.
- Auswahl aus einer Werteliste = [Combobox](#combobox-auswahlfeld), kein
  natives `<select>`. Ausnahme nur mit Begründung im Markup-Kommentar (z. B.
  bewusst der native Mobile-Picker); die `select`-Grundstile bleiben dafür.
- Alle Labels, Platzhalter und Meldungen über `t()`; Zahlen/Daten über `Intl`
  mit der UI-Locale.

---

## Combobox (Auswahlfeld)

**Einsatz:** jede Auswahl aus einer Werteliste — ersetzt `<select>` durch ein
durchsuchbares Dropdown mit Tastatur-Navigation; optional Mehrfachauswahl,
Zweitzeile, Gruppen-Köpfe und eine Footer-Aktion.

**Markup:** das Wrapper-Div bleibt **leer** — `init()` rendert Trigger,
Dropdown, Suche und Liste selbst und überschreibt den Inhalt.
```html
<label class="card-form-label" id="x-label" x-text="t('…')"></label>
<div aria-labelledby="x-label"
     x-data="combobox()" x-modelable="value" x-model="selectedId"
     x-effect="options = items.map((i) => ({ value: i.id, label: i.name }))"
     @combobox-change="onPick($event.detail)"></div>
```
Pflicht sind `x-data="combobox(…)"`, `x-modelable="value"` und `x-model` —
ohne `x-modelable` kommt die Auswahl nicht im Karten-State an. `init()` setzt
Klassen, ARIA-Rollen, Outside-Close und Tastatur-Navigation selbst: kein
`class`, kein `@click.outside`, kein `@keydown` im Markup.

Aufruf: `combobox(placeholder?, emptyLabel?)` oder als Objekt
`combobox({ placeholder, emptyLabel, compact, multiple, transient, footer: { label, action } })`.
`placeholder`, `emptyLabel` und `footer.label` dürfen Funktionen sein
(`() => t('…')`, reaktiv). Ohne Platzhalter: `combobox.choose`.
- `emptyLabel` — zusätzliche erste Option mit Wert `''` („keine Auswahl").
- `compact` (Default `true`) — Grösse wie `.btn-compact` für Filterleisten; in
  einer `.card-form-row` rendert sie automatisch in Feldgrösse.
- `multiple` — `value` ist ein Array, Klick togglet, das Dropdown bleibt offen.
- `transient` — nach der Auswahl zurück auf `null` (Aktions-Picker: nur
  `@combobox-change` zählt).
- Option `{ value, label, sublabel?, group? }`: `sublabel` = gedämpfte
  Zweitzeile (mitdurchsucht); `group` = nicht auswählbarer Kopf vor dem ersten
  Eintrag jeder Gruppe — Optionen dafür **nach Gruppe sortiert** liefern.
- Deaktivieren: `x-effect="…; _disabled = !items.length"`.
- Wrapper für eine Spezialisierung (Filter, Entitäts-Picker): `comboboxData(cfg)`
  spreaden statt die Mechanik nachzubauen.

**Klassen** [combobox.css](public/css/components/combobox.css):
- `.combobox-wrap` (+ `--compact`) — Wrapper, vom Helfer gesetzt.
- `.combobox-trigger` — Feld-Look, gleiche Höhe wie `<input>`; `:disabled` = `--opacity-hint`.
- `.combobox-value` (+ `--placeholder` gedämpft), `.combobox-chevron` (+ `--open` dreht 180°).
- `.combobox-dropdown` — `position: fixed`, Lage über `--cb-top`/`--cb-left`/`--cb-width`.
- `.combobox-search`, `.combobox-list`, `.combobox-option` (+ `--hl`, `--selected`), `.combobox-empty`.
- `.combobox-option__label` / `.combobox-option__sub` — Label + Zweitzeile.
- `.combobox-group` (+ `__label`) — Sticky-Gruppenkopf.
- `.combobox-footer-btn` — Footer-Aktion unter der Liste.

**Regeln:**
- **Lage:** `_place()` misst beim Öffnen und bei `resize`: unter dem Trigger,
  nach oben geklappt, wenn unten der Platz fehlt und oben mehr ist; horizontal
  in den Viewport geklemmt. Scrollen ausserhalb schliesst das Dropdown (wie ein
  natives `<select>`). Durch `position: fixed` schneidet ein `overflow`-Vorfahr
  es nicht ab; ein Vorfahr mit `transform`/`filter`/`contain` würde es aber
  verankern — die Combobox dann ausserhalb davon platzieren.
- **Mobile:** auf Handy/Touch kein Auto-Fokus auf die Suche (die
  Bildschirmtastatur würde das Dropdown verschieben); lange Labels umbrechen,
  die Suche hat ≥ 16px (kein iOS-Zoom).
- **Laufzeit-Methoden nutzen `_rootEl`, nicht `this.$el`** — im `@click` des
  gerenderten Triggers zeigt `$el` auf den Button, nicht auf den Wrapper.
- Escape schliesst nur das Dropdown (`stopPropagation`) — ein umschliessender
  Dialog bricht nicht mit ab.

**Beispiele:** [notes.html](public/partials/notes.html) (Notizbuch-Wahl);
Komponente [js/components/combobox.js](public/js/components/combobox.js),
registriert in [register-cards.js](public/js/app/register-cards.js).

---

## Schalter (Toggle)

**Einsatz:** eine einzelne boolesche Einstellung (ein/aus). Für eine Wahl
zwischen Werten eine Radio-Gruppe oder die [Combobox](#combobox-auswahlfeld) nutzen.

**Markup:**
```html
<button type="button" class="toggle-switch__btn" role="switch" :aria-checked="on" @click="on = !on">
  <span class="toggle-switch__track" :class="{ 'is-on': on }"><span class="toggle-switch__thumb"></span></span>
  <span class="toggle-switch__label" x-text="t('…')"></span>
</button>
```

**Klassen** [toggle-switch.css](public/css/components/toggle-switch.css):
`.toggle-switch__btn`, `.toggle-switch__track` (`.is-on`), `.toggle-switch__thumb`,
`.toggle-switch__label`.

**Regeln:** runde Pill (die universelle Schalter-Affordanz — die Eckig-Regel
gilt für Badges). `role="switch"` + `aria-checked` sind Pflicht; der Zustand
ist ein echter Boolean. Kein Label → `aria-label` am Button.

---

## Tabs / Modus-Umschalter

**Einsatz:** Tab-Zeilen mit Panels **und** Modus-Umschalter mit 2–3 Optionen
(Filter).

**Markup:**
```html
<div class="tabs" role="tablist">
  <button type="button" class="tabs-btn" role="tab" :aria-selected="tab === 'a'" @click="tab = 'a'" x-text="t('…')"></button>
  <button type="button" class="tabs-btn" role="tab" :aria-selected="tab === 'b'" @click="tab = 'b'">
    <span x-text="t('…')"></span><span class="tabs-btn-count" x-text="count"></span>
  </button>
</div>
<div class="card-section" role="tabpanel" x-show="tab === 'a'">…</div>
```

**Klassen** [tabs.css](public/css/components/tabs.css):
- `.tabs` — umrandete Segmentzeile; scrollt auf jeder Breite horizontal (ein Randschatten zeigt es an).
- `.tabs-btn` + `.tabs-btn--active` oder `[aria-selected="true"]` — 2px-Primary-Unterstreichung, animiert.
- `.tabs-btn-count` — Zähl-Badge; `:disabled` / `[aria-disabled]` dimmt es (für leere Filter-Töpfe).
- `.tabs--scrollable` (füllt die Containerbreite), `.tabs--fullwidth` (gleich breite Buttons).

**Regeln:** Panels sind eigene Elemente mit eigenem Padding/Abschnitt — die
Tab-Zeile hat keine Box um die Panels. Modus-Umschalter ohne Panels lassen
`role="tablist"` weg. In `.card-actions` eines Kartenkopfs bekommt die Tab-Zeile
bei ≤ 700px eine eigene volle Zeile.

---

## Status / Laden / Leer / Fehler

**Einsatz:** jeder Zustand, in dem eine Ansicht sein kann, mit einer Klasse pro
Zustand.

| Zustand | Markup | CSS |
|---|---|---|
| Laden (Ansicht) | `.skeleton` mit `.skeleton-line` (`--title`, `--wide`, `--narrow`) + `aria-busy` + `.visually-hidden`-Label | [skeleton.css](public/css/components/skeleton.css) |
| Laden (inline) | `<span class="spinner" aria-hidden="true">` neben einem Label/Zeitstempel | skeleton.css |
| Fortschritt | `.progress-bar-wrap` > `.progress-bar` mit `:style="{ '--progress': pct + '%' }"` + `.card-status` | [card-blocks.css](public/css/components/card-form/card-blocks.css) |
| Leer (mit CTA) | `.card-empty` > `.card-empty-text`, optional `.card-empty-hint`, `button.primary.card-empty-cta` | [form-elements.css](public/css/components/card-form/form-elements.css) |
| Leer / Zustandszeile | `.card-status` oder `.muted-msg` | card-blocks.css |
| Fehler in einer Karte | `.card-status--error` / `.card-form-error` | card-blocks.css / form-elements.css |
| Banner auf Formularebene | `.success-msg--banner` / `.error-msg--banner` (inline: `.success-msg` / `.error-msg`) | [status-msg.css](public/css/components/status-msg.css) |

**Regeln:**
- Nie ein nacktes `<div>` mit Inline-Text für diese Zustände.
- Kein Skeleton ohne Shimmer; Skeletons sind dekorativ (`aria-hidden`) und
  tragen einen `.visually-hidden`-Ladetext.
- **Fortschrittsbreite** ist die einzige zulässige Laufzeit-Style-Bindung:
  Objektform `:style="{ '--progress': … }"`, die eine Custom Property setzt
  (Alpine nutzt CSSOM → CSP-sicher). Nie `:style="'width:' + …"` (die
  String-Form setzt ein `style`-Attribut, das die CSP blockiert) und nie
  statisches `style=""`.
- Die CTA im Leerzustand muss zur echten Datenquelle der Ansicht passen.

**Beispiele:** Lade-Skeleton in [index.html](public/index.html), Leerzustand
und Spinner in [notes.html](public/partials/notes.html).

---

## Bestätigungsdialog (Modal)

**Einsatz:** destruktive Aktionen und "ungespeicherte Änderungen verwerfen"
bestätigen; generisches Modal-Panel. Nie `window.confirm()`.

**Markup:**
```html
<dialog class="confirm-dialog" x-ref="confirmDlg" @close="pendingId = null">
  <div class="confirm-dialog-title" x-text="t('…')"></div>
  <div class="confirm-dialog-message" x-text="t('…')"></div>
  <div class="confirm-dialog-actions">
    <button type="button" class="confirm-dialog-btn" @click="$refs.confirmDlg.close()" x-text="t('…')"></button>
    <button type="button" class="confirm-dialog-btn confirm-dialog-btn--danger" @click="…; $refs.confirmDlg.close()" x-text="t('…')"></button>
  </div>
</dialog>
<!-- öffnen: $refs.confirmDlg.showModal() -->
```

**Klassen** [confirm-dialog.css](public/css/components/confirm-dialog.css):
`.confirm-dialog` (Panel + `::backdrop`), `.confirm-dialog-title`,
`.confirm-dialog-message`, `.confirm-dialog-input` (Prompt-Variante),
`.confirm-dialog-actions`, `.confirm-dialog-btn` (`.confirm-dialog-btn--primary`,
`.confirm-dialog-btn--danger`).

**Regeln:**
- Natives `<dialog>` + `showModal()`: Fokusfalle, inerter Hintergrund und ESC
  kommen vom Browser — kein eigenes Overlay-Div und keine eigene Fokusfalle.
- `margin: auto` gehört zu jeder Dialog-/Panel-Klasse (das `margin: 0` des
  globalen Resets würde ihn oben links festnageln).
- `@close` ist der einzige Aufräumpunkt (ESC, Backdrop und Buttons enden alle
  in `dialog.close()`). Den Dialog schliessen, wenn seine Karte verschwindet.

---

## Gefahrenzone

**Einsatz:** unumkehrbare Aktionen am Ende einer Karte absetzen (Konto löschen,
Daten zurücksetzen). Nicht für das Löschen eines einzelnen Listeneintrags — das
ist ein `icon-btn--danger` + Bestätigungsdialog.

**Markup:**
```html
<div class="danger-zone">
  <div class="danger-zone-title">
    <svg class="icon" aria-hidden="true"><use href="/icons.svg#alert-triangle"/></svg>
    <span x-text="t('…')"></span>
  </div>
  <div class="danger-zone-row">
    <div class="danger-zone-text" x-text="t('…')"></div>
    <div class="danger-zone-actions">
      <button type="button" class="danger-zone-btn" @click="…" :disabled="busy" x-text="t('…')"></button>
    </div>
  </div>
</div>
```

**Klassen** [danger-zone.css](public/css/components/danger-zone.css):
`.danger-zone`, `-title`, `-row`, `-text`, `-actions`, `-btn`, `-section`
(mehrere Aktionen → je eine `.danger-zone-section`, Trenner automatisch).

**Regeln:** Farben aus den Fehler-Tokens, nicht aus dem Karten-Akzent. Eine
Bestätigung ist Pflicht (Bestätigungsdialog); für Aktionen auf Kontoebene zwei
Schritte (bestätigen, dann ein Wort eintippen). In einem Formularraster in
`.card-form-row--full` einpacken.

---

## Job-Toast

**Einsatz:** globaler, nicht blockierender Hinweis, wenn ein lang laufender
Hintergrund-Job (die Job-Queue) fertig ist. Karteninterne Ergebnisse bleiben in
der Karte.

**Markup:**
```html
<div class="job-toast job-toast--ok" role="status" aria-live="polite" x-show="toast" x-cloak>
  <span class="job-toast-msg" x-text="toast?.text"></span>
  <button type="button" class="job-toast-close" :aria-label="t('…')" @click="toast = null">
    <svg class="icon" aria-hidden="true"><use href="/icons.svg#x"/></svg>
  </button>
</div>
```

**Klassen** [job-toast.css](public/css/components/job-toast.css): `.job-toast`
(fix unten rechts, volle Breite ≤ 600px, `--z-toast`), `.job-toast--ok`, `.job-toast--err`,
`.job-toast-msg`, `.job-toast-close`.

**Regeln:** ein Toast-Zustand auf der Root (deklariert in `app-state.js`),
nicht einer pro Feature; `aria-live="assertive"` für Fehler; Text über `t()`;
nie blockierend.

---

## Sitzungs-Banner

**Einsatz:** fixes Banner oben für Zustände auf App-Ebene (Sitzung abgelaufen,
offline).

**Markup:**
```html
<div class="session-banner" x-show="sessionExpired" role="alert">
  <span class="session-banner-text" x-text="t('session.expired')"></span>
  <a class="session-banner-btn" href="/login" x-text="t('session.relogin')"></a>
</div>
```

**Klassen** [layout-base.css](public/css/layout/layout-base.css):
`.session-banner` (Fehler-Tönung, `--z-banner`), `.session-banner--offline`
(Warn-Tönung), `.session-banner-text`, `.session-banner-btn`.

---

## Feature-Anatomie

**Einsatz:** jedes Frontend-Feature — alles, was einen eigenen Eintrag in der
Navigation bekommt. Muster aus schreibwerkstatt (Feature-Registry, eine Karte
pro Feature mit gemeinsamem Lifecycle, Karten-Inventar, Fachmodul), angepasst
an die ansichtsbasierte Shell dieses Templates. **Generieren, nicht von Hand
bauen:**

```bash
npm run feature:new -- <id> --label-de "…" --label-en "…" --icon <sprite-id>
```

Der Generator ([scripts/feature-new.js](scripts/feature-new.js), Vorlagen in
[scripts/templates/feature/](scripts/templates/feature/)) schreibt jede Datei und
registriert sie an jeder SSoT; [feature-registry.test](tests/unit/feature-registry.test.mjs)
(Regeln in [scripts/feature-anatomy.js](scripts/feature-anatomy.js)) schlägt bei
jedem fehlenden Teil fehl — die meisten würden sonst **still** versagen (eine
nicht registrierte Karte rendert nichts, ohne Fehler).

| Teil | Datei (Feature `notes`) | Regel |
| --- | --- | --- |
| Registry-Eintrag | [features.js](public/js/app/features.js) `{ id, icon, labelKey, card, partial }` | SSoT für Navigation, Host, Hash-Route `#<id>[/<sub>]`, Smoke |
| Host | [index.html](public/index.html) `<section :data-feature="f.id">` (x-for) | nie pro Feature von Hand geschrieben |
| Partial | [partials/notes.html](public/partials/notes.html) | geladen beim **ersten Öffnen** ([feature-host.js](public/js/app/feature-host.js)); sein **Wurzelelement ist die Karte** (`x-data="notesCard"`); verschachtelte `data-partial` vor dem Einfügen aufgelöst; > 250 LOC → `partials/<id>/…` |
| Feature-Karte | [cards/notes-card.js](public/js/cards/notes-card.js) | `Alpine.data('<id>Card')` + `register<Id>Card()`; State vorab deklariert; Lifecycle über `setupCardLifecycle` |
| Karten-Inventar | [app/register-cards.js](public/js/app/register-cards.js) | der EINE Ort, an dem jedes `Alpine.data` registriert wird (App **und** Harness) |
| Fachmodul | [js/notes/](public/js/notes/) (`notes-methods.js`) | `export const <id>Methods` in die Karte gespreadet (`this` = Karte), API-Aufrufe + Datenregeln; reine Helfer als einfache Exports (unit-testbar) |
| Unterkomponenten | [cards/note-item-card.js](public/js/cards/note-item-card.js) | `<entity>ItemCard` für Listeneinträge; sprechen mit der Feature-Karte über ein DOM-Event (`note-removed`), greifen nie in sie hinein |
| Entity-CSS | [css/entities/notes.css](public/css/entities/notes.css) | nur Abweichungen vom Karten-Vokabular; verlinkt in index.html **und** jedem Harness |
| i18n | `nav.<id>`, `<id>.*` in de.json **und** en.json | camelCase-Bereich für Kebab-IDs (`demo-board` → `demoBoard.title`) |
| Harness + Spec | [tests/fixtures/notes-harness.html](tests/fixtures/notes-harness.html), [tests/e2e/notes-card.spec.js](tests/e2e/notes-card.spec.js) | `mountFeature('<id>')` ([_harness.js](tests/fixtures/_harness.js)) montiert die echte Karte; Mocks in [tests/server.js](tests/server.js) |

**Lifecycle** ([card-lifecycle.js](public/js/cards/card-lifecycle.js)): die Karte
lädt, wenn ihr Feature aktiv wird (erstes Öffnen und jedes erneute Öffnen;
`reloadOnReopen: false`, um nur einmal zu laden), lädt neu bei einem
**erneuten Klick auf den aktiven Navigationseintrag** (`card:refresh`), setzt
sich bei `view:reset` zurück, räumt beim Zerstören ihre Timer ab und entfernt
ihre Listener (AbortSignal). Eigene Window-Listener: `{ signal }` aus dem
zurückgegebenen Lifecycle.

**Root-Zugriff:** `$app.<field>` in Karten-Templates, `window.__app` im
Karten-JS (`$root` ist das nächste `x-data` — die Karte selbst). Die Root ist
nur die **Shell** (Sitzung, Navigation, Routing — [app-state.js](public/js/app/app-state.js));
sie hält nie die Daten eines Features. Feature-Wechsel nur über
`openFeature(id, sub)` (exklusiv: ein Feature sichtbar).

**Sub-Route:** `#<id>/<sub>` → `$app.featureSub`. Der Router teilt nur auf; das
**Feature validiert** seine Sub-Route und besitzt den Fallback.

**Eine Karte in einem bestehenden Feature** (der häufigere Fall): `/karte` —
kein Registry-Eintrag, ein Sub-Partial `partials/<id>/<name>.html` + eine
Unterkomponente im Karten-Inventar.

---

## Entity-Karte (Notizen)

**Einsatz:** Referenz für eine Liste von Domänen-Entities mit eigenen Aktionen
— das Beispiel-Feature des Templates; durch die eigene Entity ersetzen.

Jede Notiz ist eine `.card.card--notes.note-card`-Unterkomponente
(`x-data="noteItemCard(note)"`): Kopf mit Titel + Zeitstempel-Subline +
Spinner, Cluster aus Ghost-Icon-Buttons (bearbeiten / Statistik / Trenner /
löschen), Serif-Body, über den escapten `bodyHtml`-Getter in eine
`x-html`-Senke gerendert, Job-Ergebnis als `.badge-ok`. Der Bearbeitungsmodus
nutzt `.card-section.form-stack` + eine rechtsbündige `.row`. Die Feature-Karte
darüber hält das Formularraster (Notizbuch-Auswahl, Zeile für neue Notiz) und
den `.card-empty`-Zustand.

Referenz: [notes.html](public/partials/notes.html),
[note-item-card.js](public/js/cards/note-item-card.js). CSS
[entities/notes.css](public/css/entities/notes.css) deklariert nur die
Abweichungen vom generischen Karten-Vokabular (Lesefont für den Body, Abstände
der Statistik, Ausrichtung der Bearbeitungsaktionen). Entity-CSS lebt in
`entities/`, nie im generischen Layer.

---

## Benennung

- **BEM-light** für Komponenten mit Modifiern: `.block`, `.block-element`,
  `.block--modifier` (`.card-header--subline`, `.tabs-btn--active`);
  Zustandsklassen `.is-on` / `.is-active`.
- **Flach** für kleine Utilities: `.row`, `.spinner`, `.muted-msg`.
- Nur kebab-case; Modifier über `--`, nie durch Zusammensetzen.
- Präfixe: `card-` / `card-form-` (gemeinsame Karten-Geometrie), `site-`
  (App-Kopf), `nav-` / `app-nav` (Navigation), `<entity>-` (Entity-CSS).

---

## CSS-Inventar

Cascade-Reihenfolge = Link-Reihenfolge in [index.html](public/index.html)
(login.html verlinkt eine Teilmenge in derselben Reihenfolge). Jede Datei
ausser `tokens*` legt ihre Regeln in einen Layer.

| Datei | Layer | Umfang | Herkunft (schreibwerkstatt) |
|---|---|---|---|
| `css/tokens.css` | — | Facade: Layer-Reihenfolge, Token-`@import`s, `@font-face` (Inter, Source Serif 4) | `tokens.css` |
| `css/tokens/colors.css` | — | Farb-Tokens (light-dark), Karten-Akzent-Farbtöne + OKLCH-Ableitung für Dark Mode | `tokens/colors.css` (generische Teilmenge) |
| `css/tokens/typography.css` | — | Schriftfamilien, Grössen, Gewichte, Zeilenhöhen, Grössen der Bedienelemente | `tokens/typography.css` |
| `css/tokens/spacing.css` | — | Abstandsskala, Karten-Rhythmus, Padding, Rahmenbreite, Radius | `tokens/spacing.css` |
| `css/tokens/motion.css` | — | Transitions, Easing, Schatten, Deckkraft, reduzierte Bewegung | `tokens/motion.css` |
| `css/tokens/scale.css` | — | Z-Index-Stapel | `tokens/scale.css` |
| `css/card-accents.css` | components | Mapping `.card--<key>` → `--card-accent` | `card-accents.css` |
| `css/layout/base.css` | base | Reset, `[x-cloak]`, Skip-Link, Papier-Schreibtisch, Body-Spalte, `h1`/`a`/`kbd`/`code`, Site-Titel/-Logo | `layout/base.css` |
| `css/layout/layout-base.css` | components | Sitzungs-Banner, Kopfzeile, Untertitel, Login-Shell | `layout/layout-base.css` |
| `css/layout/twocolumn.css` | components | `.layout`-Grid aus Sidebar + Main, Sticky-Sidebar | `layout/twocolumn.css` |
| `css/layout/app-nav.css` | components | Registry-gesteuerte Sidebar-Navigation (`.app-nav`, `.nav-item`) | neu (nach `page/page-list.css` `.page-item`) |
| `css/layout/utilities.css` | utilities, components | `.row`, `.list-header`, `.table-scroll`, `.tabular-nums`, `.visually-hidden` | `layout/utilities.css` |
| `css/components/icons.css` | components | `.icon`, Sprite-Nutzung, Masken-Icon-URLs | `components/icons.css` |
| `css/components/card-form/card-shell.css` | components | `.card`, Kopf, Titel, Eyebrow, Subline, Aside, Toolbar | `components/card-form/card-shell.css` |
| `css/components/card-form/card-blocks.css` | components | Karten-Innenraum: Abschnitte, Hinweise, Status, gedämpfte Meldung, Fortschritt, Filterleiste | `components/card-form/card-blocks.css` |
| `css/components/card-form/form-elements.css` | components | Formularelemente, Formularraster, Checkboxen/Radios, Ergebniszeilen, Leerzustand | `components/card-form/form-elements.css` |
| `css/components/card-form/card-actions.css` | components | `.card-actions`, `.action-sep`, `.btn-card-close` | `components/card-form/card-actions.css` |
| `css/components/buttons-badges.css` | components | Buttons + Varianten, kompakt, Zähler, Badges | `components/buttons-badges.css` |
| `css/components/icon-btn.css` | components | `.icon-btn` (+ ghost/success/danger/badge), Normalisierung von Glyphe + Tap-Target | `components/icon-btn.css` |
| `css/components/btn-close.css` | components | Primitive `.btn-close` | `components/btn-close.css` |
| `css/components/status-msg.css` | components | `.success-msg` / `.error-msg` (+ Banner) | `components/status-msg.css` |
| `css/components/skeleton.css` | components | Skeleton-Shimmer, Spinner | `chat.css`, `page/page-content-skeleton.css`, `page/page-list.css` (zusammengeführt) |
| `css/components/tabs.css` | components | Tabs / Segment-Umschalter | `components/tabs.css` |
| `css/components/toggle-switch.css` | components | boolescher Schalter | `components/toggle-switch.css` |
| `css/components/combobox.css` | components | durchsuchbares Auswahlfeld (ersetzt `<select>`) | `components/combobox.css` |
| `css/components/tooltip.css` | base, components | reiner CSS-Tooltip über `data-tip` | neu (ersetzt die JS-Tooltip-Schicht) |
| `css/components/confirm-dialog.css` | components | natives `<dialog>` für Bestätigung/Modal | `components/confirm-dialog.css` |
| `css/components/danger-zone.css` | components | Gefahrenzone | `components/danger-zone.css` |
| `css/components/job-toast.css` | components | Toast bei fertigem Job | `components/job-toast.css` |
| `css/entities/notes.css` | components | Abweichungen Feature Notizen | template |

Assets: [public/fonts/](public/fonts/) (Inter + Source Serif 4 als variable
woff2, SIL OFL 1.1 — Lizenz in `fonts/OFL.txt`, neben den Dateien belassen),
[public/icons.svg](public/icons.svg) (Lucide-Sprite, ISC — Lizenz in
[public/icons.LICENSE.txt](public/icons.LICENSE.txt), neben dem Sprite belassen).

**Eine CSS-Datei hinzufügen:** in den richtigen Unterordner legen (`layout/`,
`components/`, `entities/`), in `@layer components` einpacken, einen `<link>` in
[index.html](public/index.html) an ihrer Cascade-Position ergänzen (und in
[login.html](public/login.html), falls die öffentliche Seite sie braucht), und
hier eine Zeile ergänzen. Eine Datei aufteilen, bevor sie 600 Zeilen
überschreitet (`<name>/`-Unterordner).
