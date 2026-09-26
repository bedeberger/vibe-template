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
// creation — the canvas can't resolve var(--…) itself.
function tokens(el) {
  const css = getComputedStyle(el);
  const v = (name) => css.getPropertyValue(name).trim();
  return { bar: v('--color-accent'), text: v('--color-muted'), grid: v('--color-border'), font: v('--font-sans') };
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
  return {
    update({ labels: l, counts: n }) {
      chart.data.labels = l;
      chart.data.datasets[0].data = n;
      chart.update();
    },
    destroy() { chart.destroy(); },
  };
}
