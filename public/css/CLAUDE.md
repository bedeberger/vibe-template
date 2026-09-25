# CSS rules (`public/css/`)

Applies in addition to [public/CLAUDE.md](../CLAUDE.md). Pattern catalog + CSS
file inventory: [DESIGN.md](../../DESIGN.md).

- **Styles only here.** No inline `style` attributes, no `<style>` blocks. Only
  exception: a runtime custom property in Alpine **object** form
  (`:style="{ '--progress': pct + '%' }"` → CSSOM, CSP-safe); never string-form
  `:style`.
- **Tokens** live in [tokens/](tokens/) (`colors`, `typography`, `spacing`,
  `motion`, `scale` = z-index stack), imported by the facade
  [tokens.css](tokens.css), which declares `@layer base, components, utilities`.
  Tokens and `@font-face` stay unlayered; **every other file wraps its rules in a
  layer**. Components consume tokens — never raw hex/rgb, never raw `rem`/`px`
  spacing (`em` is exempt: font-relative is a different statement).
- **Colours:** one `light-dark(light, dark)` declaration per token. Dark mode
  follows the OS; `data-theme="light|dark"` on `<html>` forces it.
- **Fonts** self-hosted in `public/fonts/` (Inter = UI, Source Serif 4 =
  titles/reading; keep `OFL.txt`). **Icons** only from the Lucide sprite
  `public/icons.svg` (`<svg class="icon"><use href="/icons.svg#name"/></svg>`),
  no Unicode glyphs as icons.
- **Karten-Akzent.** Accent = `--card-accent-<key>-base` in `tokens/colors.css`
  (dark derived via OKLCH) + `.card--<key>` in [card-accents.css](card-accents.css);
  feature CSS only consumes `var(--card-accent)`.
- **Karten-Innenraum: spacing belongs to the flow, not the block.** Inside a
  card use `.card-section` + `--card-gap-section`/`--card-gap-tight` from
  [components/card-form/card-blocks.css](components/card-form/card-blocks.css);
  hints carry no own margin; no feature-own rebuild of a card block — a deviation
  declares only the deviation. **Why:** tokens alone don't give the same layout,
  named blocks do.
- **Besitzer-Regel:** a class used by several cards lives in `card-blocks.css` /
  `status-msg.css`, not in the feature file that needed it first — otherwise the
  look depends on the load order of two unrelated files.
- **One selector per file** — no duplicate definition of the same selector in
  one file (a variant gets a modifier class). Same selector in a different
  `@media`/`@layer` scope is fine.
- **Mobile per component**, in the component's own file (no central mobile.css):
  media query OR container query for a rule, not both.
- **New CSS file** → right subfolder, `<link>` in [public/index.html](../index.html)
  in cascade order, **the same `<link>` in every `tests/fixtures/*-harness.html`**,
  and a row in DESIGN.md "CSS file inventory". Split at 600 LOC.
