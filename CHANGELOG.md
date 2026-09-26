# Changelog

Jede veröffentlichte Version erhält hier einen Abschnitt (geschrieben von
`/release`, siehe [.claude/commands/release.md](.claude/commands/release.md)).
Neueste zuerst; Gruppen `Neu` / `Verbessert` / `Behoben`, ein Eintrag je
Änderung, die ein Benutzer oder Betreiber bemerkt — nicht je Commit.

## [Unreleased]

### Neu

- Combobox statt `<select>` (aus der Schreibwerkstatt portiert): ein
  durchsuchbares Auswahlfeld mit Tastatur-Navigation, optional Mehrfachauswahl,
  Zweitzeile, Gruppen und Footer-Aktion. Die Notizbuch-Wahl nutzt sie bereits.

- Cron-Scheduler im Server-Prozess: ein Job-Typ bekommt mit
  `registerSchedule(TYPE, '15 3 * * *')` einen Zeitplan in der App-Zeitzone. Er
  läuft über die bestehende Job-Queue, mit Dedup und ohne neue Abhängigkeit.
  Abschalten mit `SCHEDULER=off`.
- Zeitgesteuerter Job `jobs-cleanup` (täglich 03:15): löscht erledigte Jobs, die
  älter als `JOBS_RETENTION_DAYS` (Standard 30) sind.
