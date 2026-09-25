---
description: Karte oder View-internen Tab in einem BESTEHENDEN Feature ergänzen (der häufige Fall — kein neuer Navigationseintrag)
argument-hint: "[<feature-id>: was die Karte/der Tab zeigen soll]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm run test:unit:*), Bash(npm run test:integration:*), Bash(npm run test:e2e:*), Bash(npm run test:smoke:*), Bash(git status:*)
---

Du ergänzt ein bestehendes Feature: **$ARGUMENTS**

> Der **häufigere** Weg als `/feature`: eine App wächst meist innerhalb einer
> Ansicht, nicht um eine neue. Er braucht die halbe Feature-Ceremony **nicht** —
> aber der Teil, den er braucht, fällt stumm aus, wenn er fehlt.
> Anatomie und Regeln: [DESIGN.md](DESIGN.md) → „Feature anatomy"; Muster
> **erst dort nachsehen, wiederverwenden**; fehlt es, dort zuerst dokumentieren.

## Was NICHT anzufassen ist

Kein Eintrag in `features.js`, kein Host in `index.html`, kein Generator-Lauf —
das Feature existiert schon. Braucht die Karte einen `/api`-Pfad, den es noch
nicht gibt: erst Facade + Route (Teil A von `/feature`), dann die Karte.

## Ablauf

1. **Ort bestimmen:** eine **Karte** im Feature, oder ein **Tab** (Sub-Route
   `#<feature-id>/<sub>`)? Beim Tab liest die Feature-Karte `$app.featureSub`,
   **validiert** ihn und besitzt den Fallback (der Router splittet nur);
   Tab-Leiste: DESIGN.md → „Tabs / mode toggle".
2. **Teil-Partial** `public/partials/<feature-id>/<name>.html`, im Feature-Partial
   per `<div data-partial="<feature-id>/<name>"></div>` bestellt
   (feature-host.js löst es **vor** dem Einfügen auf). > 250 LOC → weiter teilen.
3. **Sub-Komponente** als `Alpine.data` unter `public/js/cards/<name>-card.js`,
   State explizit deklariert, exportiert `register<Name>Card(Alpine)`.
4. **Karten-Inventar:** `register<Name>Card` in
   [public/js/app/register-cards.js](public/js/app/register-cards.js) importieren
   und aufrufen. **Vergessen = die Karte rendert stumm nichts** — kein Fehler,
   nur eine leere Stelle (der Console-Guard der Specs meldet dann
   „Alpine Expression Error").
5. **Daten:** gehören sie der Feature-Karte (geteilt mit Geschwistern), bleiben
   sie dort und die Sub-Komponente bekommt sie als Argument / meldet per
   DOM-Event zurück; gehören sie nur ihr, eigener State + eigene Methoden im
   Fachmodul `public/js/<feature-id>/`.
6. **i18n:** Keys im bestehenden Bereich `<feature-id>.*` in `de.json` **und** `en.json`.
7. **CSS:** in die bestehende `public/css/entities/<feature-id>.css` (nur
   Abweichungen); wird sie > 600 LOC → Unterordner, jede neue Datei in
   index.html **und** allen Harnesses verlinken + DESIGN.md-Inventar.
8. **Tests:** Harness-Spec des Features erweitern (`tests/e2e/<feature-id>-*.spec.js`,
   Mock-Routen in tests/server.js); neue Rechenlogik als Unit-Test.

## Abnahme

```bash
npm run test:unit && npm run test:e2e && npm run test:smoke
```

Bei Markup-Änderung den betroffenen Spec einmal zusätzlich im Phone-Viewport
(der DoD-Stop-Hook nennt die Specs).

## Melden

Knapp: welche Dateien angelegt/geändert, welcher Inventar-/i18n-Eintrag ergänzt,
Testergebnis. **Nicht committen.**
