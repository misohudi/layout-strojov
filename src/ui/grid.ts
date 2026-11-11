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

/** Grid tracks: cells no machine occupies (aisles) are drawn narrower. */
export function gridTracks(items: GridItem[]) {
  const cols = weights(items, 'x', 'w');
  const rows = weights(items, 'y', 'h');
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  return {
    columns: cols.map((w) => `${w}fr`).join(' '),
    rows: rows.map((w) => `${w}fr`).join(' '),
    widthUnits: sum(cols),
    heightUnits: sum(rows),
  };
}
