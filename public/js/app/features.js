// ★ Feature registry — the single source of truth for the frontend features.
// Navigation, lazy partial loading, hash routes (#<id>[/<sub>]) and the smoke
// test all read from here. Do NOT hand-maintain parallel lists.
// See CLAUDE.md → Harte Regeln: "Feature-Registry ist SSoT"; anatomy of a
// feature: DESIGN.md → "Feature anatomy". New feature: `npm run feature:new`.
//
// Each feature:
//   id        stable key: hash route (#notes), host <section data-feature>,
//             file stem (cards/<id>-card.js, partials/<id>.html,
//             css/entities/<id>.css, js/<id>/)
//   icon      symbol id in the sprite public/icons.svg (DESIGN.md → Icons)
//   labelKey  i18n key of the nav label
//   card      Alpine.data name of the feature card (x-data at the partial root),
//             registered in js/app/register-cards.js
//   partial   partial under public/partials/ (without .html), loaded on first open

export const FEATURES = [
  { id: 'notes', icon: 'file-text', labelKey: 'nav.notes', card: 'notesCard', partial: 'notes' },
  // @features:end — `npm run feature:new` inserts above this line.
];

export const DEFAULT_FEATURE = FEATURES[0].id;

export function findFeature(id) {
  return FEATURES.find((f) => f.id === id) || null;
}
