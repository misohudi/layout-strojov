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
  /** 'pool' = people without a shift ("Ostatní"): selectable on machines, not offered as a shift to open. */
  kind?: 'shift' | 'pool';
}

export const isPool = (s: Pick<Shift, 'kind'> | undefined) => s?.kind === 'pool';

export type PersonRole = 'frezar' | 'operator';

export const ROLE_LABEL: Record<PersonRole, string> = { frezar: 'Frézar', operator: 'Operátor' };

export interface Person {
  id: string;
  name: string;
  shiftId: string;
  active: boolean;
  /** Missing in data from older versions – treated as 'frezar'. */
  role?: PersonRole;
}

export const roleOf = (p: Pick<Person, 'role'>): PersonRole => p.role ?? 'frezar';

export interface Assignment {
  type: OrderType | null;
  personIds: string[];
  /** Priority order on this machine for the shift – highlighted with a frame. */
  priority?: boolean;
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
  /** Active machines with at least one person – the main occupancy figure. Missing in old records. */
  staffed?: number;
  staffedPct?: number | null;
  /** People assigned to active machines (each counted once), by role. Missing in old records. */
  frezari?: number;
  operatori?: number;
  /** Machines with an order type (EXT/INT) – order occupancy, secondary. */
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
  role?: PersonRole;
}

export interface RecordRow {
  machineName: string;
  type: OrderType | null;
  outOfService: boolean;
  priority?: boolean;
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
  priority?: boolean;
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
