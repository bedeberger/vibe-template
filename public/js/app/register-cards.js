// ★ Card inventory — the ONE place every Alpine.data component and magic is
// registered (SSoT: "which cards exist?" is answered by reading this file).
// Called once from js/app.js before Alpine.start(); fixture harnesses call it
// too, so they mount exactly what the app mounts.
//
// A new feature card: `export function register<X>Card(Alpine)` in
// js/cards/<id>-card.js, imported and called here (`npm run feature:new` does it).

import { registerCombobox } from '../components/combobox.js';
import { registerNotesCard } from '../cards/notes-card.js';
import { registerNoteItemCard } from '../cards/note-item-card.js';
// @register-cards:imports

export function registerCards(Alpine) {
  // $app — the root scope from any card template ($root is the NEAREST x-data,
  // i.e. the card itself). In JS use window.__app (set in the root's init).
  Alpine.magic('app', () => window.__app);

  // Shared form components (DESIGN.md → "Combobox").
  registerCombobox(Alpine);

  registerNotesCard(Alpine);
  registerNoteItemCard(Alpine);
  // @register-cards:calls
}
