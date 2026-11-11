import ExcelJS from 'exceljs';
import { buildReportXlsx, buildHistoryXlsx, reportFileName, formatPct } from './xlsx';
import type { ShiftRecord } from '../domain/types';

const rec = (over: Partial<ShiftRecord> = {}): ShiftRecord => ({
  id: 'r1', shiftId: 's-B', shiftName: 'B', foremanName: 'Novák', date: '2026-11-11',
  startedAt: '2026-11-11T13:00:00.000Z', closedAt: '2026-11-11T21:05:00.000Z',
  stats: { total: 4, occupied: 3, ext: 2, int: 1, occupancyPct: 75, extPct: 67, intPct: 33, peopleWithoutType: 0 },
  rows: [
    { machineName: 'HERMLE C60', type: 'EXT', outOfService: false, people: [{ name: 'Kováč', homeShiftName: 'B', overtime: false }] },
    { machineName: 'HERMLE C42 / 4', type: 'INT', outOfService: false, people: [
      { name: 'Horváth', homeShiftName: 'B', overtime: false },
      { name: 'Baláž', homeShiftName: 'A', overtime: true },
    ] },
    { machineName: 'DMU 125', type: null, outOfService: false, people: [] },
    { machineName: 'ZAYER', type: null, outOfService: true, people: [] },
  ],
  layout: [],
  ...over,
});

async function load(blob: Blob) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb;
}
const allText = (ws: ExcelJS.Worksheet) => {
  const out: string[] = [];
  ws.eachRow((r) => r.eachCell((c) => out.push(String(c.value ?? ''))));
  return out;
};

test('report header and stats', async () => {
  const ws = (await load(await buildReportXlsx(rec()))).getWorksheet('Report')!;
  expect(ws.getCell('A1').value).toBe('Report obsadenosti – Frézy');
  const text = allText(ws).join('\n');
  expect(text).toContain('Zmena: B');
  expect(text).toContain('Majster: Novák');
  expect(text).toContain('Obsadené: 3 (75 %)');
  expect(text).toContain('EXT: 2 (67 %)');
});

test('report table rows with overtime and out of service', async () => {
  const ws = (await load(await buildReportXlsx(rec()))).getWorksheet('Report')!;
  expect(ws.getRow(6).values).toEqual([, 'Stroj', 'Zakázka', 'Ľudia', 'Nadčas']);
  expect(ws.getRow(7).values).toEqual([, 'HERMLE C60', 'EXT', 'Kováč', '']);
  expect(ws.getRow(8).values).toEqual([, 'HERMLE C42 / 4', 'INT', 'Horváth, Baláž (A)', 'áno']);
  expect(ws.getRow(9).values).toEqual([, 'DMU 125', '–', '', '']);
  expect(ws.getRow(10).values).toEqual([, 'ZAYER', 'mimo prevádzky', '', '']);
});

test('null percentages render as dash, never NaN', async () => {
  const r = rec({ stats: { total: 4, occupied: 0, ext: 0, int: 0, occupancyPct: 0, extPct: null, intPct: null, peopleWithoutType: 0 } });
  const ws = (await load(await buildReportXlsx(r))).getWorksheet('Report')!;
  const text = allText(ws).join('\n');
  expect(text).toContain('EXT: 0 (–)');
  expect(text).not.toContain('NaN');
  expect(text).not.toContain('null');
});

test('history workbook has a row per record', async () => {
  const ws = (await load(await buildHistoryXlsx([rec(), rec({ id: 'r2', shiftName: 'A' })]))).getWorksheet('História')!;
  expect(ws.rowCount).toBe(3);
  expect(ws.getRow(1).values).toEqual([, 'Dátum', 'Zmena', 'Majster', 'Strojov', 'Obsadené', 'Obsadenosť %', 'EXT', 'INT', 'EXT %', 'INT %']);
  expect(ws.getRow(3).getCell(2).value).toBe('A');
});

test('reportFileName and formatPct', () => {
  expect(reportFileName(rec())).toBe('Obsadenost_Frezy_2026-11-11_zmena-B.xlsx');
  expect(formatPct(75)).toBe('75 %');
  expect(formatPct(null)).toBe('–');
});
