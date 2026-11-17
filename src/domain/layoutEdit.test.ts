import { freeCell, moveMachine, pullIntoFrame } from './layoutEdit';
import type { Machine } from './types';

const m: Machine = { id: 'm', hallId: 'frezy', name: 'X', x: 0, y: 2, w: 1, h: 2, status: 'active' };
const frame = { cols: 13, rows: 6 };

test('moveMachine clamps at 0 and, with a frame, inside the plan', () => {
  expect(moveMachine(m, -1, 0).x).toBe(0);
  expect(moveMachine(m, 2, -1)).toMatchObject({ x: 2, y: 1 });
  expect(moveMachine(m, 40, 40, frame)).toMatchObject({ x: 12, y: 4 }); // 2 rows high → top row 4
});

const cell = (x: number, y: number) => ({ x, y, w: 1, h: 1 });

test('freeCell: left to right, top to bottom, never outside 13 × 6', () => {
  expect(freeCell([], frame)).toEqual({ x: 0, y: 0 });
  expect(freeCell([cell(0, 0), cell(1, 0)], frame)).toEqual({ x: 2, y: 0 });
  const topFull = Array.from({ length: 13 }, (_, x) => cell(x, 0));
  expect(freeCell(topFull, frame)).toEqual({ x: 0, y: 1 });
});

test('pullIntoFrame moves machines below the plan to free cells, one after another', () => {
  const machines = [{ ...m, x: 0, y: 0, h: 1 }, { ...m, id: 'a', x: 0, y: 7, h: 1 }, { ...m, id: 'b', x: 0, y: 9, h: 1 }];
  expect(pullIntoFrame(machines, frame).map((x) => [x.id, x.x, x.y])).toEqual([['a', 1, 0], ['b', 2, 0]]);
});

test('freeCell: a full plan has no free cell', () => {
  const full = Array.from({ length: 78 }, (_, i) => cell(i % 13, Math.floor(i / 13)));
  expect(freeCell(full, frame)).toBeNull();
});
