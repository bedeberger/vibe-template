'use strict';
// Playwright `test` with an automatic console-error guard. Drop-in replacement
// for `require('@playwright/test')`: specs (e2e AND e2e-app) import `test` and
// `expect` from here. An auto fixture attaches the guard (console-guard.js)
// before each test and asserts clean afterwards — every unhandled Alpine/library
// error turns the test red without each spec wiring it up.
//
//   test('…', async ({ page, consoleGuard }) => { consoleGuard.skip(); … })   // negative test
//   consoleGuard.ignore(/expected message/);                                   // known message

const base = require('@playwright/test');
const { attachConsoleGuard } = require('./console-guard');

const test = base.test.extend({
  consoleGuard: [
    async ({ page }, use, testInfo) => {
      const guard = attachConsoleGuard(page);
      await use(guard);
      // Only assert if the test didn't fail anyway — otherwise the guard error
      // would mask the actual cause.
      if (testInfo.status === testInfo.expectedStatus) guard.assertClean();
    },
    { auto: true },
  ],
});

module.exports = { test, expect: base.expect };
