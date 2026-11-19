/* Design elements of the Mühlbauer corporate design manual: hexagons and the graphic bar. */

/** Points of a flat-topped hexagon around (cx, cy) with corner radius r. */
function hexPoints(cx: number, cy: number, r: number): string {
  const h = r * 0.866;
  return [
    [cx - r, cy],
    [cx - r / 2, cy - h],
    [cx + r / 2, cy - h],
    [cx + r, cy],
    [cx + r / 2, cy + h],
    [cx - r / 2, cy + h],
  ]
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

/** One hexagon lit from above: a lighter top half over the base colour. */
function Hex({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <g>
      <polygon points={hexPoints(cx, cy, r)} style={{ fill: color }} />
      <polygon points={hexPoints(cx, cy, r)} fill="url(#mb-hex-light)" />
    </g>
  );
}

const LIGHT = (
  <defs>
    <linearGradient id="mb-hex-light" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
      <stop offset="0.5" stopColor="#fff" stopOpacity="0.05" />
      <stop offset="1" stopColor="#000" stopOpacity="0.08" />
    </linearGradient>
  </defs>
);

/** The graphic bar: always exactly three hexagons, then the gradient line. */
export function BrandBar() {
  return (
    <div className="brand-bar" aria-hidden="true">
      <svg className="brand-bar__hexes" viewBox="0 0 46 40">
        {LIGHT}
        <Hex cx={12} cy={11} r={10} color="var(--mb-neutral)" />
        <Hex cx={27} cy={20} r={10} color="var(--mb-200)" />
        <Hex cx={12} cy={29} r={10} color="var(--mb-600)" />
      </svg>
      <span className="brand-bar__line" />
    </div>
  );
}

// Honeycomb cells (column, row) of the decorative group, with their palette colour.
const GROUP: [number, number, string][] = [
  [0, 1, 'var(--mb-100)'], [0, 2, 'var(--mb-200)'],
  [1, 0, 'var(--mb-neutral)'], [1, 1, 'var(--mb-600)'], [1, 2, 'var(--mb-100)'],
  [2, 0, 'var(--mb-200)'], [2, 1, 'var(--mb-orange)'], [2, 2, 'var(--mb-800)'],
  [3, 0, 'var(--mb-100)'], [3, 1, 'var(--mb-300)'],
  [4, 0, 'var(--mb-neutral)'], [4, 1, 'var(--mb-100)'], [5, 0, 'var(--mb-600)'],
  [6, 0, 'var(--mb-100)'],
];

/** A loose group of hexagons for the corner of the start screen. */
export function HexGroup({ className }: { className?: string }) {
  const r = 26;
  const gap = 3;
  const dx = (r + gap) * 1.5;
  const dy = (r + gap) * 1.732;
  return (
    <svg className={className} viewBox="0 0 300 200" aria-hidden="true">
      {LIGHT}
      {GROUP.map(([c, row, color]) => (
        <Hex key={`${c}-${row}`} cx={30 + c * dx} cy={30 + row * dy + (c % 2 ? dy / 2 : 0)} r={r} color={color} />
      ))}
    </svg>
  );
}
