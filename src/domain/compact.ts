/** A machine (or a machine in a history record) placed on the floor plan grid. */
export interface PlacedItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** True when the items already form packed rows: one cell each, rows 0…n-1 without gaps, x 0…k-1 in every row. */
export function isPacked(items: PlacedItem[]): boolean {
  if (!items.every((i) => i.w === 1 && i.h === 1)) return false;
  const rows = new Map<number, number[]>();
  for (const i of items) rows.set(i.y, [...(rows.get(i.y) ?? []), i.x]);
  const ys = [...rows.keys()].sort((a, b) => a - b);
  return ys.every((y, k) => y === k && [...rows.get(y)!].sort((a, b) => a - b).every((x, j) => x === j));
}

/**
 * Rows of the hall, packed: every machine takes one equally sized cell, machines whose rows overlap
 * in the original plan form one row (DMU 125, one row lower, still sits with its neighbours), and
 * within a row they follow left to right without gaps. Rows follow top to bottom without aisles.
 * Returns the items in the same order with new x, y and w = h = 1.
 */
export function compactLayout<T extends PlacedItem>(items: T[]): T[] {
  const byY = items.map((item, idx) => ({ item, idx })).sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x);
  const bands: { end: number; members: typeof byY }[] = [];
  for (const e of byY) {
    const band = bands[bands.length - 1];
    if (band && e.item.y < band.end) {
      band.members.push(e);
      band.end = Math.max(band.end, e.item.y + e.item.h);
    } else {
      bands.push({ end: e.item.y + e.item.h, members: [e] });
    }
  }
  const out: T[] = new Array(items.length);
  bands.forEach((band, row) => {
    [...band.members]
      .sort((a, b) => a.item.x - b.item.x || a.item.y - b.item.y)
      .forEach(({ item, idx }, col) => (out[idx] = { ...item, x: col, y: row, w: 1, h: 1 }));
  });
  return out;
}

/**
 * Re-packs one-cell items after an edit: rows keep their order (empty rows disappear), machines in a
 * row are ordered by x and placed side by side. The moved machine lands before a machine it was
 * moved onto when moving left/up/down and after it when moving right, so ← / → swap neighbours.
 */
export function packRows<T extends PlacedItem & { id: string }>(items: T[], moved?: { id: string; dx: number }): T[] {
  const rank = (i: T) => (moved && i.id === moved.id ? (moved.dx > 0 ? 0.5 : -0.5) : 0);
  const ys = [...new Set(items.map((i) => i.y))].sort((a, b) => a - b);
  const out: T[] = [];
  ys.forEach((y, row) => {
    items
      .filter((i) => i.y === y)
      .sort((a, b) => a.x + rank(a) - (b.x + rank(b)))
      .forEach((i, col) => out.push({ ...i, x: col, y: row, w: 1, h: 1 }));
  });
  const byId = new Map(out.map((i) => [i.id, i]));
  return items.map((i) => byId.get(i.id)!);
}
