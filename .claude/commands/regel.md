---
description: Eine neue harte Regel (Architektur-Invariante) anlegen — Gate-Test zuerst (rot), dann die Regel am richtigen Ort, dann die Durchsetzungs-Zeile
argument-hint: "[was soll gelten, und warum]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm run test:unit:*), Bash(node --test:*), Bash(git status:*), Bash(git log:*)
---

Du legst eine neue **harte Regel** an: **$ARGUMENTS**

> Eine Regel besteht aus **drei** Artefakten, und der naheliegende Handgriff
> schreibt nur das erste hin: die Regel (mit ihrem **Why**), ihr **Gate-Test**,
> und ihre Zeile in der Tabelle „Mechanisch durchgesetzt" der Root-[CLAUDE.md](CLAUDE.md).
> Eine Regel ohne Test ist eine Meinung; ein Test ohne Regel ist ein Rätsel für
> den Nächsten, der ihn rot sieht.

## 0. Ist es überhaupt eine harte Regel?

Alle drei Fragen müssen mit **ja** beantwortet sein — sonst gehört die Sache
woanders hin (die häufigere Antwort):

1. **Fällt die Verletzung STUMM aus?** Eine harte Regel schützt vor dem Fehler,
   der aussieht wie Erfolg: die leere Stelle im Bildschirm, der Guard, der offen
   durchfällt, die zweite Fassung derselben Baugruppe. Was beim nächsten Aufruf
   ohnehin kracht, braucht keine Regel.
2. **Ist sie MECHANISCH prüfbar?** Kannst du den Test nicht schreiben, ist die
   Regel noch nicht scharf genug — dann die Regel schärfen, nicht die Prüfung
   weicher machen.
3. **Wo gilt sie?** Im ganzen Baum → Root-[CLAUDE.md](CLAUDE.md) „Harte Regeln".
   Nur in einem Verzeichnis → dessen `CLAUDE.md` (Tabelle „Wo die Regeln liegen").

Ist es **UI** → [DESIGN.md](DESIGN.md) (dort zuerst dokumentieren, dann bauen).
Ist es **Fachlichkeit** (eine Formel, ein Datenmodell) → das `docs/`-Dokument des
Themas. Bei Unklarheit **fragen, nicht raten**.

## 1. Der Gate-Test — zuerst, und er muss ROT sein

- Datei `tests/unit/<kebab-name>.test.mjs`; Muster von einem bestehenden
  Struktur-Gate übernehmen ([architecture-tripwire](tests/unit/architecture-tripwire.test.mjs),
  [schema-integrity](tests/unit/schema-integrity.test.mjs),
  [i18n-locale-parity](tests/unit/i18n-locale-parity.test.mjs)).
- Geteilte Erkennungslogik (die auch ein Hook braucht) gehört nach
  [scripts/hooks/_rules.js](scripts/hooks/_rules.js), nicht zweimal hin.
- **Ausnahmen als Allowlist im Test**, nie als Heuristik — jede mit ihrer
  Begründung als Kommentar. Bestand, der die Regel verletzt: Ratsche (die Liste
  darf nur schrumpfen).
- Die `assert`-Meldung sagt, **was zu tun ist**, nicht nur, was falsch ist.
- **Mutationsprüfung:** einmal von Hand brechen, `node --test tests/unit/<name>.test.mjs`
  rot sehen, zurücknehmen. Ein Gate, das nie rot war, prüft nichts.

Braucht die Regel den Browser, kommt ein Spec dazu (Harness in `tests/e2e/` oder
echte App in `tests/e2e-app/`) — der Unit-Test bleibt als schnelles Netz.

## 2. Die Regel

Ein Bullet am richtigen Ort (Schritt 0.3), im Stil der Nachbarn:

```markdown
- **<Titel als Aussage>.** <Ein bis drei Sätze: was gilt, was die Ausnahme ist,
  wo die Sache steht.> **Why:** <welcher naheliegende Handgriff sie kippt, und
  was dann stumm passiert>.
```

Keine Historie, keine erfundene Zahl — ist kein Messwert da, den **Fehlermodus**
hinschreiben. Thematisch bei den Nachbarn einsortieren, nicht ans Ende.

## 3. Die Durchsetzungs-Zeile

Eine Zeile in der Tabelle „Mechanisch durchgesetzt" der Root-[CLAUDE.md](CLAUDE.md):
`| Regel | <Hook falls vorhanden> · <name>.test | <wo> |`. Soll zusätzlich ein Hook
am Edit warnen, ihn in [scripts/hooks/](scripts/hooks/) ergänzen (Logik aus
`_rules.js`) und in [hooks-contract.test.mjs](tests/unit/hooks-contract.test.mjs)
festnageln.

## 4. Abnahme

`npm run test:unit` grün. Macht der neue Gate bestehenden Code rot: das ist der
Normalfall und die eigentliche Arbeit — Bestand nachziehen (im selben Zug) oder
Allowlist-Eintrag mit Begründung. **Nicht** die Prüfung aufweichen, bis es grün ist.

## 5. Melden

Knapp: die Regel in einem Satz, wo ihre drei Artefakte liegen, was der Gate
prüft und was **nicht**, wie viele Stellen im Bestand er rot gemacht hat und wie
sie aufgelöst wurden. **Nicht committen.**
