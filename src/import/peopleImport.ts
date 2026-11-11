import { loadExcel } from '../report/excel';
import type { AppDB } from '../db/db';
import { upsertPerson } from '../db/repo';

export interface PeopleImportRow {
  name: string;
  shiftName: string;
  /** 1-based line/row number in the source file */
  line: number;
}

export interface PeopleImportResult {
  added: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const unquote = (s: string) => s.trim().replace(/^"(.*)"$/, '$1').trim();

function toRows(table: string[][]): PeopleImportRow[] {
  const header = (table[0] ?? []).map(norm);
  const iName = header.indexOf('meno');
  const iShift = header.indexOf('zmena');
  if (iName < 0 || iShift < 0) throw new Error('Súbor musí mať stĺpce „Meno“ a „Zmena“');
  const out: PeopleImportRow[] = [];
  table.slice(1).forEach((cells, i) => {
    const name = (cells[iName] ?? '').trim();
    const shiftName = (cells[iShift] ?? '').trim();
    if (!name && !shiftName) return; // fully empty line
    out.push({ name, shiftName, line: i + 2 });
  });
  return out;
}

function parseCsv(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const sep = (lines[0] ?? '').includes(';') ? ';' : ',';
  return lines.map((l) => l.split(sep).map(unquote));
}

async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const wb = new (await loadExcel()).Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const table: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= Math.max(row.cellCount, 2); c++) cells.push(String(row.getCell(c).text ?? ''));
    table.push(cells);
  }
  return table;
}

export async function parsePeopleFile(file: File): Promise<PeopleImportRow[]> {
  const isXlsx = /\.xlsx$/i.test(file.name);
  const table = isXlsx ? await parseXlsx(await file.arrayBuffer()) : parseCsv(await file.text());
  return toRows(table);
}

export async function applyPeopleImport(db: AppDB, rows: PeopleImportRow[]): Promise<PeopleImportResult> {
  const shifts = await db.shifts.toArray();
  const existing = await db.people.toArray();
  const seen = new Set(existing.map((p) => `${p.shiftId}|${norm(p.name)}`));
  const res: PeopleImportResult = { added: 0, skipped: 0, errors: [] };
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      res.skipped++;
      continue;
    }
    const shift = shifts.find((s) => norm(s.name) === norm(row.shiftName));
    if (!shift) {
      res.errors.push({ line: row.line, message: `Neznáma zmena „${row.shiftName}“` });
      continue;
    }
    const key = `${shift.id}|${norm(name)}`;
    if (seen.has(key)) {
      res.skipped++;
      continue;
    }
    seen.add(key);
    await upsertPerson(db, { name, shiftId: shift.id, active: true });
    res.added++;
  }
  return res;
}
