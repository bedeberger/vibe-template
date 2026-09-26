// ★ Feature registry — the single source of truth for the frontend features.
// Navigation, lazy partial loading, hash routes (#<id>[/<sub>]) and the smoke
// test all read from here. Do NOT hand-maintain parallel lists.
// See CLAUDE.md → Harte Regeln: "Feature-Registry ist SSoT"; anatomy of a
// feature: DESIGN.md → "Feature-Anatomie". New feature: `npm run feature:new`.
//
// Each feature:
//   view      'user' | 'admin' — which of the two views shows it. The admin view
//             is reachable only for the .env admin (docs/auth.md); the server
//             enforces it independently (requireAdmin on /api/admin).
//   id        stable key: hash route (#notes), host <section data-feature>,
//             file stem (cards/<id>-card.js, partials/<id>.html,
//             css/entities/<id>.css, js/<id>/)
//   icon      symbol id in the sprite public/icons.svg (DESIGN.md → Icon-System)
//   labelKey  i18n key of the nav label
//   card      Alpine.data name of the feature card (x-data at the partial root),
//             registered in js/app/register-cards.js
//   partial   partial under public/partials/ (without .html), loaded on first open

export const FEATURES = [
  { id: 'notes', view: 'user', icon: 'file-text', labelKey: 'nav.notes', card: 'notesCard', partial: 'notes' },
  { id: 'users', view: 'admin', icon: 'users', labelKey: 'nav.users', card: 'usersCard', partial: 'users' },
  { id: 'logs', view: 'admin', icon: 'scroll', labelKey: 'nav.logs', card: 'logsCard', partial: 'logs' },
  { id: 'settings', view: 'admin', icon: 'settings', labelKey: 'nav.settings', card: 'settingsCard', partial: 'settings' },
  // @features:end — `npm run feature:new` inserts above this line.
];

export const VIEWS = ['user', 'admin'];

export const DEFAULT_FEATURE = FEATURES[0].id;

// First feature of a view — where a view switch lands.
export function firstFeatureOf(view) {
  return FEATURES.find((f) => f.view === view) || null;
}

export function findFeature(id) {
  return FEATURES.find((f) => f.id === id) || null;
}
