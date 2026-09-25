---
name: css
description: CSS, tokens and styling in this repo — measure first, then decide where a declaration belongs (token / components / entities / utilities), plus the levers for lean CSS. Use for any work on public/css/**, a token, a breakpoint, a theme value, for "this looks the same everywhere, does it exist already?", for "why doesn't this rule win", and before bringing in a CSS library.
---

# CSS in this template

The design system is documented and gated. This skill adds **no** rules — it
says how to work inside it without diluting it, and it **measures** instead of
guessing.

- **Patterns** live in [DESIGN.md](DESIGN.md). Look there, don't grep the CSS.
- **Rules** live in [public/css/CLAUDE.md](public/css/CLAUDE.md) and the
  root [CLAUDE.md](CLAUDE.md) ("Mechanisch durchgesetzt").

Nothing of that is repeated here. Documenting a pattern in this skill creates drift.

## 1. Measure first

```bash
node .claude/skills/css/audit.mjs          # overview
node .claude/skills/css/audit.mjs --json   # machine-readable
```

Dependency-free, read-only. Shows size, bytes (raw + gzip, with and without
comments), **orphaned tokens**, raw colour and breakpoint literals, the most
frequent declaration clusters and **identical rule bodies** — exactly the
places where a pattern is missing. Past runs: [BEFUNDE.md](.claude/skills/css/BEFUNDE.md) — read
before, append after (→ §6).

## 2. Where does a declaration belong

First "yes" wins:

1. **A value more than one place shares?** → token in
   `public/css/tokens/<topic>.css` (colors · typography · spacing · motion ·
   scale). Tokens stay **unlayered**; colours are one `light-dark()` each.
2. **Used by several views?** → `public/css/components/` in `@layer components`.
3. **Belongs to exactly one feature?** → `public/css/entities/<feature>.css`,
   also `@layer components`, linked **after** the components — it wins by source
   order within the layer, so an override never needs higher specificity or
   `!important`. It declares only the deviation from the shared block.
4. **A state/utility modifier above everything?** → `layout/utilities.css`
   (`@layer utilities`).

**A rule doesn't win?** Almost always the layer or the link order is wrong, not
the specificity. Layer order `base, components, utilities` is declared once in
`tokens.css` (gated: `css-layers.test`).

## 3. Hard-gated — not negotiable

See the table "Mechanisch durchgesetzt" in the root CLAUDE.md (inline style
blocked at edit time, layers, spacing scale, one selector per file, defined
tokens, no dead classes, LOC caps, inventory drift). After CSS work:
`npm run test:unit` (the Stop hook runs it anyway) and the **affected** e2e
specs — once also at phone width (the DoD mobile check names them).

## 4. Lean means: fewer places deciding the same thing

1. **Orphaned tokens** (audit "Tokens"): declared, read by nobody. Delete, or
   declare as reserve in `TOKEN_RESERVE` of audit.mjs with a reason.
2. **Identical rule bodies** from three occurrences on: a missing pattern → §5.
3. **Flex clusters** (`display:flex; align-items:center; gap:…`): the layout
   primitives (`.row`, `.form-stack`, DESIGN.md) absorb them — ordered in the
   **markup**, not re-declared per feature.
4. **`<link>` count** in index.html: one feature = one entity stylesheet. If it
   grows without a new feature, a stylesheet is cut wrong.

## 5. The rule of three — how to generalize

**Second occurrence: copying is fine. Third: generalize**, in this order:

1. Look in DESIGN.md whether the pattern exists.
2. Missing: **document it there first** (markup snippet + CSS file + use case).
3. **Then build** it as a shared block in `components/` or as a token.
4. **Then replace the old occurrences** — a generalization that keeps the
   copies raised the number of places instead of lowering it.
5. Does the pattern carry a contract one breaks by accident? Gate test via
   `/regel`.

## 6. What the skill does with what it learns

- **Domain knowledge** (a pattern, a token, a design decision) → **DESIGN.md**,
  never here.
- **Procedural knowledge** (this skill was imprecise, a lever was missing) →
  **edit this file.**

After a CSS session where something measurable happened: run the audit again,
add one line to [BEFUNDE.md](.claude/skills/css/BEFUNDE.md) (date, core numbers, what moved, which
lever stays open). A number that stays interesting becomes a gate test in
`tests/unit/` — the skill is the precursor of a gate, not its replacement.

## 7. Before a foreign CSS library

1. **Needs a build step?** Out — "no bundler" is an architecture invariant
   (Tailwind, SCSS frameworks, PostCSS token systems).
2. **Brings a second token system?** Every value would have two sources.
3. **Claims element selectors** (`button`, `table`, `input`)? It fights
   `@layer base`.
4. **What exactly does it replace**, measured by the audit? One that doesn't
   replace documented patterns comes **in addition**.
5. And it must be **self-hosted** (committed under `public/vendor/` with licence) —
   no CDN.
