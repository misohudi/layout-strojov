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

/** An empty column or row (an aisle of the hall) is drawn narrower than a machine. */
export const AISLE_WEIGHT = 0.35;

function weights(items: GridItem[], pos: 'x' | 'y', size: 'w' | 'h', count: number): number[] {
  const used = new Array<boolean>(count).fill(false);
  for (const i of items) for (let k = i[pos]; k < i[pos] + i[size]; k++) used[k] = true;
  // only gaps between machines are aisles; empty floor before the first machine keeps full size
  // (HSC: two machines on the far right of the plan)
  const first = used.indexOf(true);
  return used.map((u, k) => (u || k < first ? 1 : AISLE_WEIGHT));
}

/** Relative size of each column and row: 1 where a machine stands, narrower for empty tracks (aisles). */
export function trackWeights(items: GridItem[]): { cols: number[]; rows: number[] } {
  const { cols, rows } = gridSize(items);
  return { cols: weights(items, 'x', 'w', cols), rows: weights(items, 'y', 'h', rows) };
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
