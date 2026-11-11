import ExcelJS from 'exceljs';
import { openDB, ensureSeeded, type AppDB } from '../db/db';
import { parsePeopleFile, applyPeopleImport } from './peopleImport';

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = openDB(`imp-${++n}-${Math.random()}`);
  await ensureSeeded(db);
});
afterEach(() => db.close());

const CSV = '﻿Meno;Zmena\n Kováč ;A\n;B\nKováč;A\nNovák;X\nHorváth;b\n';

async function expectStandardResult(file: File) {
  const rows = await parsePeopleFile(file);
  const res = await applyPeopleImport(db, rows);
  expect(res).toMatchObject({ added: 2, skipped: 2, errors: [{ line: 5, message: 'Neznáma zmena „X“' }] });
  const people = await db.people.toArray();
  expect(people.map((p) => [p.name, p.shiftId, p.active]).sort()).toEqual([
    ['Horváth', 's-B', true],
    ['Kováč', 's-A', true],
  ]);
}

test('CSV import trims, skips empty and duplicate rows, reports unknown shift', async () => {
  await expectStandardResult(new File([CSV], 'ludia.csv', { type: 'text/csv' }));
});

test('CSV with comma separator and header without diacritics', async () => {
  const rows = await parsePeopleFile(new File(['meno,ZMENA\nKováč,A\n'], 'l.csv'));
  expect(rows).toEqual([{ name: 'Kováč', shiftName: 'A', line: 2 }]);
});

test('CSV saved by Excel in Windows-1250 keeps Slovak diacritics', async () => {
  // "Meno;Zmena\nKováč;A\n" encoded as windows-1250 (á = 0xE1, č = 0xE8)
  const bytes = new Uint8Array([
    ...Array.from('Meno;Zmena\nKov', (c) => c.charCodeAt(0)), 0xe1, 0xe8, ...Array.from(';A\n', (c) => c.charCodeAt(0)),
  ]);
  const rows = await parsePeopleFile(new File([bytes], 'ludia.csv'));
  expect(rows).toEqual([{ name: 'Kováč', shiftName: 'A', line: 2 }]);
});

test('XLSX import gives the same result', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ľudia');
  ws.addRows([['Meno', 'Zmena'], [' Kováč ', 'A'], [null, 'B'], ['Kováč', 'A'], ['Novák', 'X'], ['Horváth', 'b']]);
  const buf = await wb.xlsx.writeBuffer();
  await expectStandardResult(new File([buf as ArrayBuffer], 'ludia.xlsx'));
});

test('existing person in same shift is skipped', async () => {
  await db.people.put({ id: 'x', name: 'Kováč', shiftId: 's-A', active: true });
  const res = await applyPeopleImport(db, [{ name: 'Kováč', shiftName: 'A', line: 2 }]);
  expect(res).toMatchObject({ added: 0, skipped: 1, errors: [] });
});

test('file without required columns is rejected', async () => {
  await expect(parsePeopleFile(new File(['a;b\n1;2'], 'x.csv'))).rejects.toThrow('Súbor musí mať stĺpce „Meno“ a „Zmena“');
});

/** One column per shift ("Smena <foreman>") plus an "everyone" column – the layout the plant keeps its list in. */
async function wideXlsx(): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRows([
    ['Smena Alfa ', null, 'Smena Beta', null, null, 'Vsetci'],
    ['Adam', null, 'Cyril ', null, null, 'Adam'],
    ['Boris ', null, 'Dano', null, null, 'Cyril '],
    [null, null, 'Emil', null, null, 'Fero'],
    [null, null, null, null, null, 'Boris'],
    [null, null, null, null, null, 'Gejza'],
  ]);
  return new File([(await wb.xlsx.writeBuffer()) as ArrayBuffer], 'Book1.xlsx');
}

test('wide layout: one column per shift, "Vsetci" people without a shift go to the pool', async () => {
  const rows = await parsePeopleFile(await wideXlsx());
  expect(rows.map((r) => [r.name, r.shiftName, !!r.pool])).toEqual([
    ['Adam', 'Alfa', false],
    ['Boris', 'Alfa', false],
    ['Cyril', 'Beta', false],
    ['Dano', 'Beta', false],
    ['Emil', 'Beta', false],
    ['Fero', 'Ostatní', true],
    ['Gejza', 'Ostatní', true],
  ]);
});

test('wide import creates the shifts and the pool and can remove unused default shifts', async () => {
  const res = await applyPeopleImport(db, await parsePeopleFile(await wideXlsx()), { removeUnusedShifts: true });
  expect(res).toMatchObject({ added: 7, skipped: 0, errors: [], shiftsCreated: ['Alfa', 'Beta', 'Ostatní'], shiftsRemoved: ['A', 'B', 'C'] });
  const shifts = await db.shifts.orderBy('order').toArray();
  expect(shifts.map((s) => [s.name, s.kind ?? 'shift'])).toEqual([['Alfa', 'shift'], ['Beta', 'shift'], ['Ostatní', 'pool']]);
  const people = await db.people.toArray();
  const pool = shifts.find((s) => s.kind === 'pool')!;
  expect(people.filter((p) => p.shiftId === pool.id).map((p) => p.name).sort()).toEqual(['Fero', 'Gejza']);
});

test('unused shift removal keeps shifts that have people or an open draft', async () => {
  await db.people.put({ id: 'x', name: 'Zoli', shiftId: 's-A', active: true });
  await db.drafts.put({ shiftId: 's-B', foremanName: 'X', startedAt: new Date().toISOString(), assignments: {} });
  const res = await applyPeopleImport(db, await parsePeopleFile(await wideXlsx()), { removeUnusedShifts: true });
  expect(res.shiftsRemoved).toEqual(['C']);
  expect((await db.shifts.toArray()).map((s) => s.name).sort()).toEqual(['A', 'Alfa', 'B', 'Beta', 'Ostatní']);
});

test('importing the same wide file twice adds nobody and creates no shifts', async () => {
  await applyPeopleImport(db, await parsePeopleFile(await wideXlsx()));
  const res = await applyPeopleImport(db, await parsePeopleFile(await wideXlsx()));
  expect(res).toMatchObject({ added: 0, skipped: 7, shiftsCreated: [] });
});
