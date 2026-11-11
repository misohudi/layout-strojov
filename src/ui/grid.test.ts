import { cellIndex, trackWeights } from './grid';

test('trackWeights: used tracks weigh 1, empty aisles 0.35', () => {
  expect(trackWeights([{ x: 0, y: 0, w: 1, h: 1 }, { x: 2, y: 1, w: 1, h: 1 }])).toEqual({
    cols: [1, 0.35, 1],
    rows: [1, 1],
  });
});

describe('cellIndex maps a pixel position to a grid track', () => {
  // weights 1, 0.35, 1 → 2.35 units; 235 px wide, no gap → 100 px, 35 px, 100 px
  const w = [1, 0.35, 1];
  test('inside tracks', () => {
    expect(cellIndex(0, w, 235, 0)).toBe(0);
    expect(cellIndex(99, w, 235, 0)).toBe(0);
    expect(cellIndex(101, w, 235, 0)).toBe(1);
    expect(cellIndex(140, w, 235, 0)).toBe(2);
  });
  test('before the start clamps to 0', () => {
    expect(cellIndex(-50, w, 235, 0)).toBe(0);
  });
  test('beyond the end continues with full-size tracks', () => {
    expect(cellIndex(240, w, 235, 0)).toBe(3);
    expect(cellIndex(340, w, 235, 0)).toBe(4);
  });
  test('gaps between tracks are accounted for', () => {
    // 2 gaps of 10 px → tracks 100, 35, 100 at 0, 110, 155 (total 255)
    expect(cellIndex(105, w, 255, 10)).toBe(0);
    expect(cellIndex(150, w, 255, 10)).toBe(1);
    expect(cellIndex(160, w, 255, 10)).toBe(2);
  });
});
