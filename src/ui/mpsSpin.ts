/*
 * Turning of the three MPS hexagons. The logo is three equal regular hexagons lying on a flat disc,
 * seen in perspective (fitted to the artwork: within 3 px on its 431 px width). Turning the disc in its
 * own plane keeps them together on it – they don't fly about, they only grow and shrink with the depth:
 * the outline round the three of them (an ellipse in the picture) sets their size at every angle. After
 * a third of a turn the light blue one is the big one in front, after a full turn all are back.
 */

type Pt = [number, number];

/** The places in the logo artwork, for reference (orange front, turquoise back, light blue right). */
export const MPS_PLACES: Pt[][] = [
  [[2, 193], [41, 95], [148, 113], [227, 213], [214, 313], [100, 318]],
  [[191, 26], [267, 45], [330, 124], [329, 197], [252, 191], [176, 97]],
  [[257, 227], [335, 233], [411, 318], [410, 419], [333, 436], [246, 326]],
];

/** On the disc: hexagon j centred at (cos 120°·j, sin 120°·j), corner radius S. */
const S = 0.841;
/** Perspective from the disc to the logo's picture (homography). */
const H = [
  [-132.436997, -28.242801, 245.543909],
  [-29.673359, -114.858591, 209.704886],
  [-0.112782, 0.063553, 1.0],
];

function project([x, y]: Pt): Pt {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  return [(H[0][0] * x + H[0][1] * y + H[0][2]) / w, (H[1][0] * x + H[1][1] * y + H[1][2]) / w];
}

/** Corners of hexagon `hex` (0 orange, 1 turquoise, 2 light blue) with the disc turned by `turn` (0 … 1). */
export function hexCorners(hex: number, turn: number): Pt[] {
  const a = (2 * Math.PI * hex) / 3 + 2 * Math.PI * turn;
  const c: Pt = [Math.cos(a), Math.sin(a)];
  return Array.from({ length: 6 }, (_, k) => {
    const b = a + (Math.PI / 3) * k;
    return project([c[0] + S * Math.cos(b), c[1] + S * Math.sin(b)]);
  });
}

/** The same, as an SVG points string. */
export const hexAt = (hex: number, turn: number) =>
  hexCorners(hex, turn).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
