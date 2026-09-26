// Note item — a sub-component of the notes feature card. Each note in the list
// is its own instance via x-data="noteItemCard(note)" (partials/notes.html);
// it owns its local edit + job state and tells the feature card about a
// deletion via the `note-removed` event.

import { api, escHtml, formatDate } from '../utils.js';
import { t } from '../i18n.js';

export function noteItemCard(note) {
  return {
    note,
    editing: false,
    draftTitle: note.title,
    draftBody: note.body,
    stats: null,
    busy: false,
    // Long body: clamped until expanded; the toggle shows only when it clips.
    bodyExpanded: false,
    bodyOverflows: false,

    t,
    fmt: formatDate,

    // x-html sink → content is escaped here (escape invariant).
    get bodyHtml() {
      return escHtml(this.note.body).replace(/\n/g, '<br>');
    },

    // x-resize on the body (DESIGN.md → "Alpine-Plugins"). Measured only while
    // clamped — expanded, nothing clips and the toggle would vanish.
    measureBody(el) {
      if (!this.bodyExpanded) this.bodyOverflows = el.scrollHeight > el.clientHeight + 1;
    },

    startEdit() {
      this.draftTitle = this.note.title;
      this.draftBody = this.note.body;
      this.editing = true;
    },

    async save() {
      this.busy = true;
      try {
        const updated = await api(`/api/notes/${this.note.id}`, {
          method: 'PATCH',
          body: { title: this.draftTitle, body: this.draftBody },
        });
        this.note = updated;
        this.editing = false;
      } finally {
        this.busy = false;
      }
    },

    async remove() {
      this.busy = true;
      try {
        await api(`/api/notes/${this.note.id}`, { method: 'DELETE' });
        this.$dispatch('note-removed', this.note.id);
      } finally {
        this.busy = false;
      }
    },

    // Enqueue the example background job and poll until it settles.
    async runStats() {
      this.busy = true;
      this.stats = null;
      try {
        let job = await api('/api/jobs', {
          method: 'POST',
          body: { note_id: this.note.id, type: 'note-stats' },
        });
        while (job.status === 'queued' || job.status === 'running') {
          await new Promise((r) => setTimeout(r, 200));
          job = await api(`/api/jobs/${job.id}`);
        }
        if (job.status === 'done') this.stats = JSON.parse(job.result_json);
        else throw new Error(job.status_text || 'job failed');
      } finally {
        this.busy = false;
      }
    },
  };
}

export function registerNoteItemCard(Alpine) {
  Alpine.data('noteItemCard', noteItemCard);
}
