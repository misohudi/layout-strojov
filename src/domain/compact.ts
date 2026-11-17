/** A machine (or a machine in a history record) placed on the floor plan grid. */
export interface PlacedItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Empty tracks in a row of the original plan that count as an aisle and stay visible. */
const AISLE_MIN = 2;

/** True when every item already takes exactly one cell (the compact layout). */
export const isUniform = (items: PlacedItem[]) => items.every((i) => i.w === 1 && i.h === 1);

/** Number of empty tracks (no item covers them) between `from` (exclusive end) and `to` (start). */
function emptyBetween(items: PlacedItem[], pos: 'x' | 'y', size: 'w' | 'h', from: number, to: number): number {
  let empty = 0;
  for (let k = from; k < to; k++) {
    if (!items.some((i) => i[pos] <= k && k < i[pos] + i[size])) empty++;
  }
  return empty;
}

/**
 * Turns a plan where machines have different sizes into one where every machine takes exactly one
 * equally sized cell, keeping their order and neighbourhood:
 * - columns: each distinct left edge becomes one column, in order;
 * - rows: machines whose rows overlap form one band (DMU 125 one row lower still sits with its
 *   neighbours); when two machines of a band would land in the same column they get stacked;
 * - an aisle (at least two empty rows/columns in the original plan) stays as one empty track.
 * Returns the items in the same order with new x, y and w = h = 1.
 */
export function compactLayout<T extends PlacedItem>(items: T[]): T[] {
  if (items.length === 0) return [];

  // ---- columns ----
  const starts = [...new Set(items.map((i) => i.x))].sort((a, b) => a - b);
  const colOf = new Map<number, number>();
  let col = 0;
  starts.forEach((x, k) => {
    if (k > 0) {
      const prevEnd = Math.max(...items.filter((i) => i.x === starts[k - 1]).map((i) => i.x + i.w));
      col += emptyBetween(items, 'x', 'w', Math.min(prevEnd, x), x) >= AISLE_MIN ? 2 : 1;
    }
    colOf.set(x, col);
  });

  // ---- row bands: items whose row ranges overlap ----
  const byY = items.map((item, idx) => ({ item, idx })).sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x);
  const bands: { start: number; end: number; members: typeof byY }[] = [];
  for (const e of byY) {
    const band = bands[bands.length - 1];
    if (band && e.item.y < band.end) {
      band.members.push(e);
      band.end = Math.max(band.end, e.item.y + e.item.h);
    } else {
      bands.push({ start: e.item.y, end: e.item.y + e.item.h, members: [e] });
    }
  }

  const out: T[] = new Array(items.length);
  let row = 0;
  bands.forEach((band, k) => {
    if (k > 0 && emptyBetween(items, 'y', 'h', bands[k - 1].end, band.start) >= AISLE_MIN) row++;
    // stack items of the band that would share a column
    const used: Set<number>[] = [];
    for (const { item, idx } of band.members) {
      const c = colOf.get(item.x)!;
      let sub = used.findIndex((s) => !s.has(c));
      if (sub === -1) {
        used.push(new Set());
        sub = used.length - 1;
      }
      used[sub].add(c);
      out[idx] = { ...item, x: c, y: row + sub, w: 1, h: 1 };
    }
    row += Math.max(1, used.length);
  });
  return out;
}
