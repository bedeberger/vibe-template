---
description: Versionsnummer erhöhen + CHANGELOG + Commit + Tag + Push + GitHub-Release
argument-hint: "[patch|minor|major|x.y.z]  (Default: patch)"
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm version:*), Bash(npm run test:unit:*), Bash(npm run test:integration:*), Bash(npm run squash:check:*), Bash(node scripts/migrations-lock.js), Read, Write, Edit
---

Du führst einen Release durch. SSoT der Version ist `package.json#version`. Zu **jeder** Version gehört ein Abschnitt in [CHANGELOG.md](CHANGELOG.md).

Bump-Argument: `$ARGUMENTS` (leer = `patch`).

**Ein Release endet immer gepusht.** Commit, Tag, `git push` und GitHub-Release gehören zum Befehl. Der Push auf `main` löst CI aus, ein grünes CI den Deploy nach Prod ([docs/deployment.md](docs/deployment.md)). **Es wird nicht nachgefragt** — der Lauf hält nur an, wenn ein Schritt fehlschlägt oder die Änderungslage nicht eindeutig ist (Schritt 8).

## Vorprüfung

1. `git status --porcelain` lesen. **Der gesamte Working Tree wird mit dem Release committet.** Es darf nur kein laufender Merge/Rebase (ungemergte Pfade) vorliegen; sonst abbrechen und melden.
2. Aktuelle Version aus `package.json` lesen, letzten Tag mit `git describe --tags --abbrev=0` (kann fehlen — dann ist es der erste Release). Steht `package.json` bereits **über** dem letzten Tag, hat ein früherer Lauf vor dem Commit abgebrochen: **nicht erneut bumpen**, diesen Stand als `<neueVersion>` übernehmen und ab Schritt 6 weiterfahren.
3. Neue Version berechnen: `patch` 1.2.3 → 1.2.4 · `minor` → 1.3.0 · `major` → 2.0.0 · explizites `x.y.z` (Semver validieren).
4. Sicherstellen, dass der Tag `v<neueVersion>` noch nicht existiert (`git tag -l`, `git ls-remote --tags origin`). Sonst abbrechen.

## Version setzen

5. `npm version <neueVersion> --no-git-tag-version` (schreibt `package.json` + `package-lock.json`).

## Release-Notizen schreiben

6. `git log --format='%s%n%b' v<letzteVersion>..HEAD` lesen (erster Release: ganze Historie), plus `git diff --stat` für den Umfang. Bei vielen Commits nach Themen bündeln statt Commits aufzuzählen.
7. In [CHANGELOG.md](CHANGELOG.md) oben einen Abschnitt `## [<neueVersion>] — YYYY-MM-DD` einfügen, gruppiert unter `### Neu` / `### Verbessert` / `### Behoben` (leere Gruppen weglassen). Verbindlich:
   - **Ein Eintrag pro Änderung, die ein Nutzer oder Betreiber merkt**, nicht pro Commit. Tests, Doku, Refactoring und Versions-Bumps kommen **nicht** vor.
   - Höchstens zwei Sätze je Eintrag, Anfang nennt die Stelle so, wie sie in der Oberfläche/im Betrieb heisst. Bei `Behoben` das gesehene Symptom, nicht die Ursache im Code.
   - Das Wichtigste zuerst. Reiner Wartungs-Release: genau ein ehrlicher Eintrag („Wartung und interne Verbesserungen ohne sichtbare Änderungen.").
8. Die Notizen **ohne Rückfrage** übernehmen. Nachgefragt wird nur, wenn ein Schritt fehlschlägt oder der Log die Änderung nicht eindeutig hergibt (mehrere Lesarten, Fremdarbeit im Tree, die du nicht zuordnen kannst) — dann die Liste zeigen und bestätigen lassen.

## Gates (vor dem Tag)

9. Der Commit nimmt den **ganzen** Tree mit — auch Arbeit, die nicht in dieser Session entstand. Darum vorher:
   - `node scripts/migrations-lock.js` (Lock verifiziert) und `npm run squash:check`,
   - `npm run test:unit` und `npm run test:integration`.
   **Rot ⇒ abbrechen**, kein Commit, kein Tag, kein Push. Stand melden.

## Durchführung

10. `git add -A`, committen mit `release: v<neueVersion>`; liegen weitere Änderungen im Tree, eine kurze Zusammenfassung als Body. `Co-Authored-By:`-Trailer mit dem **aktuell vorgegebenen Modellnamen** (aus den Harness-Vorgaben, nicht aus alten Commits kopieren).
11. Annotated Tag: `git tag -a v<neueVersion> -m "v<neueVersion>"`.
12. Pushen — beides, in dieser Reihenfolge, jeweils Erfolg prüfen:
    - `git push origin HEAD` (scheitert er an fremden Commits: `git pull --rebase origin main`, Gates erneut, dann pushen).
    - `git push origin v<neueVersion>` — ein Tag reist **nicht** mit `git push` mit.
    - **Verifizieren:** `git ls-remote --tags origin v<neueVersion>` liefert eine Zeile, und `git rev-parse v<neueVersion>^{commit}` == `git rev-parse HEAD`. Sonst stoppen, kein `gh release create`.
13. GitHub-Release: Body ist der CHANGELOG-Abschnitt aus Schritt 7 (nicht `--generate-notes`). In eine Temp-Datei schreiben, dann `gh release create v<neueVersion> --title "v<neueVersion>" --notes-file <datei>`.

## Verifikation (Pflicht)

14. Erst wenn das durchläuft, gilt der Release als erfolgt:
    - `git status --porcelain` ist leer,
    - `git log origin/main -1 --oneline` zeigt den Release-Commit,
    - `gh release view v<neueVersion> --json tagName,url` antwortet.
    Schlägt etwas fehl: den fehlenden Schritt nachholen und erneut prüfen.

## Abschluss

Knapp melden: alte → neue Version, Anzahl CHANGELOG-Einträge, Commit-Hash, Tag, Release-URL — und dass der Deploy nach grünem CI automatisch läuft (Actions → „Deploy (prod)"), sofern `DEPLOY_ENABLED` gesetzt ist.

Bei jedem Fehlschlag **stoppen** und berichten, was schon committet/gepusht/getaggt ist und was fehlt.
