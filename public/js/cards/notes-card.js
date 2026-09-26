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
    notebookFormOpen: false,
    newNotebookName: '',
    overviewOpen: false,
    reorderError: '',
    _lifecycle: null,
    // Plain closures, not the lib instances (notes-methods.js / notes-chart.js).
    _sortableOff: null,
    _chart: null,

    t,
    fmt: formatDate,

    init() {
      this._lifecycle = setupCardLifecycle(this, {
        feature: 'notes',
        load: (ctx) => ctx.loadNotebooks(),
        resetState: () => ({ notebooks: [], currentNotebookId: null, notes: [], newNoteTitle: '', reorderError: '' }),
      });
      this.setupSortable();
      // The chart follows the list (add, delete, notebook switch) while open.
      this.$watch(() => [this.overviewOpen, this.notes.length, this.currentNotebookId, this.notebooks.length],
        () => this.$nextTick(() => this.renderChart()));
    },
    destroy() {
      this._lifecycle?.destroy();
      this.destroyExtras();
    },

    ...notesMethods,
  };
}

export function registerNotesCard(Alpine) {
  Alpine.data('notesCard', notesCard);
}
