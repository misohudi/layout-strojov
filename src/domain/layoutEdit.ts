import type { Machine } from './types';

/** Columns × rows of a plan. */
export interface Frame {
  cols: number;
  rows: number;
}

/** The largest plan: 13 × 6 machine cards. Every zone's machines stay inside it. */
export const PLAN_FRAME: Frame = { cols: 13, rows: 6 };

/** Is the machine completely inside the plan? */
export const insideFrame = (m: { x: number; y: number; w: number; h: number }, frame: Frame = PLAN_FRAME) =>
  m.x >= 0 && m.y >= 0 && m.x + m.w <= frame.cols && m.y + m.h <= frame.rows;

/** Moves a machine by whole cells, never outside the plan (when a frame is given) or before 0,0. */
export function moveMachine(m: Machine, dx: number, dy: number, frame?: Frame): Machine {
  const maxX = frame ? frame.cols - m.w : Infinity;
  const maxY = frame ? frame.rows - m.h : Infinity;
  return { ...m, x: Math.min(maxX, Math.max(0, m.x + dx)), y: Math.min(maxY, Math.max(0, m.y + dy)) };
}

/**
 * A free cell for a new (or moved-in) machine inside the plan: left to right, top to bottom.
 * `null` when the plan is full.
 */
export function freeCell(machines: Pick<Machine, 'x' | 'y' | 'w' | 'h'>[], frame: Frame = PLAN_FRAME): { x: number; y: number } | null {
  const taken = (x: number, y: number) => machines.some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h);
  for (let y = 0; y < frame.rows; y++) {
    for (let x = 0; x < frame.cols; x++) if (!taken(x, y)) return { x, y };
  }
  return null;
}

/**
 * Machines lying outside the plan (added before the 13 × 6 limit, e.g. under each other in the first
 * column) are moved to free cells inside it, left to right, top to bottom. Returns the moved machines.
 */
export function pullIntoFrame<T extends Machine>(machines: T[], frame: Frame = PLAN_FRAME): T[] {
  const placed = machines.filter((m) => insideFrame(m, frame));
  const moved: T[] = [];
  for (const m of machines.filter((x) => !insideFrame(x, frame))) {
    const spot = freeCell(placed, frame);
    if (!spot) break; // the plan is full – leave the rest where it is
    const next = { ...m, ...spot, w: 1, h: 1 };
    placed.push(next);
    moved.push(next);
  }
  return moved;
}
