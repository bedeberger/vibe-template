// Notes overview chart (Chart.js, lazy — js/lazy-libs.js). Bar chart "notes
// per notebook" in the collapsible overview of the notes card.
//
// The Chart instance never enters Alpine state: a reactive proxy around it
// makes Chart.js recurse through its own internals. The card keeps only the
// controller returned here (plain closures), the chart lives in the closure.

import { loadChart } from '../lazy-libs.js';

// Pure: labels + counts. The open notebook counts its live list (notes added
// or deleted since the notebooks were loaded); the others their note_count.
export function notebookCounts(notebooks, currentId, currentCount) {
  return {
    labels: notebooks.map((nb) => nb.name),
    counts: notebooks.map((nb) => (nb.id === currentId ? currentCount : nb.note_count ?? 0)),
  };
}

// Colours come from the design tokens (DESIGN.md → Dark Mode), read at
// creation and again on every theme switch. The canvas can't resolve var(--…),
// and getPropertyValue('--x') returns the token *unresolved* — our colour
// tokens are light-dark(…), which a canvas silently paints as black. So each
// colour goes through a probe element (css/entities/notes.css → .chart-probe):
// its computed `color` is a plain rgb().
function tokens(el) {
  const probe = document.createElement('span');
  probe.className = 'chart-probe';
  probe.hidden = true;
  el.parentNode.appendChild(probe);
  const color = (name) => {
    probe.style.setProperty('--probe', `var(${name})`);
    return getComputedStyle(probe).color;
  };
  const c = { bar: color('--color-accent'), text: color('--color-muted'), grid: color('--color-border') };
  probe.remove();
  c.font = getComputedStyle(el).getPropertyValue('--font-sans').trim();
  return c;
}

function applyTokens(chart, c) {
  const { x, y } = chart.options.scales;
  chart.data.datasets[0].backgroundColor = c.bar;
  x.ticks.color = c.text;
  y.ticks.color = c.text;
  y.grid.color = c.grid;
}

// Re-colour when the theme flips: <html data-theme> (js/theme-boot.js) or the
// OS scheme while on 'system'. Returns the unsubscribe.
function onThemeChange(fn) {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', fn);
  return () => { mo.disconnect(); mq.removeEventListener('change', fn); };
}

export async function mountNotesChart(canvas, { labels, counts }, seriesLabel) {
  const Chart = await loadChart();
  const c = tokens(canvas);
  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: seriesLabel, data: counts, backgroundColor: c.bar, borderRadius: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: c.text, font: { family: c.font } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: c.text, precision: 0, font: { family: c.font } }, grid: { color: c.grid } },
      },
    },
  });
  const themeOff = onThemeChange(() => { applyTokens(chart, tokens(canvas)); chart.update(); });
  return {
    update({ labels: l, counts: n }) {
      chart.data.labels = l;
      chart.data.datasets[0].data = n;
      chart.update();
    },
    destroy() { themeOff(); chart.destroy(); },
  };
}
