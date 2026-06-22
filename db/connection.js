'use strict';
// Single better-sqlite3 connection, shared process-wide.
// PRAGMAs mirror a local-first, single-writer setup. foreign_keys=ON is
// non-negotiable (see CLAUDE.md → Harte Regeln: relationale Integrität).

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_PATH || path.join(__dirname, '..', 'app.db');

// better-sqlite3 will not create missing parent directories — ensure them so a
// configured DB_PATH on a fresh volume (or a temp test path) just works.
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('temp_store = MEMORY');

module.exports = { db, DB_FILE };
