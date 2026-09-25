# DESIGN.md — UI pattern catalog

The single reference for UI patterns. **Before building a new component, check
here.** Reuse an existing pattern; if it is missing, document it here first
(section per the template below), then build it. See CLAUDE.md → Harte Regeln:
"DESIGN.md-Pattern-Katalog vor neuer UI prüfen".

The design system is **paper/ink editorial**: warm paper desk, white cards with
a thin accent band, ink-black text, Inter for UI, Source Serif 4 for titles and
reading text, square badges, hairline borders, very little shadow. Only
patterns whose CSS ships in `public/css/` are listed here.

## Contents

- [Doc template](#doc-template-pflicht-für-neue-sections) ·
  [Token-Pflicht](#token-pflicht-no-ad-hoc-values) ·
  [Cascade layers](#cascade-layers) ·
  [Dark mode](#dark-mode) · [Mobile breakpoints](#mobile-breakpoints) ·
  [Motion](#motion) · [Z-index stack](#z-index-stack)
- [App shell](#app-shell) · [Row / list header / table scroll](#row-list-header-table-scroll)
- [Card](#card-card) · [Card interior](#card-interior) · [Heading hierarchy](#heading-hierarchy)
- [Buttons](#buttons) · [Badges](#badges) · [Icon system](#icon-system-lucide-sprite) ·
  [Icon button](#icon-button-icon-btn) · [Close button](#close-button) ·
  [Tooltip](#tooltip-data-tip)
- [Forms](#forms) · [Toggle switch](#toggle-switch) · [Tabs](#tabs--mode-toggle)
- [Status / loading / empty / error](#status--loading--empty--error) ·
  [Confirm dialog](#confirm-dialog-modal) · [Danger zone](#danger-zone) ·
  [Job toast](#job-toast) · [Session banner](#session-banner)
- [Entity card (notes)](#entity-card-notes) · [Naming](#naming) ·
  [CSS file inventory](#css-file-inventory)

---

## Doc template (Pflicht für neue Sections)

Every pattern section follows this order — otherwise similar sections are not
comparable at a glance.

```markdown
## <Pattern name>

**Use:** One sentence: what it is and when it applies.

**Markup:** (optional, when non-trivial)
\`\`\`html
<div class="…">…</div>
\`\`\`

**Classes** [css/path.css](public/css/path.css):
- `.foo` — purpose
- `.foo--variant` — modifier purpose

**Rules:** (optional — anti-patterns, hard constraints)

**Examples:** [partial.html](public/partials/partial.html)
```

Order is fixed: **Use → Markup → Classes → Rules → Examples**. A section
without a `**Use:**` line has no reason to be in the catalog.

---

## Token-Pflicht (no ad-hoc values)

All visual values are custom properties in [public/css/tokens/](public/css/tokens/),
imported by the facade [public/css/tokens.css](public/css/tokens.css) (the only
token `<link>`). Components consume tokens; raw hex/rgb for themed values is
forbidden. A raw value is acceptable only when no token fits — and a value used
a second time becomes a token. New token → the matching module; no extra
`<link>` needed.

| Area | Tokens (module) | Use |
|---|---|---|
| **Text colours** | `--color-text`, `--color-muted`, `--color-subtle`, `--color-faint`, `--color-text-inverse` (colors) | Body / secondary / tertiary (AA) / decorative only (never readable text) / on dark fills. |
| **Surfaces** | `--color-bg` (paper desk), `--color-surface` (cards), `--color-card-bg`, `--color-neutral-bg`, `--color-tooltip-bg` | |
| **Lines + washes** | `--color-border`, `--color-border-input`, `--color-border-focus`, `--color-hover`, `--color-hover-light`, `--color-hover-strong`, `--color-tag-bg`, `--icon-ghost-fill(-hover)` | Borders are alpha on the ground, so they work on any surface. |
| **Brand** | `--color-primary(-hover/-light)`, `--color-on-primary`, `--color-accent` (+ `-bg/-text/-hover/-soft`), `--color-on-accent`, `--color-running` | Primary = brand blue (CTA, active state). Accent = feather gold (selection, highlights). |
| **Status** | `--color-ok-{bg,text,border}`, `--color-warn-{bg,text}`, `--color-err-{bg,text,border,light,hover}`, `--color-pending`, `--color-success(-hover)` | Operational status only (banners, validation, jobs). Never a card accent. |
| **Card accent** | `--card-accent-<key>-base` → `--card-accent-<key>` → `.card--<key>` | See [Card](#card-card). |
| **Shadow** | `--shadow-sm` (sheet lift), `--shadow-md` (popover, tooltip, toast), `--shadow-lg` (modal), `--shadow-inset-top` (motion) | Cards are flat — no shadow. |
| **Spacing** | `--space-xs` 4 · `--space-sm` 8 · `--space-md` 12 · `--space-lg` 16 · `--space-xl` 24 · `--space-2xl` 32, plus `--space-1/2xs/3/5/6/10/14/18/20` (spacing) | 4px grid; in-between steps only for dense rows. |
| **Card rhythm** | `--card-gap-section` (16), `--card-gap-tight` (8) | The only two gaps inside a card body — see [Card interior](#card-interior). |
| **Padding** | `--pad-btn-compact`, `--pad-badge`, `--pad-detail` | Recurring cell sizes. |
| **Border width** | `--border-thin` (0.5px), `--border-thick` (2px) | Only the deviations are tokens; the 1px default stays literal (`1px solid var(--color-border)`). |
| **Radius** | `--radius-sm` 0 (badges, tags) · `--radius-md` 3px (inputs, buttons) · `--radius-lg` 6px (cards) · `--radius-xl` 10px (modal) | Editorial-square leitmotif. |
| **Font** | `--font-sans` (Inter, UI), `--font-serif` (Source Serif 4, titles + reading), `--font-mono` (typography) | |
| **Font size** | `--font-size-micro` 10 · `xs` 11 · `mini` 12 · `sm` 13 · `base` 14 · `md` 15 · `reading` 16 · `lg` 18 · `xl` 22 · `2xl` 26 · `3xl` 30; `--font-em-80/85/90` | xs–md = UI; lg = card title; 2xl/3xl = page/site title. |
| **Weight / line height** | `--fw-regular/medium/semibold/bold`; `--lh-tight` 1.2 · `--lh-base` 1.45 · `--lh-relaxed` 1.6 | |
| **Controls** | `--size-default-padding-y`, `--size-compact-font-size`, `--size-compact-padding`, `--icon-size-action` | Same height for controls in one row. |
| **Motion** | `--transition-fast/base/slow/emphasized`, `--ease-out` (motion) | See [Motion](#motion). |
| **Opacity** | `--opacity-disabled` 0.6 · `muted` 0.5 · `hint` 0.4 · `faint` 0.35 · `strong` 0.75 | |
| **Z-index** | `--z-*` (scale) | See [Z-index stack](#z-index-stack). |

**Focus ring:** no global `:focus-visible` rule — the browser default outline
stays. Components with their own focus signal (border colour, tint) set
`outline: none` without `!important`; list-like controls (`.nav-item`,
`.tabs-btn`) define an explicit `:focus-visible` outline.

---

## Cascade layers

`@layer base, components, utilities;` is declared **once**, in
[tokens.css](public/css/tokens.css) — utilities beat components beat base at
equal specificity. Tokens and `@font-face` stay **unlayered** (custom
properties are global and do not compete in the cascade).

**Every other CSS file wraps its rules in a layer** — an unlayered rule beats
every layered rule regardless of specificity, and the bug only shows when a
targeted override silently fails. `layout/base.css` writes `base`; everything
else writes `components` (plus `utilities` in `layout/utilities.css`). Within a
layer, link order in [index.html](public/index.html) decides — feature/entity
CSS loads last and may override generic classes by source order.

**Selector unique per file:** never define the same selector twice in one file
(the second block silently merges with the first). Deliberate variation uses a
modifier class, or a different `@media`/`@layer` scope.

---

## Dark mode

**Use:** every colour follows the theme automatically.

Each colour token is declared **once** with `light-dark(<light>, <dark>)` in
[tokens/colors.css](public/css/tokens/colors.css). `:root { color-scheme: light dark }`
follows the OS; `<html data-theme="light|dark">` forces a theme (hook for a
future toggle — flipping the attribute is all it takes).

**Rules:**
- Colours, backgrounds, borders, shadows only via tokens — no hex/rgb in
  component CSS, no per-component `[data-theme]` or `prefers-color-scheme`
  overrides.
- New hue/surface/border → one token with both halves in `colors.css`.
- Card accents: only the light `-base` hue is hand-picked; the dark value is
  derived with OKLCH relative colour syntax (`--accent-dark-lift/-chroma/-floor`).
- Checklist per new class: dark text contrast ≥ 4.5:1 on `--color-surface`;
  borders visible; SVG icons use `currentColor`.

---

## Mobile breakpoints

**Use:** every new component ships its mobile behaviour in the same commit, in
the same file (no central `mobile.css`).

Custom properties do not work inside `@media`, so the values are literal —
choose **only** from this ladder:

| Value | Role |
|---|---|
| `480px` | phone-small — hard reflow (`.row` stacks) |
| `600px` | phone-large — **default mobile breakpoint** |
| `768px` | tablet — form fields go to 16px (no iOS focus zoom) |
| `960px` | desktop — [twocolumn.css](public/css/layout/twocolumn.css) switches to sidebar + main |

Documented deviation: `700px` for card headers/action bars (card-shell,
card-actions) that must reflow before tablet width.

- `max-width: 959.98px` next to `min-width: 960px` is deliberate (fractional
  viewports under zoom), not a typo.
- `max-width: N` and `min-width: N` both match at exactly N — a pair uses
  `N` / `N+1` (or the `.98` trick).
- Touch: `@media (pointer: coarse)` grows icon-only buttons to ≥ 40px.

---

## Motion

**Use:** entrances of cards, popovers, toasts. Three mechanics — no new motion
vocabulary.

1. **Card entrance `cardFadeIn`** ([card-shell.css](public/css/components/card-form/card-shell.css),
   `--transition-emphasized` = 0.3s `--ease-out`, translateY 8px → 0). Comes
   with `.card` automatically. **Never add `x-transition` to a `.card`** —
   translate × scale compete and it wobbles; new card = `x-show` + `x-cloak` only.
   The animation uses `backwards` (not `both`) so no transform lingers.
2. **Popover/menu entrance via `@starting-style`** — opacity only (no
   transform, measurements stay correct).
3. **Toast** — `jobToastFadeIn` (160ms fade + slide).

**Hover** has two sanctioned mechanics: (A) alpha wash (`--color-hover`,
`color-mix` tints — buttons, rows, ghost icon buttons); (B) edge/fill flip to a
neighbouring surface token (outlined `.icon-btn`, `.card` border towards accent).

**Reduced motion** ([tokens/motion.css](public/css/tokens/motion.css)): transition
tokens drop to `0s` and all animations become instant globally — nothing to do
per component. Never define a transition token as `--x: var(--x)` (invalid →
falls back to 0s everywhere).

---

## Z-index stack

**Use:** every positioned layer takes a token from
[tokens/scale.css](public/css/tokens/scale.css); `position: fixed` without a
token is a bug.

| Token | Value | Use |
|---|---|---|
| `--z-base` | 1 | in-flow anchors |
| `--z-sticky` | 100 | sticky sidebar, sticky list headers |
| `--z-header` | 200 | sticky card/toolbar headers |
| `--z-popover` | 1000 | tooltip, dropdowns |
| `--z-overlay` | 2000 | non-modal fullscreen overlays |
| `--z-modal` | 9500 | backdrop of a non-`<dialog>` overlay |
| `--z-banner` | 10000 | session banner |
| `--z-modal-front` | 11000 | modal panel above banners |
| `--z-toast` | 12000 | toast, skip link |

A native `<dialog>` opened with `showModal()` lives in the top layer and needs
no z-index. A stacking violation is fixed in the table, not patched locally.

---

## App shell

**Use:** the frame of [index.html](public/index.html): skip link, session
banner, header row, two-column layout with the feature nav.

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
    <main id="main-content" class="layout-main">…views…</main>
  </div>
</div>
```

**Classes:**
- [layout/base.css](public/css/layout/base.css): `.skip-link`, `.site-title`, `.site-logo`; element defaults (`html` paper desk with vignette + grain, `body` column max-width 860 → 1600px ≥ 960px, `h1`, `a`, `kbd`, `code`, `::selection`, `[x-cloak]`).
- [layout/layout-base.css](public/css/layout/layout-base.css): `.site-header-row`, `.site-header-center`, `.site-header-aside`, `.site-header-user`, `.subtitle`, `.login-shell`, `.login-btn`.
- [layout/twocolumn.css](public/css/layout/twocolumn.css): `.layout` (grid ≥ 960px, `--sidebar-w`, default 240px), `.layout--no-sidebar`, `.layout-sidebar` (sticky, own scroll on desktop), `.layout-main` (`min-width: 0`).
- [layout/app-nav.css](public/css/layout/app-nav.css): `.app-nav`, `.nav-item` (`[aria-current="page"]` = accent border + soft accent fill). Below 960px the nav becomes a horizontal strip.

**Rules:**
- Nav entries come **only** from the feature registry
  ([features.js](public/js/app/features.js), `icon` = sprite id). Never
  hand-write a `.nav-item`.
- `h1` is reserved for the site title (one per page).

---

## Row / list header / table scroll

**Use:** small layout utilities for rows of inputs/buttons, title+action lines
and wide tables.

**Classes** [layout/utilities.css](public/css/layout/utilities.css):
- `.row` — flex row, children grow, buttons keep their width; ≤ 480px inputs go full width.
- `.list-header` (+ `--between`, `--wrap`) — title + actions line; stacks ≤ 600px.
- `.table-scroll` — wrapper that scrolls a wide `<table>` horizontally.
- `.tabular-nums`, `.display-contents`, `.visually-hidden` (screen-reader-only text).

---

## Card (`.card`)

**Use:** every main view block — a feature view, a list item with its own
actions, the sidebar nav.

**Markup:**
```html
<div class="card card--notes">
  <div class="card-header card-header--subline">
    <div class="card-header-titlebar">
      <span class="card-eyebrow">Context</span>
      <h2 class="card-title" x-text="t('…')"></h2>
      <div class="card-subline"><span class="card-timestamp">…</span></div>
    </div>
    <div class="card-actions">…icon buttons…</div>
  </div>
  …card body (see Card interior)…
</div>
```

**Classes** [card-form/card-shell.css](public/css/components/card-form/card-shell.css):
- `.card` — flat surface: hairline border, 2px accent band on top, faint accent wash into the surface, accent-tinted hover border, `cardFadeIn` entrance.
- `.card-header` — flex row with bottom rule; `--subline` for title + meta line (top-aligned).
- `.card-header-titlebar` — column: optional `.card-eyebrow`, `.card-title`, optional `.card-subline`.
- `.card-title` — serif, `--font-size-lg`, tinted 30% towards the accent.
- `.card-eyebrow` — tracked caps context label above the title.
- `.card-subline`, `.card-timestamp` — meta line (timestamp, spinner, links).
- `.card-header-aside` — right side for badges/status (not for buttons).
- `.card-actions` ([card-actions.css](public/css/components/card-form/card-actions.css)) — right side for action buttons; `--grouped` + `.action-sep` for semantic bundles.
- `.card-toolbar` — action row in the card **body**.

**Accent per card (SSoT):**
- Hue in [tokens/colors.css](public/css/tokens/colors.css): one
  `--card-accent-<key>-base` + one mapped `--card-accent-<key>: light-dark(base, oklch(from base …))`
  line (copy the neighbour line).
- Mapping `.card--<key> { --card-accent: var(--card-accent-<key>); }` in
  [card-accents.css](public/css/card-accents.css).
- `card--<key>` on the card root. Band, wash and title tint follow
  automatically; feature CSS only *consumes* `var(--card-accent)`.
- Shipped keys: `nav` (sidebar), `notes` (example entity).

**Rules:**
- Animation only via CSS — no `x-transition` on `.card`.
- Header buttons: `.card-actions` with `icon-btn icon-btn--ghost`. Never put
  buttons directly in `.card-header-aside` (its gap is for status clusters).
- Mobile (≤ 700px): a header **with** titlebar stays one line (actions
  anchored top-right, title wraps); a header without titlebar stacks.
- Card content uses the full card width — no artificial `max-width` on lists
  (reading-width is only for lead paragraphs: `.card-hint--lead`).

**Examples:** [notes-view.html](public/partials/notes-view.html)

---

## Card interior

**Use:** everything INSIDE a `.card` below the header. `.card` owns frame,
accent and header; [card-form/card-blocks.css](public/css/components/card-form/card-blocks.css)
owns the vocabulary of the body.

**Why this is a pattern, not taste:** tokens alone do not produce the same
organisation — they only guarantee an *arbitrary* gap is picked from a list.
As long as every block brings its own margin, the visible gap between two
blocks is the sum of colliding margins and changes whenever a block slips in.

**Rhythm — two steps, nothing more:**

| Token | Value | For |
|---|---|---|
| `--card-gap-section` | 16px | between two independent blocks |
| `--card-gap-tight` | 8px | within a block (title → content, bar → status line) |

Blocks get `.card-section`; the **adjacent-sibling selector** sets the gap, not
the block:

```html
<div class="card-section">
  <div class="card-section-head">
    <h3 class="card-section-title" x-text="t('…')"></h3>
    <button class="btn-compact" x-text="t('…')"></button>
  </div>
  <p class="card-hint" x-text="t('…')"></p>
</div>
<div class="card-section">…</div>
<div class="card-section card-section--tight">…belongs to the block above…</div>
```

`+` instead of `margin-bottom` + `:last-child`: blocks hang on `x-show`, and a
`display:none` element still counts for `:last-child`. With `+` the following
**visible** block carries the gap; a hidden neighbour creates none.

**Building blocks:**

| Class | Role | Modifiers |
|---|---|---|
| `.card-section` | block in the body | `--tight` |
| `.card-section-head` | title left, actions/counter right | `--baseline`, `--flush` |
| `.card-section-title` | tracked caps line above a section | — |
| `.card-hint` | grey explanatory sentence | `--sm`, `--right`, `--warn`, `--lead` (60ch) |
| `.card-status` | loading / empty / error line | `--error` |
| `.muted-msg` | muted state message | `--sm`, `--block`, `--spaced` |
| `.progress-bar-wrap` + `.progress-bar` | job progress | — |
| `.filter-bar` (+ `.filter-search-input`, `.filter-toggle`, `.filter-count`) | list filter row | `--inline` |

`.card-hint` **explains** (stays under its element); `.muted-msg` **reports a
state** ("no entries") where the missing content would be.

**Rules (Karten-Innenraum):**
1. **A hint brings no spacing** (`margin: 0`). The gap comes from the flow.
2. **No feature-own rebuild** of these blocks (`.xyz-hint`, `.abc-section-head`
   are the anti-pattern). A deviation is declared by the feature class **next
   to** the generic one and contains only the deviation.
3. **Toolbars:** own horizontal geometry yes, own vertical spacing no —
   `--card-gap-section` below, nothing above (the header provides it).
4. **Spacing from the token scale**, never raw `rem`/`px` (`em` is exempt —
   font-relative is a different, deliberate statement).
5. **Besitzer-Regel (owner rule):** a class name used by several cards lives in
   `card-blocks.css` / `status-msg.css` — not in the feature file that happened
   to need it first. Otherwise its look depends on the load order of two
   unrelated files.

---

## Heading hierarchy

**Use:** consistent heading levels without fighting a global heading cascade.

- `h1.site-title` — the app/site title, once per page.
- `.card-title` — card title (`h2` for a view card, `h3` for list-item cards).
- `.card-section-title` — section label inside a card (`h3`/`h4`, caps).
- `.card-eyebrow` — context label above a card title (not a heading element).

No bare `<h2>`–`<h6>` inside cards without one of these classes.

---

## Buttons

**Use:** every clickable action that is not icon-only.

**Markup:**
```html
<button type="button" class="primary"><svg class="icon" aria-hidden="true"><use href="/icons.svg#plus"/></svg><span x-text="t('…')"></span></button>
<button type="button" x-text="t('…')"></button>
<button type="button" class="danger" x-text="t('…')"></button>
```

**Classes** [buttons-badges.css](public/css/components/buttons-badges.css):
- `button` (element default) — secondary: transparent, hairline, hover wash, `:active` scale 0.98, `:disabled` `--opacity-hint`.
- `.primary` — the ONE main CTA per card (brand blue). `.success` — confirming action. `.danger` — destructive, outlined red.
- `.btn-compact` — compact size (pairs with other compact controls).
- `.btn-count` — counter inside a button. `.btn-group` — button row.
- Icon + label: [icons.css](public/css/components/icons.css) makes `button:has(> .icon)` an inline-flex with gap.

**Rules:**
- Variants are classes on `<button>`, never a re-definition. A link that acts
  like a button is either an `.icon-btn` or a `<form>` + `<button>` (see
  [login.html](public/login.html)).
- `button:active { transform }` *replaces* any own transform: an absolutely
  centred button needs its own `:active` rule (`translateY(-50%) scale(0.98)`)
  or `transform: none`.
- One row = one control size (all default or all compact).

---

## Badges

**Use:** small inline status or classification labels.

**Classes** [buttons-badges.css](public/css/components/buttons-badges.css):
- `.badge` + `.badge-ok` / `.badge-warn` / `.badge-err` — operational status.
- `.badge` + `.badge-neutral` — value-free classification or a count (not a status).

**Rules:** square (`border-radius: 0`) — never pills. Status badges use the
status tokens, never the card accent.

---

## Icon system (Lucide sprite)

**Use:** the single source for UI icons — Lucide (ISC) as a static SVG sprite,
no icon JS, no Unicode glyphs.

**Markup:**
```html
<svg class="icon" aria-hidden="true"><use href="/icons.svg#pencil"/></svg>
<svg class="icon" aria-hidden="true"><use :href="open ? '/icons.svg#chevron-up' : '/icons.svg#chevron-down'"/></svg>
```

**Classes** [icons.css](public/css/components/icons.css):
- `.icon` — 1em square, `stroke: currentColor`, `fill: none`, round caps; size follows the parent `font-size`.
- `.icon--sm` — 14px with a heavier stroke.
- `--icon-chevron-right`, `--icon-check` — mask data-URLs for CSS pseudo-icons (`.card-form-saved::before`).

**Sprite** [public/icons.svg](public/icons.svg) — shipped symbols:
`chevron-right/left/down/up`, `arrow-right/left`, `check`, `x`, `plus`, `minus`,
`pencil`, `trash`, `search`, `copy`, `download`, `external-link`, `rotate-cw`,
`more-horizontal`, `maximize-2`, `minimize-2`, `archive`, `pin`,
`alert-triangle`, `circle-help`, `loader`, `activity`, `calendar`, `list`,
`user`, `file-text`, `log-out`.

**Icon map (verbindlich):**

| Action | Icon |
|---|---|
| Close / dismiss / remove chip | `x` |
| Delete (destructive) | `trash` |
| Edit | `pencil` |
| Add / create | `plus` |
| Save / confirm | `check` |
| Run / recompute a job | `activity` (stats) or `rotate-cw` (re-run) |
| Overflow menu | `more-horizontal` |
| Fullscreen on / off | `maximize-2` / `minimize-2` |
| Sign out | `log-out` |

**Rules:**
- New icon: copy the Lucide paths as a `<symbol id="…" viewBox="0 0 24 24">`
  into the sprite (no presentation attributes on paths — they inherit from
  `.icon`) and add it to the list above.
- `aria-hidden="true"` on every decorative icon; icon-only buttons carry
  `aria-label` on the **button**.
- Reactive icons via `<use :href="…">`, never `x-text` (it kills the SVG).
- No Unicode glyphs (`× ✕ ↑ ⤢ …`) as button content.

---

## Icon button (`.icon-btn`)

**Use:** SSoT for every icon-only button (header actions, toolbars, sign-out).
Works on `<button>` and `<a>`.

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

**Classes** [icon-btn.css](public/css/components/icon-btn.css):
- `.icon-btn` — outlined square (28px min) — canvas/viewport toolbars; `[aria-pressed="true"]` = active toggle.
- `.icon-btn--ghost` — soft chip until hover — **default for header clusters**; `.is-active` / `[aria-pressed="true"]` = primary tint.
- `.icon-btn--success` / `.icon-btn--danger` — confirming / destructive hover signal.
- `.icon-btn-badge-wrap` + `.icon-btn-badge` — count badge on the corner.
- `.action-sep` ([card-actions.css](public/css/components/card-form/card-actions.css)) — the only divider between action bundles.

**Rules:**
- Tooltip (`data-tip`) **and** `aria-label` are mandatory on icon-only buttons.
- Glyph size is normalised to `--icon-size-action`; a new icon-only close/action
  class is added to both selector lists in `icon-btn.css` (glyph size +
  coarse-pointer tap target).
- No parallel icon-button base class per feature; tweaks via a scoping class.

---

## Close button

**Use:** closing a panel, dialog or toast — always the `x` icon.

**Classes:**
- `.btn-close` ([btn-close.css](public/css/components/btn-close.css)) — the primitive: borderless, centred icon; vary via `--close-size` / `--close-pad`.
- `.btn-card-close` ([card-actions.css](public/css/components/card-form/card-actions.css)) — a close button standing **alone** in a card header (anchored top-right on mobile). Inside a `.card-actions` cluster, the close is an `icon-btn icon-btn--ghost` instead.
- `.job-toast-close` — the toast's close.

**Rules:** destructive removal is not closing — `trash`, not `x`.

---

## Tooltip (`data-tip`)

**Use:** instant hover/focus hint, mandatory on icon-only buttons. Preferred
over native `title` (unskippable ~500ms delay).

**Markup:** `<button … :data-tip="t('…')" :aria-label="t('…')">`

**Classes** [tooltip.css](public/css/components/tooltip.css) — CSS-only: the
target's `::after` renders `attr(data-tip)` above it on `:hover` /
`:focus-visible`.
- `.tip--below` — bubble below (targets near the top edge, e.g. the header).
- `.tip--end` — right-aligned bubble (targets near the right edge, last action).

**Rules:**
- The target's `::after` belongs to the tooltip: no `data-tip` on elements that
  use their own `::after` (`.tabs-btn`).
- Clipped by ancestors with `overflow: hidden/auto` — don't use inside
  scroll containers.
- Hidden on touch (`hover: none`) — the `aria-label` carries the meaning.
- The label always comes from i18n.

---

## Forms

**Use:** inputs in cards — one shared geometry, no per-card form vocabulary.

**Markup (label/value grid):**
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

**Classes** [card-form/form-elements.css](public/css/components/card-form/form-elements.css):
- Element defaults: `label`, `input[type=text|email|password|url|search|tel|number|date|month|datetime-local]`, `select`, `.card-form-input`, `.card-form-textarea` — 1px `--color-border-input`, `--radius-md`, focus = `--color-border-focus`, disabled = `--opacity-hint`; ≥ 16px under 768px (no iOS zoom).
- Grid: `.card-form-grid`, `.card-form-row` (170px label column; one column ≤ 600px), `--top`, `--full` (label-less full width), `.card-form-label`, `.card-form-field`, `.card-form-section-divider`.
- Value column: `.form-stack` (vertical), `.form-inline` + `.form-inline-field`, `.form-num`, `.form-check` (+ `-title`, `-desc`), `.form-radio-group` + `.form-radio-option` (`--card` = bordered options tinted with `--card-accent`), `.form-lead`, `.form-section`.
- Result lines: `.card-form-saved` (✓ prefix, ok colour), `.card-form-error`, `.card-form-warn` (action succeeded with a consequence the user must know — tinted, `role="status"`, no auto-dismiss).
- Hints: `.card-form-hint`, `.card-form-field-note` (see [Card interior](#card-interior)).

**Rules:**
- Labels carry no margin — spacing comes from the container `gap`.
- Validation = `aria-invalid="true"` + `aria-describedby`; no parallel invalid class.
- Same height per row: all default controls or all compact, never mixed.
- Native `<select>` is styled and allowed (no combobox component ships).
- All labels, placeholders and messages via `t()`; numbers/dates via `Intl` with the UI locale.

---

## Toggle switch

**Use:** a single boolean setting (on/off). For a choice among values use a
radio group or `<select>`.

**Markup:**
```html
<button type="button" class="toggle-switch__btn" role="switch" :aria-checked="on" @click="on = !on">
  <span class="toggle-switch__track" :class="{ 'is-on': on }"><span class="toggle-switch__thumb"></span></span>
  <span class="toggle-switch__label" x-text="t('…')"></span>
</button>
```

**Classes** [toggle-switch.css](public/css/components/toggle-switch.css):
`.toggle-switch__btn`, `.toggle-switch__track` (`.is-on`), `.toggle-switch__thumb`,
`.toggle-switch__label`.

**Rules:** round pill (the universal switch affordance — the square rule is for
badges). `role="switch"` + `aria-checked` are mandatory; the state is a real
boolean. No label → `aria-label` on the button.

---

## Tabs / mode toggle

**Use:** tab rows with panels **and** 2–3-option mode toggles (filters).

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

**Classes** [tabs.css](public/css/components/tabs.css):
- `.tabs` — bordered segmented row; scrolls horizontally on every width (edge shadow signals it).
- `.tabs-btn` + `.tabs-btn--active` or `[aria-selected="true"]` — 2px primary underline, animated.
- `.tabs-btn-count` — count badge; `:disabled` / `[aria-disabled]` dims it (use for empty filter buckets).
- `.tabs--scrollable` (fills the container width), `.tabs--fullwidth` (equal-width buttons).

**Rules:** panels are separate elements with their own padding/section — the
tab row has no box around the panels. Mode toggles without panels skip the
`role="tablist"`. In a card header's `.card-actions` the tab row gets its own
full line on ≤ 700px.

---

## Status / loading / empty / error

**Use:** every state a view can be in, with one class per state.

| State | Markup | CSS |
|---|---|---|
| Loading (view) | `.skeleton` with `.skeleton-line` (`--title`, `--wide`, `--narrow`) + `aria-busy` + `.visually-hidden` label | [skeleton.css](public/css/components/skeleton.css) |
| Loading (inline) | `<span class="spinner" aria-hidden="true">` next to a label/timestamp | skeleton.css |
| Progress | `.progress-bar-wrap` > `.progress-bar` with `:style="{ '--progress': pct + '%' }"` + `.card-status` | [card-blocks.css](public/css/components/card-form/card-blocks.css) |
| Empty (with CTA) | `.card-empty` > `.card-empty-text`, optional `.card-empty-hint`, `button.primary.card-empty-cta` | [form-elements.css](public/css/components/card-form/form-elements.css) |
| Empty / state line | `.card-status` or `.muted-msg` | card-blocks.css |
| Error in a card | `.card-status--error` / `.card-form-error` | card-blocks.css / form-elements.css |
| Form-level banner | `.success-msg--banner` / `.error-msg--banner` (inline: `.success-msg` / `.error-msg`) | [status-msg.css](public/css/components/status-msg.css) |

**Rules:**
- Never a bare `<div>` with inline text for these states.
- No skeleton without shimmer; skeletons are decorative (`aria-hidden`) and
  carry a `.visually-hidden` loading text.
- **Progress width** is the only sanctioned runtime style binding: object form
  `:style="{ '--progress': … }"` setting a custom property (Alpine uses CSSOM →
  CSP-safe). Never `:style="'width:' + …"` (string form sets a `style`
  attribute, which the CSP blocks) and never static `style=""`.
- Empty-state CTA must match the view's real data source.

**Examples:** loading skeleton in [index.html](public/index.html), empty state
and spinner in [notes-view.html](public/partials/notes-view.html).

---

## Confirm dialog (modal)

**Use:** confirm destructive actions and "discard unsaved changes"; generic
modal panel. Never `window.confirm()`.

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
<!-- open: $refs.confirmDlg.showModal() -->
```

**Classes** [confirm-dialog.css](public/css/components/confirm-dialog.css):
`.confirm-dialog` (panel + `::backdrop`), `-title`, `-message`, `-input`
(prompt variant), `-actions`, `-btn` (`--primary`, `--danger`).

**Rules:**
- Native `<dialog>` + `showModal()`: focus trap, inert background and ESC come
  from the browser — no custom overlay div or focus trap.
- `margin: auto` is part of every dialog/panel class (the global reset's
  `margin: 0` would pin it top-left).
- `@close` is the single clean-up point (ESC, backdrop and buttons all end in
  `dialog.close()`). Close the dialog when its card disappears.

---

## Danger zone

**Use:** set apart irreversible actions at the end of a card (delete account,
reset data). Not for deleting one list entry — that's an
`icon-btn--danger` + confirm dialog.

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

**Classes** [danger-zone.css](public/css/components/danger-zone.css):
`.danger-zone`, `-title`, `-row`, `-text`, `-actions`, `-btn`, `-section`
(several actions → one `.danger-zone-section` each, divider automatic).

**Rules:** colours from the error tokens, not the card accent. Confirmation is
mandatory (confirm dialog); for account-level actions, two steps (confirm,
then type a word). In a form grid wrap it in `.card-form-row--full`.

---

## Job toast

**Use:** global, non-blocking notice when a long-running background job (the
job queue) finishes. Card-internal results stay in the card.

**Markup:**
```html
<div class="job-toast job-toast--ok" role="status" aria-live="polite" x-show="toast" x-cloak>
  <span class="job-toast-msg" x-text="toast?.text"></span>
  <button type="button" class="job-toast-close" :aria-label="t('…')" @click="toast = null">
    <svg class="icon" aria-hidden="true"><use href="/icons.svg#x"/></svg>
  </button>
</div>
```

**Classes** [job-toast.css](public/css/components/job-toast.css): `.job-toast`
(fixed bottom-right, full width ≤ 600px, `--z-toast`), `--ok`, `--err`,
`.job-toast-msg`, `.job-toast-close`.

**Rules:** one toast state on the root (declared in `app-state.js`), not one per
feature; `aria-live="assertive"` for errors; text via `t()`; never blocking.

---

## Session banner

**Use:** fixed top banner for app-level states (session expired, offline).

**Markup:**
```html
<div class="session-banner" x-show="sessionExpired" role="alert">
  <span class="session-banner-text" x-text="t('session.expired')"></span>
  <a class="session-banner-btn" href="/login" x-text="t('session.relogin')"></a>
</div>
```

**Classes** [layout-base.css](public/css/layout/layout-base.css):
`.session-banner` (error tint, `--z-banner`), `--offline` (warn tint),
`.session-banner-text`, `.session-banner-btn`.

---

## Entity card (notes)

**Use:** reference for a list of domain entities with their own actions — the
template's example; replace with your entity.

Each note is a `.card.card--notes.note-card` sub-component (`x-data="noteCard(note)"`):
header with title + timestamp subline + spinner, ghost icon-button cluster
(edit / stats / sep / delete), serif body rendered into an `x-html` sink via
the escaped `bodyHtml` getter, job result as `.badge-ok`. Edit mode uses
`.card-section.form-stack` + a right-aligned `.row`. The view card above holds
the form grid (notebook select, new-note row) and the `.card-empty` state.

Reference: [notes-view.html](public/partials/notes-view.html),
[note-card.js](public/js/cards/note-card.js). CSS
[entities/note.css](public/css/entities/note.css) declares only the deviations
from the generic card vocabulary (reading font for the body, stats spacing,
edit-action alignment). Entity CSS lives in `entities/`, never in the generic
layer.

---

## Naming

- **BEM-light** for components with modifiers: `.block`, `.block-element`,
  `.block--modifier` (`.card-header--subline`, `.tabs-btn--active`); state
  classes `.is-on` / `.is-active`.
- **Flat** for small utilities: `.row`, `.spinner`, `.muted-msg`.
- kebab-case only; modifiers via `--`, never by concatenation.
- Prefixes: `card-` / `card-form-` (shared card geometry), `site-` (app
  header), `nav-` / `app-nav` (navigation), `<entity>-` (entity CSS).

---

## CSS file inventory

Cascade order = link order in [index.html](public/index.html) (login.html links
a subset in the same order). Every file except `tokens*` wraps its rules in a
layer.

| File | Layer | Scope | Origin (schreibwerkstatt) |
|---|---|---|---|
| `css/tokens.css` | — | facade: layer order, token `@import`s, `@font-face` (Inter, Source Serif 4) | `tokens.css` |
| `css/tokens/colors.css` | — | colour tokens (light-dark), card-accent hues + OKLCH dark derivation | `tokens/colors.css` (generic subset) |
| `css/tokens/typography.css` | — | families, sizes, weights, line heights, control sizes | `tokens/typography.css` |
| `css/tokens/spacing.css` | — | spacing scale, card rhythm, padding, border width, radius | `tokens/spacing.css` |
| `css/tokens/motion.css` | — | transitions, easing, shadows, opacity, reduced motion | `tokens/motion.css` |
| `css/tokens/scale.css` | — | z-index stack | `tokens/scale.css` |
| `css/card-accents.css` | components | `.card--<key>` → `--card-accent` mapping | `card-accents.css` |
| `css/layout/base.css` | base | reset, `[x-cloak]`, skip link, paper desk, body column, `h1`/`a`/`kbd`/`code`, site title/logo | `layout/base.css` |
| `css/layout/layout-base.css` | components | session banner, header row, subtitle, login shell | `layout/layout-base.css` |
| `css/layout/twocolumn.css` | components | `.layout` sidebar + main grid, sticky sidebar | `layout/twocolumn.css` |
| `css/layout/app-nav.css` | components | registry-driven sidebar nav (`.app-nav`, `.nav-item`) | new (after `page/page-list.css` `.page-item`) |
| `css/layout/utilities.css` | utilities, components | `.row`, `.list-header`, `.table-scroll`, `.tabular-nums`, `.visually-hidden` | `layout/utilities.css` |
| `css/components/icons.css` | components | `.icon`, sprite usage, mask icon URLs | `components/icons.css` |
| `css/components/card-form/card-shell.css` | components | `.card`, header, title, eyebrow, subline, aside, toolbar | `components/card-form/card-shell.css` |
| `css/components/card-form/card-blocks.css` | components | card interior: sections, hints, status, muted msg, progress, filter bar | `components/card-form/card-blocks.css` |
| `css/components/card-form/form-elements.css` | components | form elements, form grid, checks/radios, result lines, empty state | `components/card-form/form-elements.css` |
| `css/components/card-form/card-actions.css` | components | `.card-actions`, `.action-sep`, `.btn-card-close` | `components/card-form/card-actions.css` |
| `css/components/buttons-badges.css` | components | buttons + variants, compact, count, badges | `components/buttons-badges.css` |
| `css/components/icon-btn.css` | components | `.icon-btn` (+ ghost/success/danger/badge), glyph + tap-target normalisation | `components/icon-btn.css` |
| `css/components/btn-close.css` | components | `.btn-close` primitive | `components/btn-close.css` |
| `css/components/status-msg.css` | components | `.success-msg` / `.error-msg` (+ banner) | `components/status-msg.css` |
| `css/components/skeleton.css` | components | skeleton shimmer, spinner | `chat.css`, `page/page-content-skeleton.css`, `page/page-list.css` (merged) |
| `css/components/tabs.css` | components | tabs / segmented toggle | `components/tabs.css` |
| `css/components/toggle-switch.css` | components | boolean switch | `components/toggle-switch.css` |
| `css/components/tooltip.css` | base, components | CSS-only `data-tip` tooltip | new (replaces the JS tooltip layer) |
| `css/components/confirm-dialog.css` | components | native `<dialog>` confirm/modal | `components/confirm-dialog.css` |
| `css/components/danger-zone.css` | components | danger zone | `components/danger-zone.css` |
| `css/components/job-toast.css` | components | job-done toast | `components/job-toast.css` |
| `css/entities/note.css` | components | note entity deviations | template |

Assets: [public/fonts/](public/fonts/) (Inter + Source Serif 4 variable woff2,
SIL OFL 1.1 — licence in `fonts/OFL.txt`, keep it next to the files),
[public/icons.svg](public/icons.svg) (Lucide sprite, ISC).

**Add a CSS file:** put it in the right subfolder (`layout/`, `components/`,
`entities/`), wrap it in `@layer components`, add a `<link>` to
[index.html](public/index.html) at its cascade position (and to
[login.html](public/login.html) if the public page needs it), and add a row
here. Split a file before it passes 600 lines (`<name>/` subfolder).
