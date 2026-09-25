# CSS findings — the measurement log of the `css` skill

**Numbers, dates and pointers only.** No pattern, no rationale, no design
decision — those belong in [DESIGN.md](DESIGN.md) (a second catalog would be the
wrong one). Measured with `node .claude/skills/css/audit.mjs`. One line per
session in which something measurable moved. Newest on top.

| Date | Rule lines | Blocks | gzip (bare / on disk) | Orphaned tokens | Bodies ≥3× |
|---|---|---|---|---|---|
| 2026-09-25 | 1817 | 313 | 10,0 / 21,2 kB | 0 (+26 template reserve) | 0 |

> **2026-09-25 — baseline.** Design system ported from schreibwerkstatt, notes
> as the only feature. The 26 reserve tokens are the design scale the example
> doesn't read yet (`TOKEN_RESERVE` in audit.mjs). Open lever: the 8× flex
> cluster `flex/row/center/gap:--space-sm` — check it against `.row` before a
> third feature copies it.
