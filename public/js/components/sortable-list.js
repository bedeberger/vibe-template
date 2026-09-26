// Sortable list — drag & drop reorder of an Alpine x-for list via SortableJS
// (lazy, js/lazy-libs.js). DESIGN.md → "Sortierbare Liste".
//
//   <div x-ref="list">                        ← container; its x-for items are the draggables
//     <template x-for="item in items" :key="item.id"> <article>… <button class="drag-handle">…
//
//   this._sortableOff = await attachSortable(this.$refs.list, {
//     handle: '.drag-handle',
//     onReorder: (from, to) => { … move items[from] to `to`, persist … },
//   });
//   destroy() { this._sortableOff?.(); }
//
// The core conflict: SortableJS moves DOM nodes, x-for believes it owns them.
// Left alone, the next render duplicates or orphans nodes. So on drop this
// helper puts the node BACK and only reports the indices — the caller mutates
// the array and x-for renders the new order (the vuedraggable / x-sort way).
//
// Ported from schreibwerkstatt (public/js/sortable-dnd.js), reduced to one flat
// list; nested boards and cross-list groups stay out.

import { loadSortable } from '../lazy-libs.js';

// Tuned against "neighbour jumps while dragging" and HTML5-DnD quirks:
// forceFallback = a consistent clone ghost instead of native DnD, 5 px before
// a drag starts (a click on the handle stays a click), swap at 65 % overlap.
const OPTS = Object.freeze({
  animation: 150,
  forceFallback: true,
  fallbackOnBody: true,
  fallbackTolerance: 5,
  swapThreshold: 0.65,
  direction: 'vertical',
  revertOnSpill: true,
  ghostClass: 'sortable-ghost',
  chosenClass: 'sortable-chosen',
});

// Index among the draggables — skips <template> (x-for's anchor is the first
// child), which is how SortableJS counts oldIndex/newIndex.
function indexOf(el) {
  let i = 0;
  for (let cur = el.previousElementSibling; cur; cur = cur.previousElementSibling) {
    if (cur.tagName !== 'TEMPLATE') i++;
  }
  return i;
}

// Undo SortableJS's DOM move: the node goes back to slot oldIndex.
function revert({ item, from, oldIndex }) {
  if (item.parentNode === from && indexOf(item) === oldIndex) return;
  let ref = null;
  let i = 0;
  for (const child of from.children) {
    if (child === item || child.tagName === 'TEMPLATE') continue;
    if (i === oldIndex) { ref = child; break; }
    i++;
  }
  from.insertBefore(item, ref);
}

// Entry animations (e.g. `.card`'s cardFadeIn) restart whenever a node is
// re-inserted — and SortableJS re-inserts a neighbour on every swap, the drop
// (revert + x-for re-render) moves nodes again, and the fallback clone is a
// fresh node too. Each of those would fade in from opacity 0 mid-drag. So on
// pointer down every current item is marked settled (CSS: animation: none);
// the mark stays, since removing it would replay the animation. Nodes x-for
// creates later (new item, other notebook) still get their entry animation.
function settle(list) {
  for (const child of list.children) {
    if (child.tagName !== 'TEMPLATE') child.setAttribute('data-sort-settled', '');
  }
}

// Resolves with a detach function. `onReorder(from, to)` fires only for a
// real move; the DOM is already back in the model's order when it runs.
export async function attachSortable(el, { handle, onReorder }) {
  const Sortable = await loadSortable();
  const sortable = Sortable.create(el, {
    ...OPTS,
    handle,
    // x-ignore on the chosen node BEFORE the fallback ghost is cloned from it
    // (onChoose = pointer down; onStart would be too late): the ghost lands in
    // <body>, and Alpine would evaluate its bindings outside their x-for scope.
    onChoose: (evt) => {
      settle(el);
      evt.item.setAttribute('x-ignore', '');
    },
    onUnchoose: (evt) => evt.item.removeAttribute('x-ignore'),
    onEnd: (evt) => {
      revert(evt);
      if (evt.oldIndex !== evt.newIndex) onReorder(evt.oldIndex, evt.newIndex);
    },
  });
  return () => sortable.destroy();
}

// Pure: the array after moving index `from` to `to` (unit-testable).
export function moveItem(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
