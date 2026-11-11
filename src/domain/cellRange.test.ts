import { parseCellRange } from './cellRange';

test('parseCellRange converts Excel ranges to 1-based col/row and size', () => {
  expect(parseCellRange('G5:I7')).toEqual({ col: 7, row: 5, w: 3, h: 3 });
  expect(parseCellRange('AE5:AF6')).toEqual({ col: 31, row: 5, w: 2, h: 2 });
  expect(parseCellRange('S5')).toEqual({ col: 19, row: 5, w: 1, h: 1 });
});

test('parseCellRange rejects invalid input', () => {
  expect(() => parseCellRange('5G')).toThrow();
});
