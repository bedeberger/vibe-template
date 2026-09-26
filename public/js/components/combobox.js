// Combobox — searchable replacement for `<select>` (DESIGN.md → "Combobox").
// Keyboard navigation, search filter, optional multi-select, sublabels, group
// headers and a footer action. `init()` renders trigger + dropdown + search +
// list itself and OVERWRITES the wrapper's content — leave the wrapper empty.
//
//   <div x-data="combobox(() => t('…'), emptyLabel?)"
//        x-modelable="value" x-model="selectedRef"
//        x-effect="options = items.map((i) => ({ value: i.id, label: i.name }))"
//        @combobox-change="onPick($event.detail)"></div>
//
// Required (3): `x-data="combobox(...)"`, `x-modelable="value"`, `x-model`.
// `init()` sets the `combobox-wrap[--compact]` classes, ARIA roles, the
// document mousedown (outside close) and the keydown (keyboard nav) — the
// consumer needs no `@click.outside`, no `@keydown`, no `class`.
//
// Ported from schreibwerkstatt (public/js/combobox.js). Difference: the
// dropdown is placed here (`_place()`, CSS custom properties) instead of via
// the x-anchor plugin — scrolling outside closes it anyway (like a native
// <select>), so it only needs placing on open and on resize.

import { t } from '../i18n.js';

// Gap between trigger and dropdown, and the minimum distance to the viewport
// edge (px). Matches --space-xs / --space-sm.
const GAP = 4;
const EDGE = 8;
// Compact triggers can be narrow (filter bars); the list stays readable.
const COMPACT_MIN_WIDTH = 180;

// comboboxData: pure factory without Alpine registration — wrappers
// (a filter or entity picker) spread it to inherit the full mechanics instead
// of reimplementing them. cfg = { placeholder, emptyLabel, compact, multiple,
// transient, footer: { label, action } }; placeholder, emptyLabel and
// footer.label may be functions (reactive i18n).
export function comboboxData(cfg = {}) {
  return {
    open: false,
    query: '',
    // Single mode: scalar; multi mode: array. Seeded from the parent via x-modelable.
    value: cfg.multiple ? [] : null,
    options: [],
    // Set by the consumer: x-effect="_disabled = !items.length".
    _disabled: false,
    _placeholder: cfg.placeholder ?? null,
    _emptyLabel: cfg.emptyLabel ?? null,
    _compact: cfg.compact !== false,
    _multiple: !!cfg.multiple,
    _transient: !!cfg.transient,
    _footer: (cfg.footer && typeof cfg.footer.action === 'function') ? cfg.footer : null,
    _onOutside: null,
    _onScroll: null,
    _onResize: null,
    // The wrapper (x-data root). `this.$el` resolves to the TRIGGER inside the
    // trigger's @click, so runtime methods use this cached element instead.
    _rootEl: null,
    // Dropdown geometry, handed to CSS as custom properties (--cb-*).
    ddTop: null,
    ddLeft: null,
    ddWidth: null,
    highlighted: -1,

    // Phone or touch device: do NOT auto-focus the search on open — focus
    // opens the on-screen keyboard, whose resize would shift the dropdown.
    // The list is fully usable without focus.
    _isMobile() {
      if (window.innerWidth <= 600) return true;
      return window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches ?? false;
    },

    get placeholder() {
      const p = typeof this._placeholder === 'function' ? this._placeholder() : this._placeholder;
      return p ?? t('combobox.choose');
    },
    get emptyLabel() {
      const e = this._emptyLabel;
      return (typeof e === 'function' ? e() : e) ?? null;
    },
    get _allOptions() {
      if (this._multiple || !this.emptyLabel) return this.options;
      return [{ value: '', label: this.emptyLabel }, ...this.options];
    },
    get filtered() {
      if (!this.query) return this._allOptions;
      const q = this.query.toLowerCase();
      // The optional sublabel (second line) is searchable too.
      return this._allOptions.filter((o) =>
        String(o.label).toLowerCase().includes(q)
        || (o.sublabel && String(o.sublabel).toLowerCase().includes(q)));
    },
    // Render plan: optional group headers (opt.group) between the options.
    // Without any `group` this is a plain option list. Headers are not
    // selectable; `highlighted` indexes only the options (= index in
    // `filtered`), so keyboard nav skips headers automatically.
    get groupedRows() {
      const rows = [];
      let lastGroup;
      const f = this.filtered;
      for (let i = 0; i < f.length; i++) {
        const opt = f[i];
        const g = (opt.group == null || opt.group === '') ? null : opt.group;
        // The index belongs in the key: x-for needs UNIQUE keys, and a group
        // appearing twice would otherwise drop one of its headers.
        if (g !== null && g !== lastGroup) rows.push({ kind: 'header', label: g, key: `h:${i}:${g}` });
        lastGroup = g;
        rows.push({ kind: 'option', opt, optIndex: i, key: `o:${i}:${g ?? ''}:${String(opt.value)}` });
      }
      return rows;
    },
    _isSelected(val) {
      if (this._multiple) {
        const arr = Array.isArray(this.value) ? this.value : [];
        return arr.some((v) => String(v) === String(val));
      }
      return String(this.value ?? '') === String(val);
    },
    get selectedLabel() {
      if (this._multiple) {
        const n = Array.isArray(this.value) ? this.value.length : 0;
        return n ? t('combobox.multiSelected', { n }) : '';
      }
      const v = this.value ?? '';
      const opt = this._allOptions.find((o) => String(o.value) === String(v));
      return opt ? opt.label : (this.emptyLabel || '');
    },
    get _footerLabel() {
      const f = this._footer;
      if (!f) return '';
      return typeof f.label === 'function' ? f.label() : (f.label || '');
    },

    toggle() {
      if (this._disabled) return;
      if (this.open) { this.close(); return; }
      this.open = true;
      this.query = '';
      if (this._multiple) {
        const arr = Array.isArray(this.value) ? this.value : [];
        this.highlighted = arr.length
          ? this._allOptions.findIndex((o) => arr.some((v) => String(v) === String(o.value)))
          : 0;
      } else {
        this.highlighted = this._allOptions.findIndex((o) => String(o.value) === String(this.value));
      }
      // At least trigger-wide, like a <select>.
      const trig = this.$refs.cbTrigger;
      const w = trig ? Math.max(trig.offsetWidth, this._compact ? COMPACT_MIN_WIDTH : 0) : 0;
      this.ddWidth = w ? `${w}px` : null;
      this.$nextTick(() => {
        this._place();
        if (!this._isMobile()) this.$refs.cbInput?.focus();
        // Scroll the current selection into view in long lists.
        this._scrollHl();
      });
    },
    close() {
      this.open = false;
      this.query = '';
      this.highlighted = -1;
      this.ddWidth = null;
    },
    // Below the trigger; flips above when there is not enough room below and
    // more room above. Horizontally clamped into the viewport.
    _place() {
      const trig = this.$refs.cbTrigger;
      const dd = this._rootEl.querySelector('.combobox-dropdown');
      if (!trig || !dd) return;
      const r = trig.getBoundingClientRect();
      const h = dd.offsetHeight;
      const w = dd.offsetWidth;
      const below = window.innerHeight - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      const top = (h > below && above > below) ? r.top - GAP - h : r.bottom + GAP;
      const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE));
      this.ddTop = `${Math.round(top)}px`;
      this.ddLeft = `${Math.round(left)}px`;
    },
    select(val) {
      if (this._multiple) {
        const arr = Array.isArray(this.value) ? this.value : [];
        const idx = arr.findIndex((v) => String(v) === String(val));
        this.value = idx >= 0 ? arr.filter((_, i) => i !== idx) : [...arr, val];
        this.$dispatch('combobox-change', this.value);
        return;
      }
      this.value = val;
      this.close();
      this.$refs.cbTrigger?.focus();
      this.$dispatch('combobox-change', val);
      if (this._transient) this.value = null;
    },
    triggerFooter() {
      const f = this._footer;
      if (!f) return;
      this.close();
      try { f.action(); } catch (e) { console.error('[combobox] footer action failed', e); }
    },
    onKeydown(e) {
      if (!this.open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); this.toggle(); }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.highlighted = Math.min(this.highlighted + 1, this.filtered.length - 1);
        this._scrollHl();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.highlighted = Math.max(this.highlighted - 1, 0);
        this._scrollHl();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.highlighted >= 0 && this.filtered[this.highlighted]) this.select(this.filtered[this.highlighted].value);
      } else if (e.key === 'Escape') {
        // Escape closes ONLY the dropdown — stopPropagation, so an enclosing
        // dialog/editor doesn't also read it as "cancel".
        e.preventDefault();
        e.stopPropagation();
        this.close();
        this.$refs.cbTrigger?.focus();
      } else if (e.key === 'Tab') {
        this.close();
      }
    },
    _scrollHl() {
      // By class, not child index — group headers sit between the options.
      this.$nextTick(() => {
        this._rootEl.querySelector('.combobox-option--hl')?.scrollIntoView({ block: 'nearest' });
      });
    },

    init() {
      this._rootEl = this.$el;
      this._rootEl.classList.add('combobox-wrap');
      if (this._compact) this._rootEl.classList.add('combobox-wrap--compact');

      this._onOutside = (e) => { if (!this._rootEl.contains(e.target)) this.close(); };
      document.addEventListener('mousedown', this._onOutside);
      // Scrolling the rest of the page closes the dropdown (like a native
      // <select>) instead of chasing the trigger. Scrolling INSIDE the list
      // keeps it open — capture phase sees every scroll, the target check
      // excludes its own.
      this._onScroll = (e) => {
        if (!this.open) return;
        const dd = this._rootEl.querySelector('.combobox-dropdown');
        if (dd && (e.target === dd || dd.contains(e.target))) return;
        this.close();
      };
      window.addEventListener('scroll', this._onScroll, { capture: true, passive: true });
      this._onResize = () => { if (this.open) this._place(); };
      window.addEventListener('resize', this._onResize, { passive: true });
      this._rootEl.addEventListener('keydown', (e) => this.onKeydown(e));

      this._rootEl.setAttribute('role', 'combobox');
      this._rootEl.setAttribute('aria-haspopup', 'listbox');
      if (this._multiple) this._rootEl.setAttribute('aria-multiselectable', 'true');
      this.$watch('open', (v) => this._rootEl.setAttribute('aria-expanded', v ? 'true' : 'false'));
      this._rootEl.setAttribute('aria-expanded', 'false');
      this.$watch('query', () => {
        this.highlighted = this.filtered.length > 0 ? 0 : -1;
      });

      // `x-id` is required, not cosmetic: $id() memoises per ELEMENT, and
      // aria-activedescendant (on the <ul>) must point at the ids of the <li>s.
      // The scope on the dropdown encloses both, so each instance gets exactly
      // one number.
      this._rootEl.innerHTML = `
<button type="button" class="combobox-trigger" @click="toggle()" x-ref="cbTrigger" :disabled="_disabled"
        :aria-expanded="open ? 'true' : 'false'" :aria-label="selectedLabel || placeholder">
  <span class="combobox-value" :class="{ 'combobox-value--placeholder': !selectedLabel }" x-text="selectedLabel || placeholder"></span>
  <svg class="icon combobox-chevron" :class="{ 'combobox-chevron--open': open }" aria-hidden="true"><use href="/icons.svg#chevron-down"/></svg>
</button>
<div class="combobox-dropdown" x-id="['cb-opt']" x-show="open" x-cloak
     :style="{ '--cb-top': ddTop, '--cb-left': ddLeft, '--cb-width': ddWidth }">
  <input type="text" class="combobox-search" x-model="query" x-ref="cbInput"
         :placeholder="t('combobox.search')" :aria-label="t('combobox.search')">
  <ul class="combobox-list" role="listbox"
      :aria-activedescendant="highlighted >= 0 ? ($id('cb-opt') + '-' + highlighted) : null">
    <template x-for="row in groupedRows" :key="row.key">
      <li :class="row.kind === 'header' ? 'combobox-group' : { 'combobox-option': true, 'combobox-option--selected': _isSelected(row.opt.value), 'combobox-option--hl': row.optIndex === highlighted }"
          :role="row.kind === 'header' ? 'presentation' : 'option'"
          :id="row.kind === 'option' ? ($id('cb-opt') + '-' + row.optIndex) : null"
          :aria-selected="row.kind === 'option' ? (_isSelected(row.opt.value) ? 'true' : 'false') : null"
          @click="row.kind === 'option' && select(row.opt.value)"
          @mouseenter="row.kind === 'option' && (highlighted = row.optIndex)">
        <span class="combobox-group__label" x-show="row.kind === 'header'" x-text="row.label"></span>
        <span class="combobox-option__label" x-show="row.kind === 'option'" x-text="row.opt?.label"></span>
        <span class="combobox-option__sub" x-show="row.kind === 'option' && row.opt?.sublabel" x-cloak x-text="row.opt?.sublabel"></span>
      </li>
    </template>
    <li class="combobox-empty" x-show="filtered.length === 0" x-text="t('combobox.noMatches')"></li>
  </ul>
  <button type="button" class="combobox-footer-btn" x-show="_footer" x-cloak
          @click="triggerFooter()" x-text="_footerLabel"></button>
</div>`;
      // The fresh markup is not reliably processed when the combobox sits in a
      // late-hydrated subtree (template x-if, lazily loaded partial).
      window.Alpine.initTree(this._rootEl);
    },
    destroy() {
      document.removeEventListener('mousedown', this._onOutside);
      window.removeEventListener('scroll', this._onScroll, { capture: true });
      window.removeEventListener('resize', this._onResize);
    },

    // Templates inside the rendered markup call t() on this scope.
    t,
  };
}

export function registerCombobox(Alpine) {
  Alpine.data('combobox', (placeholderOrCfg = null, emptyLabel = null) => {
    const cfg = (placeholderOrCfg && typeof placeholderOrCfg === 'object')
      ? placeholderOrCfg
      : { placeholder: placeholderOrCfg, emptyLabel };
    return comboboxData(cfg);
  });
}
