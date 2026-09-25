#!/usr/bin/env node
'use strict';
// Sets environment variables, then runs the actual command — the
// platform-neutral replacement for the POSIX prefix `NAME=value cmd …` in npm
// scripts.
//
// Why: npm runs scripts through cmd.exe on Windows, which doesn't know the
// prefix — `NODE_ENV=test node --test …` fails there. For test:unit and
// test:integration this is not just convenience: NODE_ENV=test arms the guard in
// db/connection.js that refuses to open the repo app.db from a test.
//
//   node scripts/with-env.js NAME=value [NAME=value …] -- <command> [args …]
//
// Deliberately no `cross-env`: a dependency for thirty lines.

const { spawn } = require('node:child_process');
const os = require('node:os');

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');

if (sep < 1 || sep === argv.length - 1) {
  console.error('with-env: Aufruf ist `node scripts/with-env.js NAME=wert [NAME=wert …] -- <befehl> [args …]`');
  process.exit(64); // EX_USAGE
}

const env = { ...process.env };
for (const pair of argv.slice(0, sep)) {
  const eq = pair.indexOf('=');
  if (eq < 1) {
    console.error(`with-env: "${pair}" ist kein NAME=wert-Paar`);
    process.exit(64);
  }
  // Always set — exactly like the shell prefix this replaces.
  env[pair.slice(0, eq)] = pair.slice(eq + 1);
}

const [command, ...args] = argv.slice(sep + 1);
// Start `node` as the SAME binary running this script: no PATHEXT lookup on
// Windows, and an nvm switch mid-run can't change it.
const bin = command === 'node' ? process.execPath : command;
const child = spawn(bin, args, { env, stdio: 'inherit', shell: false });

// Forward Ctrl+C so `node --watch` ends cleanly instead of leaving an orphan.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}

child.on('error', (err) => {
  console.error(`with-env: "${command}" konnte nicht gestartet werden — ${err.message}`);
  process.exit(127);
});

child.on('close', (code, signal) => {
  if (signal) {
    const num = os.constants.signals[signal];
    process.exit(num ? 128 + num : 1); // shell convention: 128 + signal number
  }
  process.exit(code ?? 1);
});
