// ★ Feature registry — the single source of truth for navigation, and the
// place a command palette / usage tracking would read from too. Do NOT
// hand-maintain parallel nav lists elsewhere.
// See CLAUDE.md → Harte Regeln: "Feature-Registry ist SSoT".
//
// Each feature: { id, icon, labelKey (i18n), view (matches a <section> id) }.
// Add a feature here and the nav renders it automatically.

export const FEATURES = [
  { id: 'notes', icon: '📝', labelKey: 'nav.notes', view: 'notes' },
];

export const DEFAULT_FEATURE = FEATURES[0].id;
