export type OrderType = 'EXT' | 'INT';
export type MachineStatus = 'active' | 'out_of_service';

export interface Machine {
  id: string;
  hallId: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: MachineStatus;
}

export interface Shift {
  id: string;
  name: string;
  order: number;
}

export interface Person {
  id: string;
  name: string;
  shiftId: string;
  active: boolean;
}

export interface Assignment {
  type: OrderType | null;
  personIds: string[];
}

export interface ShiftDraft {
  shiftId: string;
  foremanName: string;
  /** ISO timestamp */
  startedAt: string;
  assignments: Record<string, Assignment>;
}

export interface Stats {
  total: number;
  occupied: number;
  ext: number;
  int: number;
  occupancyPct: number | null;
  extPct: number | null;
  intPct: number | null;
  peopleWithoutType: number;
}

export interface RecordPerson {
  name: string;
  homeShiftName: string;
  overtime: boolean;
}

export interface RecordRow {
  machineName: string;
  type: OrderType | null;
  outOfService: boolean;
  people: RecordPerson[];
}

export interface RecordLayoutItem {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: OrderType | null;
  outOfService: boolean;
}

export interface ShiftRecord {
  id: string;
  shiftId: string;
  shiftName: string;
  foremanName: string;
  /** YYYY-MM-DD, local date of startedAt */
  date: string;
  startedAt: string;
  closedAt: string;
  stats: Stats;
  rows: RecordRow[];
  layout: RecordLayoutItem[];
}
