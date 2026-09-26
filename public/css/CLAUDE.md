# CSS-Regeln (`public/css/`)

Gilt zusätzlich zu [public/CLAUDE.md](../CLAUDE.md). Pattern-Katalog +
CSS-Inventar: [DESIGN.md](../../DESIGN.md).

- **Styles nur hier.** Keine Inline-`style`-Attribute, keine `<style>`-Blöcke.
  Einzige Ausnahme: eine Runtime-Custom-Property in Alpine-**Objekt**-Form
  (`:style="{ '--progress': pct + '%' }"` → CSSOM, CSP-sicher); nie `:style` in
  String-Form.
- **Tokens** leben in [tokens/](tokens/) (`colors`, `typography`, `spacing`,
  `motion`, `scale` = z-index-Stack), importiert von der Facade
  [tokens.css](tokens.css), die `@layer base, components, utilities` deklariert.
  Tokens und `@font-face` bleiben ohne Layer; **jede andere Datei packt ihre
  Regeln in einen Layer**. Komponenten konsumieren Tokens — nie rohe Hex/RGB,
  nie rohe `rem`/`px`-Abstände (`em` ist ausgenommen: schriftrelativ ist eine
  andere Aussage).
- **Farben:** eine `light-dark(light, dark)`-Deklaration pro Token. Dark-Mode
  folgt dem OS; `data-theme="light|dark"` auf `<html>` erzwingt ihn (gesetzt
  nur von `js/theme-boot.js`, Umschalter im Benutzermenü).
- **Fonts** self-hosted in `public/fonts/` (Inter = UI und Titel, eine
  Familie; `OFL.txt` behalten). **Icons** nur aus dem Lucide-Sprite
  `public/icons.svg` (`<svg class="icon"><use href="/icons.svg#name"/></svg>`),
  keine Unicode-Glyphen als Icons.
- **Karten-Akzent.** Akzent = `--card-accent-<key>-base` in `tokens/colors.css`
  (Dark via OKLCH abgeleitet) + `.card--<key>` in [card-accents.css](card-accents.css);
  Feature-CSS konsumiert nur `var(--card-accent)`.
- **Karten-Innenraum: Abstand gehört zum Fluss, nicht zum Block.** Innerhalb
  einer Karte `.card-section` + `--card-gap-section`/`--card-gap-tight` aus
  [components/card-form/card-blocks.css](components/card-form/card-blocks.css)
  verwenden; Hinweise tragen keinen eigenen Margin; kein feature-eigener
  Nachbau eines Kartenblocks — eine Abweichung deklariert nur die Abweichung.
  **Warum:** Tokens allein ergeben nicht dasselbe Layout, benannte Blöcke schon.
- **Besitzer-Regel:** eine Klasse, die mehrere Karten nutzen, lebt in
  `card-blocks.css` / `status-msg.css`, nicht in der Feature-Datei, die sie
  zuerst brauchte — sonst hängt der Look von der Ladereihenfolge zweier
  unabhängiger Dateien ab.
- **Ein Selektor pro Datei** — keine doppelte Definition desselben Selektors in
  einer Datei (eine Variante bekommt eine Modifier-Klasse). Derselbe Selektor in
  einem anderen `@media`/`@layer`-Scope ist in Ordnung.
- **Mobile pro Komponente**, in der eigenen Datei der Komponente (keine zentrale
  mobile.css): Media-Query ODER Container-Query für eine Regel, nicht beides.
- **Neue CSS-Datei** → richtiger Unterordner, `<link>` in
  [public/index.html](../index.html) in Cascade-Reihenfolge, **derselbe `<link>`
  in jedem `tests/fixtures/*-harness.html`** und eine Zeile in DESIGN.md
  "CSS-Inventar". Split bei 600 LOC.
