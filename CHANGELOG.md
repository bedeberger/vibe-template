# Changelog

Jede veröffentlichte Version erhält hier einen Abschnitt (geschrieben von
`/release`, siehe [.claude/commands/release.md](.claude/commands/release.md)).
Neueste zuerst; Gruppen `Neu` / `Verbessert` / `Behoben`, ein Eintrag je
Änderung, die ein Benutzer oder Betreiber bemerkt — nicht je Commit.

## [Unreleased]

### Neu

- Lokale Benutzerverwaltung (Muster aus der Schreibwerkstatt), jetzt das
  Standard-Anmeldeverfahren: der Admin legt in der neuen **Admin-Sicht →
  Benutzer** Konten mit einem Initialpasswort an, das bei der ersten Anmeldung
  ersetzt werden muss, und kann sperren, zurücksetzen und löschen. Der Admin
  selbst meldet sich nur mit `ADMIN_EMAIL` + `ADMIN_PASSWORD` aus der `.env` an
  (nie in der DB). Die App hat damit zwei Sichten, User und Admin, mit einem
  Umschalter in der Kopfzeile. OIDC bleibt als Alternative. Details:
  docs/auth.md.

- **Admin-Sicht → Einstellungen** mit Tabs (Allgemein, Anmeldung, Jobs): Zeitzone,
  Login-Methode, OIDC-Issuer/Client-ID/Redirect-URI und die Aufbewahrung
  erledigter Jobs stellt der Admin jetzt in der App ein, wirksam sofort, ohne
  Neustart. **Betreiber:** `APP_TIMEZONE`, `AUTH_METHOD`, `OIDC_ISSUER`,
  `OIDC_CLIENT_ID`, `OIDC_REDIRECT_URI` und `JOBS_RETENTION_DAYS` werden nicht
  mehr gelesen — nach dem Update in der Konsole setzen und aus der `.env`
  entfernen. In der `.env` bleiben nur Secrets, Bootstrap-Werte und Schalter
  pro Prozess (`.env.example`).

- Weitere Browser-Libraries aus der Schreibwerkstatt, jede mit einem Einsatz
  im Notizen-Beispiel: Notizen lassen sich per Drag & Drop umsortieren
  (SortableJS, die Reihenfolge wird gespeichert), ein neues Notizbuch entsteht
  in einem Popover neben der Auswahl (Alpine anchor + focus), eine klappbare
  **Übersicht** zeigt die Notizen pro Notizbuch als Diagramm (Alpine collapse +
  Chart.js), lange Notizen sind gekürzt mit „Mehr anzeigen" (Alpine resize).
  Chart.js und SortableJS laden erst bei Bedarf. **Betreiber:** Migration 0003
  ergänzt `notes.position` und übernimmt die bisherige Reihenfolge.

- Combobox statt `<select>` (aus der Schreibwerkstatt portiert): ein
  durchsuchbares Auswahlfeld mit Tastatur-Navigation, optional Mehrfachauswahl,
  Zweitzeile, Gruppen und Footer-Aktion. Die Notizbuch-Wahl nutzt sie bereits.

- Cron-Scheduler im Server-Prozess: ein Job-Typ bekommt mit
  `registerSchedule(TYPE, '15 3 * * *')` einen Zeitplan in der App-Zeitzone. Er
  läuft über die bestehende Job-Queue, mit Dedup und ohne neue Abhängigkeit.
  Abschalten mit `SCHEDULER=off`.
- Zeitgesteuerter Job `jobs-cleanup` (täglich 03:15): löscht erledigte Jobs, die
  älter als `JOBS_RETENTION_DAYS` (Standard 30) sind.
