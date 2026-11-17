import { freeCell, moveMachine } from './layoutEdit';
import type { Machine } from './types';

const m: Machine = { id: 'm', hallId: 'frezy', name: 'X', x: 0, y: 2, w: 1, h: 2, status: 'active' };
const frame = { cols: 13, rows: 6 };

test('moveMachine clamps at 0 and, with a frame, inside the plan', () => {
  expect(moveMachine(m, -1, 0).x).toBe(0);
  expect(moveMachine(m, 2, -1)).toMatchObject({ x: 2, y: 1 });
  expect(moveMachine(m, 40, 40, frame)).toMatchObject({ x: 12, y: 4 }); // 2 rows high → top row 4
});

const cell = (x: number, y: number) => ({ x, y, w: 1, h: 1 });

test('freeCell: bottom row first, left to right, never outside 13 × 6', () => {
  expect(freeCell([], frame)).toEqual({ x: 0, y: 5 });
  expect(freeCell([cell(0, 5), cell(1, 5)], frame)).toEqual({ x: 2, y: 5 });
  const bottomFull = Array.from({ length: 13 }, (_, x) => cell(x, 5));
  expect(freeCell(bottomFull, frame)).toEqual({ x: 0, y: 4 });
});

test('freeCell: a full plan has no free cell', () => {
  const full = Array.from({ length: 78 }, (_, i) => cell(i % 13, Math.floor(i / 13)));
  expect(freeCell(full, frame)).toBeNull();
});
