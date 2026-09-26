'use strict';
// npm run init -- <slug> [--title "…"] [--dry-run] [--no-test] [--fresh] [--force]
//
// Turns a fresh clone of the template into its own project. The current name
// is read from the tree (package.json#name, de.json app.title), not hardcoded —
// so the script works on the template and again on any renamed project.
//
//   title  (display name)  <title> in index.html + login.html, the login heading,
//                          manifest name/short_name, app.title in de.json AND
//                          en.json, the README heading
//   slug   (technical id)  every other occurrence in every text file: package
//                          name, systemd unit / paths / runner label defaults in
//                          prepare-lxc.sh + the workflows, docs, log line
//
// Plus the FRESH START — only on the template itself (or with --fresh):
// CHANGELOG back to [Unreleased], version 0.1.0, local app.db* / app.log (the
// template's seed data) removed. Renaming an already renamed project keeps its
// history, version and data. Refuses a dirty git tree (the rename touches
// dozens of files — mixed with other work the diff is unreviewable) unless
// --force. Afterwards `npm run test:unit` runs, unless --no-test.
//
// Why a script and not a prompt: the slug steers systemd, paths and the runner
// label — one missed spot deploys under the wrong name. Deterministic, and
// tests/unit/project-init.test.mjs proves no occurrence is left.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const flag = (argv, name) => argv.includes(name);
const value = (argv, name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Never scanned: dependencies, VCS, artefacts, secrets, local state.
const SKIP_DIRS = new Set(['.git', 'node_modules', 'test-results', 'playwright-report', '.tmp']);
const SKIP_FILE = (name) => /^app\.db/.test(name) || /\.log$/.test(name) || /^\.env(\..+)?$/.test(name) && name !== '.env.example';
// History stays history: CHANGELOG is reset below, never rewritten.
const NO_RENAME = new Set(['CHANGELOG.md']);
const LOCAL_STATE = (name) => /^app\.db(-.+)?$/.test(name) || name === 'app.log';
// The template's own name, ASSEMBLED so the slug pass can never rewrite this
// constant (it replaces every whole occurrence in every text file, this one too).
const TEMPLATE_SLUG = ['vibe', 'template'].join('-');

function textFiles(root, dir = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...textFiles(root, rel));
    } else if (e.isFile() && !SKIP_FILE(e.name)) {
      const buf = fs.readFileSync(path.join(root, rel));
      if (!buf.includes(0)) out.push(rel);
    }
  }
  return out;
}

function plan(root, slug, opts = {}) {
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug || '')) {
    throw new Error(`Slug muss kebab-case sein (Kleinbuchstaben, Ziffern, "-"): "${slug}"`);
  }
  const R = (rel) => path.join(root, rel);
  const read = (rel) => fs.readFileSync(R(rel), 'utf8');
  const pkg = JSON.parse(read('package.json'));
  const oldSlug = pkg.name;
  const oldTitle = JSON.parse(read('public/js/i18n/de.json')).app.title;
  const title = (opts.title || slug).trim();
  if (!title || /[<>"]/.test(title)) throw new Error(`Titel darf nicht leer sein und kein < > " enthalten: "${title}"`);
  const shortName = title.length <= 12 ? title : title.split(/\s+/)[0].slice(0, 12);

  const edits = {};
  const cur = (rel) => (rel in edits ? edits[rel] : read(rel));
  const edit = (rel, fn) => {
    const before = cur(rel);
    const after = fn(before);
    if (after === before) throw new Error(`${rel}: erwartete Stelle nicht gefunden — Script an die Datei anpassen`);
    edits[rel] = after;
  };

  // 1. Title spots (structural, BEFORE the slug pass — the template's title
  //    equals its slug and would otherwise become the new slug).
  if (title !== oldTitle) {
    const t = esc(oldTitle);
    edit('public/index.html', (s) => s.replace(new RegExp(`<title>${t}</title>`), `<title>${title}</title>`));
    // The login heading is x-text="t('app.title')" — covered by the i18n pass below.
    edit('public/login.html', (s) => s.replace(new RegExp(`(<title>[^<]*?)${t}(</title>)`), `$1${title}$2`));
    edit('README.md', (s) => s.replace(new RegExp(`^# ${t}$`, 'm'), `# ${title}`));
    for (const l of ['de', 'en']) {
      edit(`public/js/i18n/${l}.json`, (s) => {
        const j = JSON.parse(s);
        j.app.title = title;
        return `${JSON.stringify(j, null, 2)}\n`;
      });
    }
  }
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  if (manifest.name !== title || manifest.short_name !== shortName) {
    edits['public/manifest.webmanifest'] = `${JSON.stringify({ ...manifest, name: title, short_name: shortName }, null, 2)}\n`;
  }

  // 2. Slug everywhere else, as a whole name: "app" must not match inside
  //    "my-app-x", but must match in "${APP_NAME:-app}".
  if (slug !== oldSlug) {
    const re = new RegExp(`(?<!\\w)(?<!\\w-)${esc(oldSlug)}(?!\\w|-\\w)`, 'g');
    for (const rel of textFiles(root)) {
      if (NO_RENAME.has(rel)) continue;
      const before = cur(rel);
      const after = before.replace(re, slug);
      if (after !== before) edits[rel] = after;
    }
  }

  // 3. Fresh start: version 0.1.0, CHANGELOG without the template's releases,
  //    no template seed DB. Only on the template — a project's own releases
  //    and data are not the script's to throw away.
  const fresh = !!opts.fresh || oldSlug === TEMPLATE_SLUG;
  if (!fresh) return { oldSlug, oldTitle, slug, title, fresh, edits, remove: [] };
  const setVersion = (rel) => {
    const j = JSON.parse(cur(rel));
    if (j.version === '0.1.0') return;
    j.version = '0.1.0';
    if (j.packages && j.packages['']) j.packages[''].version = '0.1.0';
    edits[rel] = `${JSON.stringify(j, null, 2)}\n`;
  };
  setVersion('package.json');
  if (fs.existsSync(R('package-lock.json'))) setVersion('package-lock.json');
  const changelog = read('CHANGELOG.md');
  const firstRelease = changelog.search(/^## \[\d/m);
  if (firstRelease !== -1) edits['CHANGELOG.md'] = `${changelog.slice(0, firstRelease).trimEnd()}\n`;

  const remove = fs.readdirSync(root).filter(LOCAL_STATE);
  return { oldSlug, oldTitle, slug, title, fresh, edits, remove };
}

function apply(root, p) {
  for (const [rel, content] of Object.entries(p.edits)) fs.writeFileSync(path.join(root, rel), content);
  for (const rel of p.remove) fs.rmSync(path.join(root, rel), { force: true });
}

// Uncommitted changes in a git checkout? (false outside git — e.g. the tests' temp copy.)
function dirtyTree(root) {
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() !== '';
}

module.exports = { plan, apply, textFiles, TEMPLATE_SLUG };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => !a.startsWith('--') && !['--title', '--root'].includes(argv[argv.indexOf(a) - 1]));
  const root = path.resolve(value(argv, '--root') || path.join(__dirname, '..'));
  if (!slug || flag(argv, '--help')) {
    console.log('Aufruf: npm run init -- <slug> [--title "Anzeigename"] [--dry-run] [--no-test] [--fresh] [--force]\n\n'
      + '  <slug>     technischer Name, kebab-case (Paket, systemd-Unit, Pfade), z. B. invoice-hub\n'
      + '  --title    Anzeigename (Titel, Login, Manifest), Default: der Slug\n'
      + '  --dry-run  nur die betroffenen Dateien zeigen\n'
      + '  --fresh    CHANGELOG, Version, lokale DB auch auf einem schon umbenannten Projekt zurücksetzen\n'
      + '  --force    auch mit uncommitteten Änderungen laufen\n\n'
      + 'Beispiel: npm run init -- invoice-hub --title "Invoice Hub" --dry-run');
    process.exit(flag(argv, '--help') ? 0 : 1);
  }
  try {
    const p = plan(root, slug, { title: value(argv, '--title'), fresh: flag(argv, '--fresh') });
    console.log(`Projekt: ${p.oldSlug} → ${p.slug}   Titel: "${p.oldTitle}" → "${p.title}"`);
    console.log(p.fresh
      ? '  Frischstart: CHANGELOG, Version 0.1.0 und lokale DB werden zurückgesetzt.'
      : '  Nur Umbenennen: CHANGELOG, Version und lokale DB bleiben (--fresh setzt sie zurück).');
    for (const rel of Object.keys(p.edits)) console.log(`  ~ ${rel}`);
    for (const rel of p.remove) console.log(`  - ${rel}`);
    if (flag(argv, '--dry-run')) {
      console.log('\n(--dry-run: nichts geschrieben)');
      process.exit(0);
    }
    if (dirtyTree(root) && !flag(argv, '--force')) {
      throw new Error('Arbeitsbaum hat uncommittete Änderungen — erst committen (oder --force), '
        + 'sonst ist der Umbenennungs-Diff nicht von der übrigen Arbeit zu trennen.');
    }
    apply(root, p);
    console.log('\nNoch zu tun: GitHub-Variable APP_NAME=' + p.slug + ' setzen (docs/deployment.md), .env aus .env.example,');
    console.log('erstes eigenes Feature mit /feature, danach das Beispiel note/notebook entfernen (/projekt-init führt durch).');
    if (!flag(argv, '--no-test')) {
      console.log('\n→ npm run test:unit');
      const r = spawnSync('npm', ['run', 'test:unit'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
      process.exit(r.status ?? 1);
    }
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
