#!/usr/bin/env node
'use strict';
// PostToolUse hook (Edit|Write|MultiEdit|Bash): reminds of the follow-up
// artefacts CLAUDE.md requires in the SAME commit — otherwise the matching
// drift/gate test goes red in CI, or the change stays unwired/invisible. Pure
// reminders (the folds are handwork, nothing is regenerated). Silent for other
// files. The "new / not yet wired" branches are self-clearing: they fire only
// while the follow-up artefact is still missing.
//   • db/migrations/NNNN_*.js      → squash fold + SQUASHED_VERSION + squash:check + migrations:lock
//   • db/squashed-schema/*.js      → SQUASHED_VERSION + squash:check
//   • public/css/**.css (new)      → <link> in index.html (or @import for tokens/) + DESIGN.md inventory row
//   • public/partials/**.html (new, unwired) → wire it + check DESIGN.md for the pattern
//   • routes/<x>.js (new, unmounted) → server.js app.use + features.js entry
//   • public/icons.svg             → DESIGN.md "Shipped symbols" list

const fs = require('node:fs');
const path = require('node:path');
const { ROOT, walk, toRel } = require('./_rules.js');
const { touchedPaths, relOf, onPayload } = require('./_touched.js');

const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };

function remindersFor(rel) {
  const r = [];

  const mig = rel.match(/^db\/migrations\/(\d{4}_[^/]+)\.js$/);
  if (mig) {
    r.push(`db/migrations/${mig[1]}.js bearbeitet → vor dem Commit (CLAUDE.md "Add a feature" §5, docs/migrations.md):`,
      '  • DDL in das passende Segment unter db/squashed-schema/ folden',
      '  • SQUASHED_VERSION in db/squashed-schema/index.js auf die neue Nummer bumpen',
      '  • jede *_id-Spalte als FK mit Index + bewusstem ON DELETE (schema-integrity.test)',
      '  • npm run squash:check        (sonst squash-drift.test rot)',
      '  • npm run migrations:lock + db/migrations.lock.json committen (sonst migration-lock.test rot)',
      '  • forward-only: eine deployte Nummer nie umnummerieren/umschreiben');
  } else if (/^db\/squashed-schema\/.+\.js$/.test(rel)) {
    r.push('db/squashed-schema/ bearbeitet → SQUASHED_VERSION in index.js pruefen und `npm run squash:check` laufen lassen.');
  }

  const css = rel.match(/^public\/(css\/.+\.css)$/);
  if (css && !rel.includes('/vendor/')) {
    const isToken = css[1].startsWith('css/tokens/');
    const loaded = isToken
      ? read('public/css/tokens.css').includes(css[1].replace(/^css\//, './'))
      : read('public/index.html').includes(`/${css[1]}`);
    if (!loaded) {
      r.push(isToken
        ? `Neues Token-Modul public/${css[1]} → in public/css/tokens.css @importieren (kein eigener <link>).`
        : `Neue CSS-Datei public/${css[1]} ist nicht in public/index.html verlinkt → <link rel="stylesheet" href="/${css[1]}"> `
          + 'an ihrer Cascade-Position einhaengen (Reihenfolge = Cascade), Regeln in @layer components { … } wickeln.');
    }
    if (!read('DESIGN.md').includes(`\`${css[1]}\``)) {
      r.push(`  • DESIGN.md → "CSS file inventory": Zeile fuer \`${css[1]}\` ergaenzen (sonst design-css-inventory-drift.test rot).`);
    }
  }

  const partial = rel.match(/^public\/partials\/(.+)\.html$/);
  if (partial) {
    const base = partial[1];
    const wired = walk('public', ['.html', '.js']).map(toRel)
      .filter((f) => f !== rel)
      .some((f) => { const t = read(f); return t.includes(`data-partial="${base}"`) || t.includes(`${base}.html`); });
    if (!wired) {
      r.push(`Neues Partial public/partials/${base}.html (noch nirgends verdrahtet) →`,
        `  • per <section data-partial="${base}"> in index.html (bzw. im Eltern-Partial) einbinden`,
        '  • neues UI-Pattern? → erst in DESIGN.md dokumentieren (Use/Markup/Classes/Rules), dann bauen');
    }
  }

  const route = rel.match(/^routes\/([^/]+)\.js$/);
  if (route && !route[1].startsWith('_')) {
    const server = read('server.js');
    if (!server.includes(`routes/${route[1]}`)) {
      r.push(`Neuer Router routes/${route[1]}.js (in server.js nicht gemountet) →`,
        '  • in server.js via app.use(...) hinter dem Auth-Guard mounten',
        '  • FEATURES-Eintrag in public/js/app/features.js (SSoT fuer die Nav) + labelKey in de.json UND en.json',
        '  • Daten nur ueber eine Facade in lib/, Langlaeufer als Job (routes/jobs/)');
    }
  }

  if (rel === 'public/icons.svg') {
    r.push('public/icons.svg bearbeitet → neue Symbole in DESIGN.md → "Icon system" (Shipped symbols) listen, '
      + 'viewBox 0 0 24 24, keine fill/stroke-Attribute (sonst icons-sprite.test rot).');
  }

  return r;
}

onPayload((payload) => {
  const reminders = touchedPaths(payload).map(relOf).filter(Boolean).flatMap(remindersFor);
  if (reminders.length) console.log(`[drift-reminder] ${[...new Set(reminders)].join('\n')}`);
  process.exit(0);
});
