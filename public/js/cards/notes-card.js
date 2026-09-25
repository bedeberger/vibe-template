// Notes — the FEATURE CARD (x-data="notesCard" at the root of
// partials/notes.html). Owns the feature's state; methods come from the domain
// module js/notes/notes-methods.js; lifecycle (load on open, refresh, reset)
// from card-lifecycle.js. List items are noteItemCard sub-components.

import { t } from '../i18n.js';
import { formatDate } from '../utils.js';
import { notesMethods } from '../notes/notes-methods.js';
import { setupCardLifecycle } from './card-lifecycle.js';

export function notesCard() {
  return {
    // state (declared up front)
    notebooks: [],
    currentNotebookId: null,
    notes: [],
    newNoteTitle: '',
    loading: false,
    _lifecycle: null,

    t,
    fmt: formatDate,

    init() {
      this._lifecycle = setupCardLifecycle(this, {
        feature: 'notes',
        load: (ctx) => ctx.loadNotebooks(),
        resetState: () => ({ notebooks: [], currentNotebookId: null, notes: [], newNoteTitle: '' }),
      });
    },
    destroy() { this._lifecycle?.destroy(); },

    ...notesMethods,
  };
}

export function registerNotesCard(Alpine) {
  Alpine.data('notesCard', notesCard);
}
