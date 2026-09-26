'use strict';
// Migration 0003 — manual note order within a notebook (drag & drop in the UI).
// `position` is ascending, smallest on top; the backfill keeps today's order (newest
// update first). No FK involved; the existing idx_notes_notebook_id serves the
// per-notebook ORDER BY.

module.exports = {
  version: 3,
  name: 'note_position',
  up(db) {
    db.exec(`
      ALTER TABLE notes ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

      UPDATE notes SET position = (
        SELECT COUNT(*) FROM notes n2
        WHERE n2.notebook_id = notes.notebook_id
          AND (n2.updated_at > notes.updated_at
               OR (n2.updated_at = notes.updated_at AND n2.id > notes.id))
      );
    `);
  },
};
