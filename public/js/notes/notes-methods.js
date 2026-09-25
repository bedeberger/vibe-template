// Notes — domain module of the feature (the "Fachmodul"). Methods spread into
// the feature card (js/cards/notes-card.js); `this` is the card. Keep API calls
// and data rules here, markup wiring in the card, pure computations in plain
// exported functions (unit-testable without Alpine).

import { api } from '../utils.js';

// Pure: the list order the view shows (newest update first).
export function sortNotes(notes) {
  return [...notes].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
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
};
