import { hexAt, hexCorners, MPS_PLACES } from './mpsSpin';

const pts = (s: string) => s.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
/** The same hexagon as a place in the logo (corners in any order), within a few pixels of 431. */
function samePlace(points: string, place: number) {
  const got = pts(points);
  for (const q of MPS_PLACES[place]) {
    expect(Math.min(...got.map((p) => Math.hypot(p[0] - q[0], p[1] - q[1])))).toBeLessThan(6);
  }
}

test('at rest and after the full turn the hexagons are the logo', () => {
  for (const hex of [0, 1, 2]) {
    samePlace(hexAt(hex, 0), hex);
    samePlace(hexAt(hex, 1), hex);
  }
});

test('after a third of a turn each hexagon has the next place and its size: light blue is the big one in front', () => {
  samePlace(hexAt(2, 1 / 3), 0);
  samePlace(hexAt(0, 1 / 3), 1);
  samePlace(hexAt(1, 1 / 3), 2);
  samePlace(hexAt(1, 2 / 3), 0);
});

test('on the way they stay on the disc: no hexagon jumps between two frames', () => {
  for (const hex of [0, 1, 2]) {
    for (let i = 0; i < 360; i++) {
      const a = hexCorners(hex, i / 360);
      const b = hexCorners(hex, (i + 1) / 360);
      for (let k = 0; k < 6; k++) expect(Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1])).toBeLessThan(10); // ~1° of the turn
    }
  }
});
