'use strict';
// Seed data for LOCAL_DEV_MODE. Runs only when the dev flag is on AND the
// respective table is empty (idempotent), so a fresh `git clone && npm start`
// lands on a populated UI without any manual setup.
//
// Seeds the DIFFERENCES the UI has to show, not five identical rows: a note
// with markup in its body (escaping), a long one (clamp + "show more"), a
// second notebook (overview chart), one local user still on an initial
// password and one disabled user (admin console).

const noteStore = require('./note-store');
const users = require('./user-store');
const logger = require('../logger');

// Known on purpose — dev only. Log in on /login with it to try the
// must-change flow (after LOCAL_DEV_MODE is switched off, or via /auth/logout).
const DEV_INITIAL_PASSWORD = 'dev-passwort-123';

function seedNotes() {
  if (noteStore.listNotebooks().length > 0) return;
  const nb = noteStore.createNotebook('Beispiel-Notizbuch');
  noteStore.createNote({
    notebookId: nb.id,
    title: 'Willkommen',
    body: 'Dies ist eine Seed-Notiz. Bearbeite oder lösche sie. Der Body wird beim Rendern escaped — probier <b>HTML</b> aus.',
  });
  noteStore.createNote({
    notebookId: nb.id,
    title: 'Zweite Notiz',
    body: 'Notizen gehören zu einem Notizbuch (FK ON DELETE CASCADE).',
  });
  noteStore.createNote({
    notebookId: nb.id,
    title: 'Lange Notiz',
    body: [
      'Lange Notizen sind auf vier Zeilen gekürzt — „Mehr anzeigen" klappt sie auf.',
      'Die Reihenfolge lässt sich am Griff in der Aktionszeile ziehen.',
      'Die „Übersicht" zeigt die Notizen pro Notizbuch als Diagramm.',
      'Ein neues Notizbuch legt der Ordner-Knopf neben der Auswahl an.',
      'Diese Zeile ist nur da, damit die Notiz länger als vier Zeilen ist.',
    ].join('\n'),
  });
  // A second notebook with a different count: the overview chart compares.
  const ideas = noteStore.createNotebook('Ideen');
  noteStore.createNote({ notebookId: ideas.id, title: 'Idee', body: 'Ein zweites Notizbuch mit einer Notiz.' });
  logger.info('Dev-Seed: Notizen angelegt.');
}

async function seedUsers() {
  if (users.listUsers().some((u) => !u.env_managed)) return;
  await users.createUser({ email: 'anna@local', displayName: 'Anna Beispiel', password: DEV_INITIAL_PASSWORD });
  await users.createUser({ email: 'ben@local', displayName: 'Ben Gesperrt', password: DEV_INITIAL_PASSWORD });
  users.updateUser('ben@local', { status: 'disabled' });
  logger.info(`Dev-Seed: Benutzer angelegt (Initialpasswort "${DEV_INITIAL_PASSWORD}").`);
}

async function runDevSeedIfNeeded() {
  if (process.env.LOCAL_DEV_MODE !== '1') return;
  seedNotes();
  await seedUsers();
}

module.exports = { runDevSeedIfNeeded, DEV_INITIAL_PASSWORD };
