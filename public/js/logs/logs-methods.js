// Logs — domain module of the admin feature "logs" (docs/logging.md). Methods
// spread into the feature card (js/cards/logs-card.js); `this` is the card, so
// every field assigned here is declared in the card's initial state. Pure
// helpers are plain exports (unit-testable without Alpine).
//
// Data: /api/admin/logs (routes/admin-logs.js) — pages newest first, a cursor
// `before` = ts of the oldest shown entry; /stream pushes new entries (SSE).

import { api, formatDate } from '../utils.js';

export const LEVELS = ['error', 'warn', 'info', 'debug'];
export const PAGE_SIZE = 200;
// Live entries are prepended; beyond this the oldest drop off (memory cap).
export const LIVE_CAP = 2000;

export const emptyFilter = () => ({ level: '', scope: '', user: '', entity: '', q: '' });

export function hasFilter(f) {
  return Object.values(f || {}).some((v) => String(v || '').trim() !== '');
}

export function buildQuery(filter, before = null, limit = PAGE_SIZE) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter || {})) if (String(v || '').trim()) qs.set(k, String(v).trim());
  if (before) qs.set('before', before);
  qs.set('limit', String(limit));
  return qs.toString();
}

// Level → badge modifier (DESIGN.md → Badges).
export function levelBadge(level) {
  return { error: 'badge-err', warn: 'badge-warn' }[level] || 'badge-neutral';
}

// Scopes seen in the loaded entries, for the scope filter.
export function scopeOptions(entries) {
  return [...new Set(entries.map((e) => e.scope).filter(Boolean))].sort();
}

export const logsMethods = {
  // Stable row keys: entries carry no id, so each gets a client sequence number.
  _keyed(list) {
    return list.map((e) => ({ ...e, _k: ++this._seq }));
  },

  async loadLogs() {
    await Promise.all([this.loadPage({ append: false }), this.loadFiles()]);
    this.syncStream();
  },

  async loadPage({ append }) {
    this.loading = true;
    this.loadError = '';
    try {
      const before = append ? this.entries[this.entries.length - 1]?.ts : null;
      const page = await api(`/api/admin/logs?${buildQuery(this.appliedFilter, before)}`);
      const rows = this._keyed(page.entries);
      this.entries = append ? this.entries.concat(rows) : rows;
      this.hasMore = page.hasMore;
    } catch (e) {
      this.loadError = this.t('logs.loadError', { error: e.message });
    } finally {
      this.loading = false;
    }
  },

  async loadFiles() {
    try {
      this.files = (await api('/api/admin/logs/files')).files;
    } catch { this.files = []; }
  },

  async applyFilter() {
    this.appliedFilter = { ...this.filter };
    this.expanded = {};
    await this.loadPage({ append: false });
    this.syncStream();
  },

  async clearFilter() {
    this.filter = emptyFilter();
    await this.applyFilter();
  },

  isFiltered() { return hasFilter(this.appliedFilter); },

  // Live tail runs only while switched on, the feature is open and no filter is
  // applied (a live line would bypass the filter).
  syncStream() {
    const want = this.live && !this.isFiltered() && window.__app?.activeFeature === 'logs';
    if (want && !this._es) this.startStream();
    if (!want && this._es) this.stopStream();
  },

  startStream() {
    this.streamError = false;
    const es = new EventSource('/api/admin/logs/stream');
    this._es = es;
    es.onopen = () => { this.streamError = false; };
    es.onmessage = (ev) => {
      let entry;
      try { entry = JSON.parse(ev.data); } catch { return; }
      this.entries = this._keyed([entry]).concat(this.entries).slice(0, LIVE_CAP);
    };
    es.addEventListener('rotated', () => { this.rotated = true; this.loadFiles(); });
    // EventSource reconnects by itself; only show the state.
    es.onerror = () => { this.streamError = true; };
  },

  stopStream() {
    this._es?.close();
    this._es = null;
  },

  toggleLive() {
    this.live = !this.live;
    this.syncStream();
  },

  toggleStack(key) {
    this.expanded = { ...this.expanded, [key]: !this.expanded[key] };
  },

  download(file) {
    window.location.href = `/api/admin/logs/download?file=${encodeURIComponent(file.key)}`;
  },

  fileSize(bytes) {
    return new Intl.NumberFormat(undefined, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 }).format(bytes / 1024);
  },

  // Log ts are ISO+Z (logger.js) → app timezone, to the second.
  fmtTs(ts) {
    return formatDate(ts, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  badgeClass: levelBadge,
  // A method, not a getter: the spread into the card would evaluate a getter once.
  scopeList() { return scopeOptions(this.entries); },
};
