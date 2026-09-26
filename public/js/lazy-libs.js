// On-demand loader for the big feature libs (Chart.js ~200 KB, SortableJS
// ~45 KB). They load at first use via a <script> tag — never on page load, and
// never as a <script> in index.html. Self-hosted UMD builds under
// public/vendor/ (scripts/vendor-sync.js rewrites the paths on a bump).
// DESIGN.md → "Vendor-Libs".

const cache = new Map();

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`script failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

// Resolves with the lib's global once it really exists. `onload` only means
// "the file ran" — a truncated response fires it too, and a cached promise of
// `undefined` would break every later call until reload. So: throw, drop the
// cache entry, and let the next call retry.
function loadGlobal(src, pick) {
  const ready = pick();
  if (ready) return Promise.resolve(ready);
  if (!cache.has(src)) {
    cache.set(src, loadScript(src)
      .then(() => {
        const g = pick();
        if (!g) throw new Error(`loaded but global missing: ${src}`);
        return g;
      })
      .catch((err) => { cache.delete(src); throw err; }));
  }
  return cache.get(src);
}

export function loadChart() {
  return loadGlobal('/vendor/chart-4.5.1.umd.min.js', () => window.Chart);
}

export function loadSortable() {
  return loadGlobal('/vendor/sortable-1.15.6.min.js', () => window.Sortable);
}
