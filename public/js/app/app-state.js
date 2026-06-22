// Root-scope state. All fields are declared up front (no lazy this._x).
// See CLAUDE.md → Harte Regeln: "State explizit deklariert".

import { DEFAULT_FEATURE } from './features.js';

export function initialState() {
  return {
    ready: false,          // gates the UI until i18n + initial data loaded
    sessionExpired: false, // set by the global 401 handler
    user: null,
    activeFeature: DEFAULT_FEATURE,
    notebooks: [],
    currentNotebookId: null,
    notes: [],
    newNoteTitle: '',
  };
}
