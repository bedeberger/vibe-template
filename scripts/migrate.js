'use strict';
// Standalone migration run. Importing db/schema plays the chain (fresh DB:
// squash + stamp; existing DB: pending migrations). Exactly the same path as the
// server boot (server.js imports db/schema), but as its own visible step: if a
// migration fails, this process aborts before any server comes up.
//
//   npm run db:migrate

require('dotenv').config();
const { currentVersion } = require('../db/migrations');
const { db } = require('../db/schema'); // the import plays the chain

console.log(`DB-Migrationen aktuell — Schema-Version v${currentVersion(db)}.`);
