/** A machine (or a machine in a history record) placed on the floor plan grid. */
export interface PlacedItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Empty tracks of the original hall that count as an aisle and stay visible. */
const AISLE_MIN = 2;

/** True when every item already takes exactly one cell. */
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
 * Turns the hall plan (machines of different sizes) into equally sized cells while keeping the hall's
 * shape – gaps and aisles stay:
 * - columns: each distinct left edge becomes one column, in order, so machines standing above each
 *   other in the hall stay in one column and missing machines leave an empty cell;
 * - rows: machines whose rows overlap form one row (DMU 125, one hall row lower, still sits with its
 *   neighbours); when two machines of a row would land in the same column they get stacked;
 * - an aisle (at least two empty rows/columns in the hall) stays as one empty, narrow track.
 * Returns the items in the same order with new x, y and w = h = 1.
 */
export function hallLayout<T extends PlacedItem>(items: T[]): T[] {
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

/**
 * Moves a machine to a cell. When another machine stands there, the two swap places, so machines never
 * overlap. Returns the machines whose position changed.
 */
export function moveToCell<T extends PlacedItem & { id: string }>(items: T[], id: string, x: number, y: number): T[] {
  const moved = items.find((i) => i.id === id);
  if (!moved || (moved.x === x && moved.y === y)) return [];
  const other = items.find((i) => i.id !== id && i.x === x && i.y === y);
  const changed: T[] = [{ ...moved, x, y }];
  if (other) changed.push({ ...other, x: moved.x, y: moved.y });
  return changed;
}
