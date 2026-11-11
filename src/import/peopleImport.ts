import { loadExcel } from '../report/excel';
import type { AppDB } from '../db/db';
import { upsertPerson, upsertShift } from '../db/repo';

export const POOL_NAME = 'Ostatní';

export interface PeopleImportRow {
  name: string;
  shiftName: string;
  /** 1-based line/row number in the source file */
  line: number;
  /** Wide layout: the shift comes from a column header, so it may be created by the import. */
  createShift?: boolean;
  /** Person listed only in the "everyone" column – belongs to the pool, not to a shift. */
  pool?: boolean;
}

export interface PeopleImportResult {
  added: number;
  skipped: number;
  errors: { line: number; message: string }[];
  shiftsCreated: string[];
  shiftsRemoved: string[];
}

export interface PeopleImportOptions {
  /** Remove shifts not present in a wide-layout file that have no people and no open draft (e.g. default A, B, C). */
  removeUnusedShifts?: boolean;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const unquote = (s: string) => s.trim().replace(/^"(.*)"$/, '$1').trim();

const SHIFT_HEADER = /^(smena|zmena)\s+(.+)$/;
const ALL_HEADER = /^vsetci$/;

/**
 * Wide layout: one column per shift with header "Smena <name>" (or "Zmena <name>"),
 * optionally a "Všetci" column listing everyone; people only in that column go to the pool.
 */
function wideRows(table: string[][]): PeopleImportRow[] | null {
  const raw = (table[0] ?? []).map((h) => h.trim());
  const shiftCols: { col: number; name: string }[] = [];
  let allCol = -1;
  raw.forEach((h, col) => {
    const m = SHIFT_HEADER.exec(norm(h));
    if (m) shiftCols.push({ col, name: h.replace(/^\S+\s+/, '').trim() });
    else if (ALL_HEADER.test(norm(h))) allCol = col;
  });
  if (shiftCols.length === 0) return null;
  const out: PeopleImportRow[] = [];
  const inShift = new Set<string>();
  for (const { col, name: shiftName } of shiftCols) {
    table.slice(1).forEach((cells, i) => {
      const name = (cells[col] ?? '').trim();
      if (!name) return;
      inShift.add(norm(name));
      out.push({ name, shiftName, line: i + 2, createShift: true });
    });
  }
  if (allCol >= 0) {
    table.slice(1).forEach((cells, i) => {
      const name = (cells[allCol] ?? '').trim();
      if (!name || inShift.has(norm(name))) return;
      inShift.add(norm(name));
      out.push({ name, shiftName: POOL_NAME, line: i + 2, createShift: true, pool: true });
    });
  }
  return out;
}

function toRows(table: string[][]): PeopleImportRow[] {
  const wide = wideRows(table);
  if (wide) return wide;
  const header = (table[0] ?? []).map(norm);
  const iName = header.indexOf('meno');
  const iShift = header.indexOf('zmena');
  if (iName < 0 || iShift < 0) {
    throw new Error('Súbor musí mať stĺpce „Meno“ a „Zmena“, alebo stĺpec pre každú zmenu („Smena …“)');
  }
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

/** UTF-8 if valid, otherwise Windows-1250 (what Slovak Excel uses for "CSV (oddelený bodkočiarkou)"). */
function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1250').decode(buf);
  }
}

export async function parsePeopleFile(file: File): Promise<PeopleImportRow[]> {
  const isXlsx = /\.xlsx$/i.test(file.name);
  const buf = await file.arrayBuffer();
  const table = isXlsx ? await parseXlsx(buf) : parseCsv(decodeText(buf));
  return toRows(table);
}

export async function applyPeopleImport(
  db: AppDB,
  rows: PeopleImportRow[],
  opts: PeopleImportOptions = {},
): Promise<PeopleImportResult> {
  const shifts = await db.shifts.orderBy('order').toArray();
  const existing = await db.people.toArray();
  const seen = new Set(existing.map((p) => `${p.shiftId}|${norm(p.name)}`));
  const res: PeopleImportResult = { added: 0, skipped: 0, errors: [], shiftsCreated: [], shiftsRemoved: [] };
  const findShift = (name: string) => shifts.find((s) => norm(s.name) === norm(name));

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      res.skipped++;
      continue;
    }
    let shift = findShift(row.shiftName);
    if (!shift && row.createShift) {
      const order = Math.max(-1, ...shifts.map((s) => s.order)) + 1;
      const kind = row.pool ? 'pool' : 'shift';
      const id = await upsertShift(db, { name: row.shiftName, order, kind });
      shift = { id, name: row.shiftName, order, kind };
      shifts.push(shift);
      res.shiftsCreated.push(row.shiftName);
    }
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

  if (opts.removeUnusedShifts && rows.some((r) => r.createShift)) {
    const inFile = new Set(rows.map((r) => norm(r.shiftName)));
    for (const s of shifts) {
      if (inFile.has(norm(s.name))) continue;
      const hasPeople = (await db.people.where('shiftId').equals(s.id).count()) > 0;
      const hasDraft = !!(await db.drafts.get(s.id));
      if (hasPeople || hasDraft) continue;
      await db.shifts.delete(s.id);
      res.shiftsRemoved.push(s.name);
    }
  }
  return res;
}
