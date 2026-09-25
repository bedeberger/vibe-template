// Frontend entry point. No build step: Alpine is imported as an ESM module
// (vendored from node_modules at boot), so we control start order — partials
// are injected first, components registered, then Alpine.start().

import Alpine from '/vendor/alpine.esm.js';
import { initialState } from '/js/app/app-state.js';
import { FEATURES } from '/js/app/features.js';
import { configureI18n, t } from '/js/i18n.js';
import { api, setTimezone, formatDate } from '/js/utils.js';
import { noteCard } from '/js/cards/note-card.js';

// Root scope: navigation, session, i18n, and the notes data the active view
// needs. Cards are separate sub-components (cards/note-card.js).
function appRoot() {
  return {
    ...initialState(),
    features: FEATURES,
    t,
    fmt: formatDate,

    async init() {
      // Global 401 handler — show a banner instead of redirecting, so unsaved
      // input can be rescued. See CLAUDE.md → Harte Regeln: 401-Handling.
      window.addEventListener('session-expired', () => { this.sessionExpired = true; });
      try {
        const cfg = await api('/api/config');
        setTimezone(cfg.timezone);
        this.user = await api('/api/me');
        await this.loadNotebooks();
      } catch (e) {
        console.error('[app] init failed', e);
      } finally {
        this.ready = true;
      }
    },

    selectFeature(id) { this.activeFeature = id; },

    async loadNotebooks() {
      this.notebooks = await api('/api/notebooks');
      if (this.notebooks.length) await this.selectNotebook(this.notebooks[0].id);
    },

    async selectNotebook(id) {
      this.currentNotebookId = id;
      await this.loadNotes();
    },

    async loadNotes() {
      this.notes = this.currentNotebookId
        ? await api(`/api/notes?notebook_id=${this.currentNotebookId}`)
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

    // Listens for the card's note-removed event.
    removeNote(id) {
      this.notes = this.notes.filter((n) => n.id !== id);
    },
  };
}

// Replace <div data-partial="name"> placeholders with /partials/name.html before
// Alpine processes the tree. Keeps shared markup in one file (the partial).
async function loadPartials() {
  const els = [...document.querySelectorAll('[data-partial]')];
  await Promise.all(
    els.map(async (el) => {
      const r = await fetch(`/partials/${el.dataset.partial}.html`);
      el.innerHTML = await r.text();
    })
  );
}

async function boot() {
  // Load i18n + partials BEFORE Alpine starts, so the first render already has
  // translated strings (t() is resolved once, not reactively).
  await Promise.all([configureI18n('de'), loadPartials()]);
  Alpine.data('app', appRoot);
  Alpine.data('noteCard', noteCard);
  window.Alpine = Alpine;
  Alpine.start();
}

boot();
