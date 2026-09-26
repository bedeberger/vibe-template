#!/usr/bin/env node
'use strict';
// PreToolUse hook (Edit|Write|MultiEdit|Bash): checks the text about to be
// written against several Harte Regeln from CLAUDE.md BEFORE the change lands —
// the tightest feedback loop (at the edit, not in the CI gate).
//   • inline style / <style> / non-custom-prop :style in public/**/*.html|svg → BLOCK
//   • same in browser JS (template strings, el.style.x = …)                   → WARN
//   • native <select> in public/**/*.html                                      → WARN (combobox)
//   • datetime('now') in server/browser JS                                     → WARN (${NOW_ISO_SQL})
//   • raw SQL on a domain's tables outside db/ + its facade (_rules DOMAINS) → WARN (domain facade)
//   • import of db/notes.js outside the facade                                 → WARN
//   • toLocale(Date|Time)String / Intl.DateTimeFormat without tzOpts() in public/js → WARN
// Only the NEWLY written text is checked (Write.content / Edit.new_string /
// MultiEdit.edits[].new_string, for Bash the command itself), not the file.
//
// Bash: a change via `sed -i` / heredoc carries no file_path; paths come from
// _touched.js, which reads them generously from the command. Because "written"
// and "read" are indistinguishable there, Bash only ever WARNS, never blocks.
// Block = exit 2 + stderr; warnings are non-blocking additionalContext. The
// unit tests (no-inline-style, architecture-tripwire) are the binding gate —
// the rules themselves live in _rules.js, shared with those tests.

const {
  markupStyleViolations, jsStyleViolations, DATETIME_NOW_RE,
  domainAccessViolations, domainAccessMessage, stripJsComments,
} = require('./_rules.js');
const { isBash, touchedPaths, relOf, writtenText, onPayload } = require('./_touched.js');

const test = (re, s) => { re.lastIndex = 0; const hit = re.test(s); re.lastIndex = 0; return hit; };

function analyse(rel, text) {
  const blocks = [];
  const warns = [];
  if (!rel || rel.split('/').includes('vendor')) return { blocks, warns };

  const isPublicMarkup = /^public\/.+\.(?:html|svg)$/.test(rel);
  const isPublicJs = /^public\/js\/.+\.m?js$/.test(rel);
  const isCode = /\.(?:m|c)?js$/.test(rel) && !rel.startsWith('scripts/hooks/') && !rel.startsWith('tests/');
  const isServer = isCode && !rel.startsWith('public/');

  if (isPublicMarkup) {
    const v = markupStyleViolations(text);
    if (v.length) {
      blocks.push('Inline-Styles sind verboten (CLAUDE.md "Styles nur in public/css/"): '
        + `${[...new Set(v.map((x) => x.msg))].join('; ')}. CSS gehoert in ein Modul unter public/css/; `
        + 'Laufzeitwerte nur als Custom Property: :style="{ \'--progress\': pct + \'%\' }" + var(--progress) im CSS. '
        + 'Gate: tests/unit/no-inline-style.test.mjs.');
    }
    if (/<select[\s>]/i.test(text)) {
      warns.push('Natives <select>: Auswahlfelder nutzen die Combobox (public/CLAUDE.md "Combobox statt <select>") — '
        + 'leeres <div x-data="combobox(…)" x-modelable="value" x-model="…" x-effect="options = …">. '
        + 'Bewusste Ausnahme (z. B. nativer Mobile-Picker) im Markup-Kommentar begruenden.');
    }
  }

  if (isPublicJs) {
    const v = jsStyleViolations(text);
    if (v.length) {
      warns.push(`Inline-Style aus JS (${[...new Set(v.map((x) => x.msg))].join('; ')}): Klasse toggeln oder `
        + 'el.style.setProperty(\'--x\', …) + CSS-Regel — sonst wird no-inline-style.test rot.');
    }
    // Date-only APIs + Intl.DateTimeFormat; number toLocaleString() stays out.
    const dateCall = /(?:toLocale(?:Date|Time)String\s*\(|Intl\.DateTimeFormat\s*\()/;
    const offending = stripJsComments(text).split('\n')
      .some((line) => dateCall.test(line) && !/tzOpts|timeZone/.test(line));
    if (offending) {
      warns.push('Datums-Display ohne tzOpts(): toLocale*String / Intl.DateTimeFormat immer mit tzOpts() aus '
        + 'public/js/utils.js — sonst zeigt die UI die Browser-TZ statt app.timezone (CLAUDE.md "DB-Timestamps").');
    }
  }

  if (isCode) {
    const code = stripJsComments(text);
    if (test(DATETIME_NOW_RE, code)) {
      warns.push("datetime('now') gefunden: liefert kein ISO+Z → ${NOW_ISO_SQL} aus db/now.js interpolieren "
        + '(auch in Vergleichen) — sonst wird architecture-tripwire.test rot.');
    }
    if (isServer) warns.push(...domainAccessViolations(rel, code).map(domainAccessMessage));
  }

  return { blocks, warns };
}

onPayload((payload) => {
  const text = writtenText(payload);
  if (!text.trim()) process.exit(0);

  const warnOnly = isBash(payload);
  const blocks = [];
  const warns = [];
  for (const abs of touchedPaths(payload)) {
    const r = analyse(relOf(abs), text);
    if (warnOnly) warns.push(...r.blocks, ...r.warns);
    else { blocks.push(...r.blocks); warns.push(...r.warns); }
  }

  if (blocks.length) {
    process.stderr.write(`[style-guard] Aenderung blockiert:\n- ${[...new Set(blocks)].join('\n- ')}`
      + (warns.length ? `\nAusserdem: ${[...new Set(warns)].join(' | ')}` : '') + '\n');
    process.exit(2);
  }
  if (warns.length) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: (warnOnly
          ? '[style-guard] Hinweis (Aenderung per Bash — Edit/Write ist der verbindliche Weg): '
          : '[style-guard] Hinweis: ') + [...new Set(warns)].join(' | '),
      },
    }));
  }
  process.exit(0);
});
