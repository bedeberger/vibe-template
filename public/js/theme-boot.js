// Theme bootstrap — a CLASSIC script (not a module), loaded synchronously in
// <head> of index.html and login.html so the chosen theme is on <html> before
// the first paint (no light flash in dark mode). CSP 'self' forbids an inline
// script, hence this file.
//
// The theme is a per-device preference (localStorage), not a setting: it
// follows the OS by default ('system'); 'light' / 'dark' force it via
// <html data-theme> (css/tokens/colors.css). window.uiTheme is the ONE API —
// the shell's user menu (js/app/shell.js) reads and writes through it.
(function () {
  var KEY = 'ui.theme';
  var MODES = ['system', 'light', 'dark'];

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return MODES.indexOf(v) >= 0 ? v : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function apply(mode) {
    var root = document.documentElement;
    if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
    else root.removeAttribute('data-theme');
  }

  window.uiTheme = {
    modes: MODES,
    get: read,
    set: function (mode) {
      if (MODES.indexOf(mode) < 0) mode = 'system';
      try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode: session only */ }
      apply(mode);
      return mode;
    },
  };

  apply(read());
})();
