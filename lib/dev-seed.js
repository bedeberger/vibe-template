'use strict';
// Seed data for LOCAL_DEV_MODE. Runs only when the dev flag is on AND the DB is
// empty (idempotent via COUNT check), so a fresh `git clone && npm start` lands
// on a populated UI without any manual setup.

const noteStore = require('./note-store');
const logger = require('../logger');

function runDevSeedIfNeeded() {
  if (process.env.LOCAL_DEV_MODE !== '1') return;
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
  logger.info('Dev-Seed angelegt (LOCAL_DEV_MODE).');
}

module.exports = { runDevSeedIfNeeded };
