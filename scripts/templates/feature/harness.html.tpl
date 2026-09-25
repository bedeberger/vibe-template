<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>__ID__ harness</title>
  <!-- Same stylesheets in the same order as public/index.html (cascade order
       must match or layout assertions lie). Gated: tests/unit/harness-css-parity.test.mjs -->
__STYLESHEETS__
</head>
<body>
  <!-- Fixture harness for the __ID__ feature: the REAL card + partial, mounted by
       tests/fixtures/_harness.js against the mock API of tests/server.js. -->
  <main class="layout-main" x-data="harnessRoot">
    <section data-feature="__ID__"></section>
  </main>
  <script type="module">
    import { mountFeature } from '/tests/fixtures/_harness.js';
    mountFeature('__ID__');
  </script>
</body>
</html>
