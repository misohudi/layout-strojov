/*
 * Turning of the three MPS hexagons. The logo shows them on a tilted plane in perspective: the three
 * places are fixed – the big one in front (orange), the small one at the back (turquoise), the light
 * one on the right. Turning the group about its middle moves every hexagon on to the next place, and
 * there it takes that place's size and shape: after a third of a turn the light blue one is the big one
 * in front, and so on, until after a full turn all are back.
 */

type Pt = [number, number];

/** The three places, traced from the logo: orange (front, big), turquoise (back), light blue (right). */
export const MPS_PLACES: Pt[][] = [
  [[2, 193], [41, 95], [148, 113], [227, 213], [214, 313], [100, 318]],
  [[191, 26], [267, 45], [330, 124], [329, 197], [252, 191], [176, 97]],
  [[257, 227], [335, 233], [411, 318], [410, 419], [333, 436], [246, 326]],
];
/** Clockwise on the screen: orange → turquoise → light blue → orange. */
const next = (place: number) => (place + 1) % 3;

// Shape of the tilted plane (measured from the hexagons): S^½ draws a flat vector on it, S^-½ undoes it.
const SH = [[0.969, 0.2471], [0.2471, 1.095]];
const SI = [[1.095, -0.2471], [-0.2471, 0.969]];
const mul = (m: number[][], [x, y]: Pt): Pt => [m[0][0] * x + m[0][1] * y, m[1][0] * x + m[1][1] * y];

const centre = (poly: Pt[]): Pt => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
const CENTRES = MPS_PLACES.map(centre);
/** The axis: the middle between the three places. */
const AXIS = centre(CENTRES);

const angle = ([x, y]: Pt) => Math.atan2(y, x);
const len = ([x, y]: Pt) => Math.hypot(x, y);
/** Angle from a to b, going clockwise on the screen (0 … 2π). */
const forward = (a: number, b: number) => {
  let d = b - a;
  while (d < 0) d += 2 * Math.PI;
  while (d >= 2 * Math.PI) d -= 2 * Math.PI;
  return d;
};

/**
 * The corners of `to`, ordered so that corner k is where corner k of `from` ends up after a third of a
 * turn (compared on the flattened plane, where the turn is a plain 120° rotation).
 */
function follow(from: Pt[], fromPlace: number, toPlace: number): Pt[] {
  const to = MPS_PLACES[toPlace];
  const cf = CENTRES[fromPlace];
  const ct = CENTRES[toPlace];
  return from.map((p) => {
    const a = angle(mul(SI, [p[0] - cf[0], p[1] - cf[1]])) + (2 * Math.PI) / 3;
    let best = to[0];
    let bestD = Infinity;
    for (const q of to) {
      const d = Math.abs(Math.atan2(Math.sin(angle(mul(SI, [q[0] - ct[0], q[1] - ct[1]])) - a), Math.cos(angle(mul(SI, [q[0] - ct[0], q[1] - ct[1]])) - a)));
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return best;
  });
}

/** For each hexagon: its corners at its own place and at the next three places (the last = its own again). */
const ROUTES: { places: number[]; corners: Pt[][] }[] = [0, 1, 2].map((start) => {
  const places = [start, next(start), next(next(start)), start];
  const corners: Pt[][] = [MPS_PLACES[start]];
  for (let i = 1; i < 4; i++) corners.push(follow(corners[i - 1], places[i - 1], places[i]));
  return { places, corners };
});

/** Moves a point from a to b about the axis: round the arc (clockwise), the distance changing evenly. */
function arc(a: Pt, b: Pt, f: number): Pt {
  const va: Pt = [a[0] - AXIS[0], a[1] - AXIS[1]];
  const vb: Pt = [b[0] - AXIS[0], b[1] - AXIS[1]];
  const t = angle(va) + forward(angle(va), angle(vb)) * f;
  const r = len(va) + (len(vb) - len(va)) * f;
  return [AXIS[0] + r * Math.cos(t), AXIS[1] + r * Math.sin(t)];
}

/** A corner relative to its hexagon's middle, turned and resized on the tilted plane. */
function turnOffset(a: Pt, b: Pt, f: number): Pt {
  const fa = mul(SI, a);
  const fb = mul(SI, b);
  const t = angle(fa) + forward(angle(fa), angle(fb)) * f;
  const r = len(fa) + (len(fb) - len(fa)) * f;
  return mul(SH, [r * Math.cos(t), r * Math.sin(t)]);
}

/**
 * Corners of hexagon `hex` (0 orange, 1 turquoise, 2 light blue) at `turn` (0 … 1 of a full turn), as
 * an SVG points string. At 0 and 1 these are exactly the logo.
 */
export function hexAt(hex: number, turn: number): string {
  const route = ROUTES[hex];
  const pos = Math.min(Math.max(turn, 0), 1) * 3;
  const i = Math.min(Math.floor(pos), 2);
  const f = pos - i;
  const from = route.corners[i];
  const to = route.corners[i + 1];
  const ca = centre(from);
  const cb = centre(to);
  const c = arc(ca, cb, f);
  return from
    .map((p, k) => {
      const o = turnOffset([p[0] - ca[0], p[1] - ca[1]], [to[k][0] - cb[0], to[k][1] - cb[1]], f);
      return `${(c[0] + o[0]).toFixed(1)},${(c[1] + o[1]).toFixed(1)}`;
    })
    .join(' ');
}
