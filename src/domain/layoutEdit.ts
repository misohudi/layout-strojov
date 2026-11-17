import type { Machine } from './types';

/** Columns × rows of a plan (the largest plan is 13 × 6). */
export interface Frame {
  cols: number;
  rows: number;
}

/** Moves a machine by whole cells, never outside the plan (when a frame is given) or before 0,0. */
export function moveMachine(m: Machine, dx: number, dy: number, frame?: Frame): Machine {
  const maxX = frame ? frame.cols - m.w : Infinity;
  const maxY = frame ? frame.rows - m.h : Infinity;
  return { ...m, x: Math.min(maxX, Math.max(0, m.x + dx)), y: Math.min(maxY, Math.max(0, m.y + dy)) };
}

/**
 * A free cell for a new (or moved-in) machine inside the plan: the bottom row first, left to right,
 * then the rows above it – new machines appear at the bottom like before. `null` when the plan is full.
 */
export function freeCell(machines: Pick<Machine, 'x' | 'y' | 'w' | 'h'>[], frame: Frame): { x: number; y: number } | null {
  const taken = (x: number, y: number) => machines.some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h);
  for (let y = frame.rows - 1; y >= 0; y--) {
    for (let x = 0; x < frame.cols; x++) if (!taken(x, y)) return { x, y };
  }
  return null;
}
