'use strict';
// npm run feature:new -- <id> [--label-de "…"] [--label-en "…"] [--icon <sprite-id>] [--dry-run]
//
// Scaffolds a complete frontend feature from scripts/templates/feature/ — the
// anatomy of DESIGN.md → "Feature anatomy", exactly what
// tests/unit/feature-registry.test.mjs (scripts/feature-anatomy.js) demands:
//
//   public/js/cards/<id>-card.js      feature card (Alpine.data + lifecycle + register fn)
//   public/js/<id>/<id>-methods.js    domain module
//   public/partials/<id>.html         partial, root = the card
//   public/css/entities/<id>.css      feature CSS
//   tests/fixtures/<id>-harness.html  fixture harness (stylesheets = index.html)
//   tests/e2e/<id>-card.spec.js       harness spec
//
// …and registers it at every SSoT: FEATURES (features.js), the card inventory
// (register-cards.js), the entity <link> in index.html + every harness, the
// DESIGN.md CSS inventory, i18n keys in de.json AND en.json.
//
// Why a generator: the anatomy has nine places. By hand, one is forgotten —
// and most of them fail SILENTLY (an unregistered card renders nothing).
// Backend (db/lib/routes) and migrations stay manual: /feature, /migration.

const fs = require('fs');
const path = require('path');

const flag = (argv, name) => argv.includes(name);
const value = (argv, name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = (id) => camel(id).replace(/^./, (c) => c.toUpperCase());
const titleCase = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function plan(root, id, opts) {
  const R = (rel) => path.join(root, rel);
  const read = (rel) => fs.readFileSync(R(rel), 'utf8');
  const tpl = (name) => fs.readFileSync(path.join(__dirname, 'templates', 'feature', name), 'utf8');

  if (!/^[a-z][a-z0-9-]*$/.test(id || '')) throw new Error(`id muss kebab-case sein: "${id}"`);
  const card = `${camel(id)}Card`;
  const vars = {
    __ID__: id,
    __CAMEL__: camel(id),
    __PASCAL__: pascal(id),
    __CARD__: card,
    __LABEL_DE__: opts.labelDe || titleCase(id),
    __LABEL_EN__: opts.labelEn || titleCase(id),
  };
  const fill = (s) => Object.entries(vars).reduce((out, [k, v]) => out.split(k).join(v), s);

  const icon = opts.icon || 'file-text';
  if (!read('public/icons.svg').includes(`<symbol id="${icon}"`)) {
    throw new Error(`Icon "${icon}" gibt es im Sprite public/icons.svg nicht (Liste: DESIGN.md → Icon system)`);
  }
  const features = read('public/js/app/features.js');
  if (new RegExp(`id:\\s*'${id}'`).test(features)) throw new Error(`Feature "${id}" existiert bereits in features.js`);

  const cssLink = `<link rel="stylesheet" href="/css/entities/${id}.css">`;
  const indexHtml = read('public/index.html');
  const stylesheets = [...indexHtml.matchAll(/^\s*<link\s+rel="stylesheet"[^>]*>\s*$/gm)].map((m) => m[0]);

  const files = {
    [`public/js/cards/${id}-card.js`]: fill(tpl('card.js.tpl')),
    [`public/js/${id}/${id}-methods.js`]: fill(tpl('methods.js.tpl')),
    [`public/partials/${id}.html`]: fill(tpl('partial.html.tpl')),
    [`public/css/entities/${id}.css`]: fill(tpl('entity.css.tpl')),
    [`tests/fixtures/${id}-harness.html`]: fill(tpl('harness.html.tpl'))
      .replace('__STYLESHEETS__', [...stylesheets, `  ${cssLink}`].join('\n')),
    [`tests/e2e/${id}-card.spec.js`]: fill(tpl('spec.js.tpl')),
  };
  for (const rel of Object.keys(files)) if (fs.existsSync(R(rel))) throw new Error(`${rel} existiert bereits`);

  const edits = {};
  const edit = (rel, fn) => { edits[rel] = fn(edits[rel] ?? read(rel)); };
  const insertBefore = (s, marker, text, rel) => {
    const i = s.indexOf(marker);
    if (i < 0) throw new Error(`${rel}: Marker "${marker}" fehlt`);
    const lineStart = s.lastIndexOf('\n', i) + 1;
    return s.slice(0, lineStart) + text + s.slice(lineStart);
  };

  edit('public/js/app/features.js', (s) => insertBefore(s, '// @features:end',
    `  { id: '${id}', icon: '${icon}', labelKey: 'nav.${camel(id)}', card: '${card}', partial: '${id}' },\n`,
    'features.js'));
  edit('public/js/app/register-cards.js', (s) => {
    s = insertBefore(s, '// @register-cards:imports', `import { register${pascal(id)}Card } from '../cards/${id}-card.js';\n`, 'register-cards.js');
    return insertBefore(s, '  // @register-cards:calls', `  register${pascal(id)}Card(Alpine);\n`, 'register-cards.js');
  });
  edit('public/index.html', (s) => insertBefore(s, '<!-- @entity-css:end', `  ${cssLink}\n`, 'index.html'));

  // Every existing harness gets the link after its last stylesheet (the entity
  // links come last in index.html too) — harness-css-parity stays green.
  const fixtures = fs.existsSync(R('tests/fixtures')) ? fs.readdirSync(R('tests/fixtures')) : [];
  for (const h of fixtures.filter((n) => n.endsWith('-harness.html'))) {
    edit(`tests/fixtures/${h}`, (s) => {
      const links = [...s.matchAll(/^\s*<link\s+rel="stylesheet"[^>]*>\s*$/gm)];
      if (!links.length) return s;
      const last = links.at(-1);
      const end = last.index + last[0].length;
      return `${s.slice(0, end)}\n  ${cssLink}${s.slice(end)}`;
    });
  }

  // DESIGN.md CSS inventory: a row after the last entities row.
  edit('DESIGN.md', (s) => {
    const rows = [...s.matchAll(/^\| `css\/entities\/[^`]+` \|.*$/gm)];
    if (!rows.length) throw new Error('DESIGN.md: keine css/entities-Zeile im CSS-Inventar gefunden');
    const last = rows.at(-1);
    const end = last.index + last[0].length;
    return `${s.slice(0, end)}\n| \`css/entities/${id}.css\` | components | ${vars.__LABEL_EN__} feature deviations | template |${s.slice(end)}`;
  });

  // i18n: nav label + card title + empty state, in BOTH locales.
  const i18n = (locale, label, empty) => edit(`public/js/i18n/${locale}.json`, (s) => {
    const j = JSON.parse(s);
    j.nav = { ...(j.nav || {}), [camel(id)]: label };
    if (j[camel(id)]) throw new Error(`i18n ${locale}: Bereich "${camel(id)}" existiert bereits`);
    j[camel(id)] = { title: label, empty };
    return `${JSON.stringify(j, null, 2)}\n`;
  });
  i18n('de', vars.__LABEL_DE__, 'Noch keine Einträge.');
  i18n('en', vars.__LABEL_EN__, 'No entries yet.');

  return { id, card, files, edits };
}

function apply(root, p) {
  for (const [rel, content] of Object.entries(p.files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  for (const [rel, content] of Object.entries(p.edits)) fs.writeFileSync(path.join(root, rel), content);
}

module.exports = { plan, apply, camel, pascal };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const id = argv.find((a) => !a.startsWith('--') && !['--label-de', '--label-en', '--icon', '--root'].includes(argv[argv.indexOf(a) - 1]));
  const root = path.resolve(value(argv, '--root') || path.join(__dirname, '..'));
  try {
    const p = plan(root, id, { labelDe: value(argv, '--label-de'), labelEn: value(argv, '--label-en'), icon: value(argv, '--icon') });
    console.log(`Feature "${p.id}" (Karte ${p.card})`);
    for (const rel of Object.keys(p.files)) console.log(`  + ${rel}`);
    for (const rel of Object.keys(p.edits)) console.log(`  ~ ${rel}`);
    if (flag(argv, '--dry-run')) {
      console.log('\n(--dry-run: nichts geschrieben)');
    } else {
      apply(root, p);
      console.log('\nNoch zu tun: Backend (db/ → lib/<id>-store.js → routes/), Mock in tests/server.js,');
      console.log('echte Methoden in public/js/' + p.id + '/, Spec erweitern — dann `npm run test:unit && npm run test:e2e && npm run test:smoke`.');
    }
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
