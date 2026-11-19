import { hexAt, MPS_PLACES } from './mpsSpin';

const pts = (s: string) => s.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
/** The same hexagon (corners in any order), within half a pixel. */
function samePlace(points: string, place: number) {
  const got = pts(points);
  for (const q of MPS_PLACES[place]) {
    expect(got.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5)).toBe(true);
  }
}

test('at rest and after the full turn the hexagons are exactly the logo', () => {
  for (const hex of [0, 1, 2]) {
    samePlace(hexAt(hex, 0), hex);
    samePlace(hexAt(hex, 1), hex);
  }
});

test('after a third of a turn each hexagon has the next place and its size: light blue is the big one in front', () => {
  samePlace(hexAt(2, 1 / 3), 0); // light blue → the big front place (orange's)
  samePlace(hexAt(0, 1 / 3), 1); // orange → the small back place (turquoise's)
  samePlace(hexAt(1, 1 / 3), 2); // turquoise → the right place (light blue's)
  samePlace(hexAt(1, 2 / 3), 0); // after two thirds turquoise is the big one
});
