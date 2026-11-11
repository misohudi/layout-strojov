import { parseCellRange } from './cellRange';
import type { Machine, Shift } from './types';

export const HALL_FREZY = 'frezy';

/** Sheet "frezy" of Layout MPS.xlsx – machine name and merged cell range. */
const FREZY: [string, string][] = [
  ['HERMLE C60', 'G5:I7'],
  ['HERMLE C42 / 4', 'K5:M6'],
  ['HERMLE C42 / 1', 'O5:Q6'],
  ['DMU 80P HI-DYN', 'S5:S6'],
  ['DMU 80P DUO BLOCK / 1', 'U5:U6'],
  ['DMU 60P DUO BLOCK', 'W5:W6'],
  ['HERMLE C40 U / 1', 'Y5:Y6'],
  ['HERMLE C40 U / 2', 'AA5:AA6'],
  ['DMC 1035', 'AC5:AC6'],
  ['CHIRON 800', 'AE5:AF6'],
  ['HERMLE C42 / 2', 'K8:M9'],
  ['HERMLE C42 / 3', 'O8:Q9'],
  ['DMU 60P HIDYN', 'S8:S9'],
  ['DMU 80P DUO BLOCK / 2', 'U8:U9'],
  ['DMU 80P DUO BLOCK / 3', 'W8:W9'],
  ['HERMLE 1200 V', 'Y8:Z9'],
  ['DMC 65H', 'AC8:AC9'],
  ['DMU 125', 'G9:I10'],
  ['DMC 1150 / 2', 'AE9:AE10'],
  ['DMF 220 LINEAR', 'AC11:AC13'],
  ['DMC 80 U', 'G12:I13'],
  ['HERMLE C32 / 1', 'K12:K13'],
  ['HERMLE C32 / 2', 'M12:M13'],
  ['HERMLE C32 / 3', 'O12:O13'],
  ['HERMLE C32 / 4', 'Q12:Q13'],
  ['HERMLE C32 / 5', 'U12:U13'],
  ['HERMLE C32 / 6', 'W12:W13'],
  ['HERMLE C42 / 5', 'Y12:Y13'],
  ['HERMLE C42 / 6', 'AA12:AA13'],
  ['DMC 1150 / 1', 'AE12:AE13'],
  ['SHW', 'A16:E22'],
  ['UNIPORT 4000', 'AC16:AE18'],
  ['ZAYER', 'G17:K22'],
  ['DMF 360', 'O17:P22'],
  ['EDEL', 'AC20:AE22'],
];

export function seedMachines(hallId: string): Machine[] {
  const parsed = FREZY.map(([name, range]) => ({ name, ...parseCellRange(range) }));
  const minCol = Math.min(...parsed.map((p) => p.col));
  const minRow = Math.min(...parsed.map((p) => p.row));
  return parsed.map((p, i) => ({
    id: `m-${i}`,
    hallId,
    name: p.name,
    x: p.col - minCol,
    y: p.row - minRow,
    w: p.w,
    h: p.h,
    status: 'active',
  }));
}

export function seedShifts(): Shift[] {
  return ['A', 'B', 'C'].map((name, order) => ({ id: `s-${name}`, name, order }));
}
