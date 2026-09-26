// App-shell behaviour spread into the root (js/app.js): sidebar drawer
// (phone) / collapse (desktop), user menu, theme, command palette.
// State fields live in app-state.js ("State explizit deklariert"); this module
// only owns the methods. DESIGN.md → "App-Shell", "Benutzermenü",
// "Command Palette".
//
// Pure helpers (paletteMatches, initialsOf) are import-free and unit-tested
// in tests/unit/shell.test.mjs.

// Desktop breakpoint of the shell (DESIGN.md → Mobile: 960px). Below it the
// sidebar is an off-canvas drawer.
const NARROW_QUERY = '(max-width: 959.98px)';
const SIDEBAR_KEY = 'ui.sidebar';

// Theme options of the user menu, in display order (modes: js/theme-boot.js).
export const THEME_OPTIONS = [
  { mode: 'system', icon: 'monitor', labelKey: 'shell.themeSystem' },
  { mode: 'light', icon: 'sun', labelKey: 'shell.themeLight' },
  { mode: 'dark', icon: 'moon', labelKey: 'shell.themeDark' },
];

// Registry features matching a free-text query, in registry order. `label` maps
// a feature to its visible (translated) label.
export function paletteMatches(features, query, label) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return features.slice();
  return features.filter((f) => label(f).toLowerCase().includes(q) || f.id.includes(q));
}

// Avatar initials from a display name or an e-mail address (max. 2 letters).
export function initialsOf(user) {
  const src = String(user?.display_name || user?.email || '').trim();
  if (!src) return '?';
  const base = src.includes('@') && !user?.display_name ? src.split('@')[0] : src;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

function storedSidebarCollapsed() {
  try { return localStorage.getItem(SIDEBAR_KEY) === 'collapsed'; } catch { return false; }
}

export const shellMethods = {
  initShell() {
    const mq = window.matchMedia(NARROW_QUERY);
    this.isNarrow = mq.matches;
    mq.addEventListener('change', (e) => {
      this.isNarrow = e.matches;
      if (!e.matches) this.drawerOpen = false;
    });
    this.sidebarCollapsed = storedSidebarCollapsed();
    this.theme = window.uiTheme?.get() || 'system';
    // ⌘K / Ctrl+K opens the command palette from anywhere in the app.
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openPalette();
      }
    });
  },

  // Methods, not getters: a spread (`...shellMethods`) would freeze a getter's
  // value at spread time.
  userInitials() { return initialsOf(this.user); },
  shortcutLabel() {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    return this.t(mac ? 'shell.shortcutMac' : 'shell.shortcutOther');
  },

  // --- sidebar ---
  toggleSidebar() {
    if (this.isNarrow) {
      this.drawerOpen = !this.drawerOpen;
      return;
    }
    this.sidebarCollapsed = !this.sidebarCollapsed;
    try { localStorage.setItem(SIDEBAR_KEY, this.sidebarCollapsed ? 'collapsed' : 'expanded'); } catch { /* ignore */ }
  },
  closeDrawer() { this.drawerOpen = false; },

  // --- user menu + theme ---
  setTheme(mode) {
    this.theme = window.uiTheme ? window.uiTheme.set(mode) : mode;
  },

  // --- command palette ---
  paletteResults() {
    const visible = this.features.filter((f) => this.canSee(f));
    return paletteMatches(visible, this.paletteQuery, (f) => this.t(f.labelKey));
  },
  openPalette() {
    this.userMenuOpen = false;
    this.paletteQuery = '';
    this.paletteIndex = 0;
    this.paletteOpen = true;
    const dlg = this.$refs.palette;
    if (dlg && !dlg.open) dlg.showModal();
  },
  closePalette() {
    const dlg = this.$refs.palette;
    if (dlg?.open) dlg.close();
    this.paletteOpen = false;
  },
  movePalette(step) {
    const n = this.paletteResults().length;
    if (!n) return;
    this.paletteIndex = (this.paletteIndex + step + n) % n;
  },
  choosePalette(feature = this.paletteResults()[this.paletteIndex]) {
    if (!feature) return;
    this.closePalette();
    this.openFeature(feature.id);
  },
};
