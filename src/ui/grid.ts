export interface GridItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP_WEIGHT = 0.35;

function weights(items: GridItem[], pos: 'x' | 'y', size: 'w' | 'h'): number[] {
  const count = Math.max(1, ...items.map((i) => i[pos] + i[size]));
  const used = new Array<boolean>(count).fill(false);
  for (const i of items) for (let k = i[pos]; k < i[pos] + i[size]; k++) used[k] = true;
  return used.map((u) => (u ? 1 : GAP_WEIGHT));
}

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

/** Relative size of each column and row: cells no machine occupies (aisles) are narrower. */
export function trackWeights(items: GridItem[]): { cols: number[]; rows: number[] } {
  return { cols: weights(items, 'x', 'w'), rows: weights(items, 'y', 'h') };
}

/** CSS grid tracks for the floor plan. */
export function gridTracks(items: GridItem[]) {
  const { cols, rows } = trackWeights(items);
  return {
    columns: cols.map((w) => `${w}fr`).join(' '),
    rows: rows.map((w) => `${w}fr`).join(' '),
    widthUnits: sum(cols),
    heightUnits: sum(rows),
  };
}

/**
 * Which track (column or row) a pixel position falls into, for a grid of `totalPx` with the given
 * track weights and `gapPx` between tracks. Positions past the end continue with full-size tracks,
 * so a machine can be dragged beyond the current edge of the plan.
 */
export function cellIndex(pos: number, weights: number[], totalPx: number, gapPx: number): number {
  const n = weights.length;
  const unit = (totalPx - gapPx * (n - 1)) / sum(weights);
  let start = 0;
  for (let i = 0; i < n; i++) {
    const end = start + weights[i] * unit;
    if (pos <= end + gapPx / 2) return i;
    start = end + gapPx;
  }
  return n + Math.floor((pos - totalPx) / (unit + gapPx));
}
