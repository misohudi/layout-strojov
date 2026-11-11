import { moveMachine, resizeMachine, freeSpotBelow } from './layoutEdit';
import type { Machine } from './types';

const m: Machine = { id: 'm', hallId: 'frezy', name: 'X', x: 0, y: 2, w: 1, h: 2, status: 'active' };

test('moveMachine clamps at 0', () => {
  expect(moveMachine(m, -1, 0).x).toBe(0);
  expect(moveMachine(m, 2, -1)).toMatchObject({ x: 2, y: 1 });
});

test('resizeMachine keeps size at least 1', () => {
  expect(resizeMachine(m, -1, 0).w).toBe(1);
  expect(resizeMachine(m, 2, -1)).toMatchObject({ w: 3, h: 1 });
});

test('freeSpotBelow returns position under the lowest machine', () => {
  expect(freeSpotBelow([m, { ...m, y: 10, h: 3 }])).toEqual({ x: 0, y: 14 });
  expect(freeSpotBelow([])).toEqual({ x: 0, y: 0 });
});
