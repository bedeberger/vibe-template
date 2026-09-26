// Notes — domain module of the feature (the "Fachmodul"). Methods spread into
// the feature card (js/cards/notes-card.js); `this` is the card. Keep API calls
// and data rules here, markup wiring in the card, pure computations in plain
// exported functions (unit-testable without Alpine).

import { api } from '../utils.js';
import { t } from '../i18n.js';
import { attachSortable, moveItem } from '../components/sortable-list.js';
import { notebookCounts, mountNotesChart } from './notes-chart.js';

// Pure: the list order the view shows — the manual order (drag & drop),
// ties by id. The API already sends it this way; the mock and optimistic
// inserts rely on it.
export function sortNotes(notes) {
  return [...notes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
}

export const notesMethods = {
  async loadNotebooks() {
    this.loading = true;
    try {
      this.notebooks = await api('/api/notebooks');
      const keep = this.notebooks.some((nb) => nb.id === this.currentNotebookId);
      await this.selectNotebook(keep ? this.currentNotebookId : this.notebooks[0]?.id ?? null);
    } finally {
      this.loading = false;
    }
  },

  async selectNotebook(id) {
    this.currentNotebookId = id;
    await this.loadNotes();
  },

  async loadNotes() {
    this.notes = this.currentNotebookId
      ? sortNotes(await api(`/api/notes?notebook_id=${this.currentNotebookId}`))
      : [];
  },

  async addNote() {
    const title = this.newNoteTitle.trim();
    if (!title || !this.currentNotebookId) return;
    const note = await api('/api/notes', {
      method: 'POST',
      body: { notebook_id: this.currentNotebookId, title, body: '' },
    });
    this.notes.unshift(note);
    this.newNoteTitle = '';
  },

  // Listens for the item card's note-removed event.
  removeNote(id) {
    this.notes = this.notes.filter((n) => n.id !== id);
  },

  // ── New notebook (anchored popover, DESIGN.md → "Popover") ──────────────
  openNotebookForm() {
    this.newNotebookName = '';
    this.notebookFormOpen = true;
  },

  async createNotebook() {
    const name = this.newNotebookName.trim();
    if (!name) return;
    const nb = await api('/api/notebooks', { method: 'POST', body: { name } });
    this.notebooks.push({ ...nb, note_count: 0 });
    this.notebookFormOpen = false;
    await this.selectNotebook(nb.id);
  },

  // ── Drag & drop order (DESIGN.md → "Sortierbare Liste") ─────────────────
  async setupSortable() {
    this._sortableOff = await attachSortable(this.$refs.noteList, {
      handle: '.note-drag-handle',
      onReorder: (from, to) => this.reorderNotes(from, to),
    });
  },

  // Optimistic: the list moves at once; on failure the server order returns.
  async reorderNotes(from, to) {
    this.notes = moveItem(this.notes, from, to);
    this.reorderError = '';
    try {
      await api(`/api/notebooks/${this.currentNotebookId}/note-order`, {
        method: 'PUT',
        body: { ids: this.notes.map((n) => n.id) },
      });
    } catch (e) {
      console.error('[notes] reorder failed', e);
      this.reorderError = t('notes.reorderFailed');
      await this.loadNotes();
    }
  },

  // ── Overview chart (collapsible, DESIGN.md → "Klappbare Sektion") ───────
  _chartData() {
    return notebookCounts(this.notebooks, this.currentNotebookId, this.notes.length);
  },

  // Built on first open (Chart.js loads only then), updated afterwards.
  async renderChart() {
    if (!this.overviewOpen) return;
    if (this._chart) { this._chart.update(this._chartData()); return; }
    this._chart = await mountNotesChart(this.$refs.notesChart, this._chartData(), t('notes.chartSeries'));
  },

  destroyExtras() {
    this._sortableOff?.();
    this._chart?.destroy();
    this._sortableOff = null;
    this._chart = null;
  },
};
