function colToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseCell(ref: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.trim().toUpperCase());
  if (!m) throw new Error(`Neplatná bunka: ${ref}`);
  return { col: colToNumber(m[1]), row: Number(m[2]) };
}

/** "G5:I7" → { col: 7, row: 5, w: 3, h: 3 } (1-based col/row). */
export function parseCellRange(range: string): { col: number; row: number; w: number; h: number } {
  const [a, b = a] = range.split(':');
  const s = parseCell(a);
  const e = parseCell(b);
  return { col: s.col, row: s.row, w: e.col - s.col + 1, h: e.row - s.row + 1 };
}
