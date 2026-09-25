// Lazy partial loading for feature hosts. index.html renders one
// <section data-feature="<id>"> per registry entry (x-for over FEATURES); the
// feature's partial is fetched on FIRST open and injected there. Alpine's
// mutation observer initializes the injected tree (x-data="<card>").
//
// Nested partials: an element <div data-partial="notes/list"> inside a partial
// is resolved (recursively) BEFORE the HTML is inserted, so Alpine sees the
// complete tree at once — no half-initialized card.

const loaded = new Map(); // id -> Promise<void>

async function fetchPartial(name) {
  const r = await fetch(`/partials/${name}.html`);
  if (!r.ok) throw new Error(`partial ${name} unavailable (${r.status})`);
  return r.text();
}

// Resolve [data-partial] placeholders inside a detached template, recursively.
async function resolveNested(root, depth = 0) {
  if (depth > 5) throw new Error('partial nesting deeper than 5 — cycle?');
  const els = [...root.querySelectorAll('[data-partial]')];
  await Promise.all(els.map(async (el) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = await fetchPartial(el.dataset.partial);
    await resolveNested(tpl.content, depth + 1);
    el.replaceChildren(tpl.content);
    el.removeAttribute('data-partial');
  }));
}

// Load feature.partial into its host once. Returns the same promise on repeat.
export function ensurePartial(feature) {
  if (!loaded.has(feature.id)) {
    loaded.set(feature.id, (async () => {
      const host = document.querySelector(`[data-feature="${feature.id}"]`);
      if (!host) throw new Error(`no host <section data-feature="${feature.id}">`);
      const tpl = document.createElement('template');
      tpl.innerHTML = await fetchPartial(feature.partial);
      await resolveNested(tpl.content);
      host.replaceChildren(tpl.content);
    })().catch((e) => { loaded.delete(feature.id); throw e; }));
  }
  return loaded.get(feature.id);
}
