// Hash router: #<feature-id>[/<sub>] ↔ root.activeFeature / root.featureSub.
// Deep links and the browser back button work; the ROUTER only splits the hash,
// the FEATURE validates its sub and owns the fallback.
//
// parseHash/hashFor are pure and import-free (unit-tested in
// tests/unit/router.test.mjs); setupRouting wires them to the window.

export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const [id = '', ...rest] = raw.split('/');
  return { id: decodeURIComponent(id), sub: rest.map(decodeURIComponent).join('/') };
}

export function hashFor(id, sub = '') {
  return `#${encodeURIComponent(id)}${sub ? `/${sub.split('/').map(encodeURIComponent).join('/')}` : ''}`;
}

// `open(id, sub)` is the root's openFeature; unknown ids fall back to the default.
export function setupRouting(root, { isKnown, fallback }) {
  const apply = () => {
    const { id, sub } = parseHash(location.hash);
    root.openFeature(isKnown(id) ? id : fallback, isKnown(id) ? sub : '', { fromHash: true });
  };
  window.addEventListener('hashchange', apply);
  apply();
}
