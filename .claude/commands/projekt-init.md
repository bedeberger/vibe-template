---
description: Frischen Klon des Templates zum eigenen Projekt machen (Name, Titel, Neustart, Deploy-Variablen, später Beispiel-Domäne ablösen)
argument-hint: "<slug> [Anzeigename]   z.B.  invoice-hub \"Invoice Hub\""
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm run init:*), Bash(npm install:*), Bash(npm run test:unit:*), Bash(npm run test:smoke:*), Bash(git status:*), Bash(git diff:*), Bash(git remote -v:*), Bash(git log:*)
---

Du machst aus einem Klon des Templates ein eigenes Projekt. Argumente: **$ARGUMENTS**

Das Umbenennen macht **das Script**, nicht du per Suchen/Ersetzen: [scripts/project-init.js](scripts/project-init.js) liest den bisherigen Namen aus dem Baum und ersetzt ihn vollständig. [tests/unit/project-init.test.mjs](tests/unit/project-init.test.mjs) belegt, dass keine Stelle übrig bleibt.

## 1. Namen klären

- **Slug**: kebab-case, technischer Name. Er steuert die systemd-Unit, `/opt/<slug>`, `/etc/<slug>` und das Runner-Label. Später ändern heisst, das LXC neu aufzusetzen. Darum ist er Pflicht: fehlt er in `$ARGUMENTS`, **nachfragen**.
- **Anzeigename**: Titel in der Oberfläche, im Browser-Tab und im PWA-Manifest. Fehlt er, den Slug nehmen und das im Abschluss erwähnen.

## 2. Script laufen lassen

1. `git status --porcelain`: Der Tree muss sauber sein, sonst sind die Änderungen des Scripts nicht mehr isoliert sichtbar. Ist er nicht sauber, abbrechen und melden.
2. `npm run init -- <slug> --title "<Anzeigename>" --dry-run`: Liste der Dateien zeigen.
3. `npm run init -- <slug> --title "<Anzeigename>"`: schreibt die Dateien und lässt danach `npm run test:unit` laufen. Rot ⇒ Ursache melden, nicht mit eigenen Ersetzungen „nachhelfen“. Liegt eine Namensstelle ausserhalb der Reichweite des Scripts, wird das Script erweitert (und der Test mit ihm).
4. `git diff --stat` zeigen. Committen nur, wenn der User es sagt.

## 3. Was das Script nicht kann (Checkliste an den User)

Gib diese Punkte als kurze Liste aus. Erledige selbst nur, was lokal geht:

- **Git-Remote**: `git remote -v`. Zeigt `origin` noch auf das Template-Repo, muss der User ein eigenes Repo anlegen und den Remote umstellen, sonst würde ein Push ins Template gehen. Weniger Aufwand: das Template auf GitHub als *Template repository* markieren und neue Projekte über *Use this template* anlegen (ohne Template-Historie).
- **`.env`**: `cp .env.example .env` (lokal, `LOCAL_DEV_MODE=1` ist vorbelegt). Das darfst du selbst tun, falls `.env` fehlt.
- **Deploy**: GitHub-Variable `APP_NAME=<slug>` (die Workflows haben ihn schon als Default, die Variable macht ihn explizit), dazu `DEPLOY_ENABLED` und LXC per `APP_NAME=<slug> REPO_SLUG=<owner>/<repo> bash scripts/prepare-lxc.sh`, siehe [docs/deployment.md](docs/deployment.md).
- **Icon/Farben**: `public/icon.svg` und die `theme-color`/`background_color` sind die des Templates, siehe [DESIGN.md](DESIGN.md).

## 4. Beispiel-Domäne `note`/`notebook` ablösen (später, nicht jetzt)

**Nicht in diesem Lauf.** `note` ist die Referenz für jedes Muster (Facade, Job, Karte, Harness), solange es kein eigenes Feature gibt. Weise den User darauf hin: erst das erste eigene Feature mit `/feature`, dann `note` entfernen. Beim Entfernen gilt:

- Die Guards sind auf die Beispiel-Domäne verdrahtet: `DOMAIN_TABLES` + `DOMAIN_DB_IMPORT_RE` in [scripts/hooks/_rules.js](scripts/hooks/_rules.js), [architecture-tripwire.test](tests/unit/architecture-tripwire.test.mjs), die Beispiele in `hooks-contract`, `dod-triggers` und `feature-new.test`. Sie werden **auf die neue Domäne umgestellt**, nicht gelöscht.
- Schema: `0001_init` ist gesperrt ([db/CLAUDE.md](db/CLAUDE.md)). Die Tabellen verschwinden über eine **neue** Migration mit `DROP TABLE` (`/migration`), dazu der Squash-Fold (`db/squashed-schema/notes.js` weg).
- Frontend: Registry-Eintrag, Karte, Fachmodul, Partial, Entity-CSS, Harness + Spec, i18n-Bereiche in **beiden** Locales, DESIGN.md-Inventar, Dev-Seed ([lib/dev-seed.js](lib/dev-seed.js)). `feature-registry.test` meldet, was fehlt.
- Die Verweise auf `note` in [CLAUDE.md](CLAUDE.md), den nested `CLAUDE.md` und `.claude/commands/` auf das eigene Feature als neues Muster umschreiben.
- Gate: `npm test`.
