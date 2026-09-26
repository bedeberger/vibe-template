# CSS-Befunde — das Messprotokoll des `css`-Skills

**Nur Zahlen, Daten und Verweise.** Kein Pattern, keine Begründung, keine
Designentscheidung — die gehören in [DESIGN.md](DESIGN.md) (ein zweiter Katalog
wäre der falsche). Gemessen mit `node .claude/skills/css/audit.mjs`. Eine Zeile
pro Session, in der sich etwas Messbares bewegt hat. Neueste oben.

| Datum | Regelzeilen | Blöcke | gzip (nackt / auf Disk) | Verwaiste Tokens | Körper ≥3× |
|---|---|---|---|---|---|
| 2026-09-25 | 1817 | 313 | 10,0 / 21,2 kB | 0 (+26 template reserve) | 0 |

> **2026-09-25 — Baseline.** Designsystem aus schreibwerkstatt portiert, Notizen
> als einziges Feature. Die 26 Reserve-Tokens sind die Designskala, die das
> Beispiel noch nicht liest (`TOKEN_RESERVE` in audit.mjs). Offener Hebel: der
> 8×-Flex-Cluster `flex/row/center/gap:--space-sm` — gegen `.row` prüfen, bevor
> ein drittes Feature ihn kopiert.
