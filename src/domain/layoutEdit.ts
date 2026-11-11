import type { Machine } from './types';

export function moveMachine(m: Machine, dx: number, dy: number): Machine {
  return { ...m, x: Math.max(0, m.x + dx), y: Math.max(0, m.y + dy) };
}

export function resizeMachine(m: Machine, dw: number, dh: number): Machine {
  return { ...m, w: Math.max(1, m.w + dw), h: Math.max(1, m.h + dh) };
}

/** Position in the first empty row below all existing machines. */
export function freeSpotBelow(machines: Pick<Machine, 'y' | 'h'>[]): { x: number; y: number } {
  if (machines.length === 0) return { x: 0, y: 0 };
  return { x: 0, y: Math.max(...machines.map((m) => m.y + m.h)) + 1 };
}
