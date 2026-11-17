export interface GridItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

/** Number of columns and rows of the plan. */
export function gridSize(items: GridItem[]): { cols: number; rows: number } {
  return {
    cols: Math.max(1, ...items.map((i) => i.x + i.w)),
    rows: Math.max(1, ...items.map((i) => i.y + i.h)),
  };
}

/** Relative size of each column and row – all machines are equally sized cells, so all 1. */
export function trackWeights(items: GridItem[]): { cols: number[]; rows: number[] } {
  const { cols, rows } = gridSize(items);
  return { cols: new Array(cols).fill(1), rows: new Array(rows).fill(1) };
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
