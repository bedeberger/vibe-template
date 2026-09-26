---
name: css
description: CSS, Tokens und Styling in diesem Repo — zuerst messen, dann entscheiden, wohin eine Deklaration gehört (Token / components / entities / utilities), plus die Hebel für schlankes CSS. Verwenden für jede Arbeit an public/css/**, einem Token, einem Breakpoint, einem Theme-Wert, für "das sieht überall gleich aus, gibt es das schon?", für "warum gewinnt diese Regel nicht" und bevor eine CSS-Library reinkommt.
---

# CSS in diesem Template

Das Designsystem ist dokumentiert und gegated. Dieser Skill fügt **keine** Regeln
hinzu — er sagt, wie man darin arbeitet, ohne es zu verwässern, und er **misst**,
statt zu raten.

- **Patterns** leben in [DESIGN.md](DESIGN.md). Dort nachsehen, nicht das CSS greppen.
- **Regeln** leben in [public/css/CLAUDE.md](public/css/CLAUDE.md) und der
  Root-[CLAUDE.md](CLAUDE.md) ("Mechanisch durchgesetzt").

Nichts davon wird hier wiederholt. Ein Pattern in diesem Skill zu dokumentieren
erzeugt Drift.

## 1. Zuerst messen

```bash
node .claude/skills/css/audit.mjs          # Übersicht
node .claude/skills/css/audit.mjs --json   # maschinenlesbar
```

Ohne Abhängigkeiten, nur lesend. Zeigt Grösse, Bytes (roh + gzip, mit und ohne
Kommentare), **verwaiste Tokens**, rohe Farb- und Breakpoint-Literale, die
häufigsten Deklarations-Cluster und **identische Regelkörper** — genau die
Stellen, an denen ein Pattern fehlt. Frühere Läufe: [BEFUNDE.md](.claude/skills/css/BEFUNDE.md) —
vorher lesen, nachher ergänzen (→ §6).

## 2. Wohin gehört eine Deklaration

Das erste "Ja" gewinnt:

1. **Ein Wert, den mehr als eine Stelle teilt?** → Token in
   `public/css/tokens/<topic>.css` (colors · typography · spacing · motion ·
   scale). Tokens bleiben **ohne Layer**; Farben sind je ein `light-dark()`.
2. **Von mehreren Views genutzt?** → `public/css/components/` in `@layer components`.
3. **Gehört zu genau einem Feature?** → `public/css/entities/<feature>.css`,
   ebenfalls `@layer components`, **nach** den Komponenten verlinkt — es gewinnt
   innerhalb des Layers über die Quellreihenfolge, ein Override braucht also nie
   höhere Spezifität oder `!important`. Es deklariert nur die Abweichung vom
   geteilten Block.
4. **Ein Zustands-/Utility-Modifier über allem?** → `layout/utilities.css`
   (`@layer utilities`).

**Eine Regel gewinnt nicht?** Fast immer ist der Layer oder die Link-Reihenfolge
falsch, nicht die Spezifität. Die Layer-Reihenfolge `base, components, utilities`
ist einmal in `tokens.css` deklariert (gegated: `css-layers.test`).

## 3. Hart gegated — nicht verhandelbar

Siehe die Tabelle "Mechanisch durchgesetzt" in der Root-CLAUDE.md (Inline-Style
beim Editieren geblockt, Layer, Spacing-Skala, ein Selektor pro Datei, definierte
Tokens, keine toten Klassen, LOC-Caps, Inventar-Drift). Nach CSS-Arbeit:
`npm run test:unit` (der Stop-Hook führt ihn ohnehin aus) und die **betroffenen**
E2E-Specs — einmal auch in Handybreite (der DoD-Mobile-Check nennt sie).

## 4. Schlank heisst: weniger Stellen, die dasselbe entscheiden

1. **Verwaiste Tokens** (Audit "Tokens"): deklariert, von niemandem gelesen.
   Löschen oder mit Begründung als Reserve in `TOKEN_RESERVE` von audit.mjs
   deklarieren.
2. **Identische Regelkörper** ab drei Vorkommen: ein fehlendes Pattern → §5.
3. **Flex-Cluster** (`display:flex; align-items:center; gap:…`): die
   Layout-Primitive (`.row`, `.form-stack`, DESIGN.md) nehmen sie auf — im
   **Markup** angeordnet, nicht pro Feature neu deklariert.
4. **Anzahl `<link>`** in index.html: ein Feature = ein Entity-Stylesheet. Wächst
   sie ohne neues Feature, ist ein Stylesheet falsch geschnitten.

## 5. Die Dreierregel — wie man generalisiert

**Zweites Vorkommen: Kopieren ist in Ordnung. Drittes: generalisieren**, in
dieser Reihenfolge:

1. In DESIGN.md nachsehen, ob das Pattern existiert.
2. Fehlt es: **zuerst dort dokumentieren** (Markup-Snippet + CSS-Datei +
   Anwendungsfall).
3. **Dann bauen** als geteilter Block in `components/` oder als Token.
4. **Dann die alten Vorkommen ersetzen** — eine Generalisierung, die die Kopien
   behält, hat die Zahl der Stellen erhöht statt gesenkt.
5. Trägt das Pattern einen Vertrag, den man versehentlich bricht? Gate-Test via
   `/regel`.

## 6. Was der Skill mit dem Gelernten macht

- **Fachwissen** (ein Pattern, ein Token, eine Designentscheidung) →
  **DESIGN.md**, nie hier.
- **Verfahrenswissen** (dieser Skill war unpräzise, ein Hebel fehlte) →
  **diese Datei editieren.**

Nach einer CSS-Session, in der sich etwas Messbares getan hat: Audit erneut
ausführen, eine Zeile in [BEFUNDE.md](.claude/skills/css/BEFUNDE.md) ergänzen
(Datum, Kernzahlen, was sich bewegt hat, welcher Hebel offen bleibt). Eine Zahl,
die interessant bleibt, wird ein Gate-Test in `tests/unit/` — der Skill ist die
Vorstufe eines Gates, nicht sein Ersatz.

## 7. Vor einer fremden CSS-Library

1. **Braucht sie einen Build-Schritt?** Raus — "kein Bundler" ist eine
   Architektur-Invariante (Tailwind, SCSS-Frameworks, PostCSS-Token-Systeme).
2. **Bringt sie ein zweites Token-System mit?** Jeder Wert hätte zwei Quellen.
3. **Beansprucht sie Element-Selektoren** (`button`, `table`, `input`)? Sie
   kämpft gegen `@layer base`.
4. **Was genau ersetzt sie**, gemessen am Audit? Eine, die keine dokumentierten
   Patterns ersetzt, kommt **zusätzlich**.
5. Und sie muss **self-hosted** sein (committet unter `public/vendor/` mit
   Lizenz) — kein CDN.
