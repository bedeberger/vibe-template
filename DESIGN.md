# DESIGN.md — UI pattern catalog

The single reference for UI patterns. **Before building a new component, check
here.** Reuse an existing pattern; if it is missing, document it here first
(markup snippet + CSS file + use case), then build it. See CLAUDE.md → Harte
Regeln: "DESIGN.md-Pattern-Katalog vor neuer UI prüfen".

## Tokens

All visual values are CSS custom properties in [public/css/tokens/](public/css/tokens/),
imported via the facade [public/css/tokens.css](public/css/tokens.css):

- `colors.css` — `--c-*` (light + dark via `prefers-color-scheme`)
- `spacing.css` — `--sp-*`, `--radius-*`, `--shadow-1`
- `type.css` — `--font-*`, `--fs-*`, `--fw-*`, `--lh-*`
- `motion.css` — `--motion-*`, `--ease-out` (collapse to 0 under reduced-motion)
- `z-index.css` — `--z-*`

Consume tokens; never hardcode hex/px for themed values. New token → add to the
matching module (the facade `<link>` already covers it).

## Cascade layers

`@layer base, components, utilities;` declared once in `tokens.css`. `base.css`
writes into `base`; component/entity CSS into `components`. Tokens stay unlayered
so the custom properties are globally available.

## Patterns

### Card

Container for a discrete unit of content.

```html
<div class="card"> … </div>
```

CSS: `public/css/components/card.css` (`.card`). Use for forms, list items,
banners.

### Button

```html
<button class="btn">Default</button>
<button class="btn btn--primary">Primary</button>
<button class="btn btn--danger">Destructive</button>
```

CSS: `public/css/components/card.css`. Variants via modifier class, not
re-definition.

### Form field

```html
<input class="field" type="text">
<textarea class="field"></textarea>
<select class="field"> … </select>
```

CSS: `public/css/components/card.css` (`.field`).

### Nav item (driven by the feature registry)

```html
<button class="nav-item" :aria-current="active ? 'page' : null">…</button>
```

CSS: `public/css/layout/base.css`. Rendered in an `x-for` over `features` — do
not hand-write nav entries (registry is SSoT).

### Entity card (notes)

A `.card.note-card` whose body is rendered into an `x-html` sink via the
escaped `bodyHtml` getter. Reference:
[public/partials/notes-view.html](public/partials/notes-view.html) +
[public/js/cards/note-card.js](public/js/cards/note-card.js). CSS:
`public/css/entities/note.css`. Entity-specific styling lives in `entities/`,
not in the generic component layer.

## CSS file inventory

| File | Scope |
| --- | --- |
| `css/tokens.css` | token facade + layer order |
| `css/tokens/*.css` | custom-property modules |
| `css/layout/base.css` | resets, app-shell layout, nav |
| `css/components/card.css` | card, button, field primitives |
| `css/entities/note.css` | note-card styling |

Add a new CSS file → put it in the right subfolder, add a `<link>` in
[public/index.html](public/index.html) in cascade order, add the asset to
`SHELL_CACHE` in [public/sw.js](public/sw.js), and add a row here.
