import { pdfFileName } from './pdf';
import { chunkRows, ROWS_PER_PAGE, statsLine } from '../ui/RecordSheets';
import type { ShiftRecord } from '../domain/types';

const rec = (date: string, shiftName: string) => ({ date, shiftName }) as ShiftRecord;

test('one shift: the PDF is named after its date and shift; several: a history file', () => {
  expect(pdfFileName([rec('2026-11-10', 'B')])).toBe('Layout_2026-11-10_zmena-B.pdf');
  expect(pdfFileName([rec('2026-11-10', 'B'), rec('2026-11-09', 'A')], new Date('2026-11-19T10:00:00'))).toBe(
    'Historia_layoutov_2026-11-19.pdf',
  );
});

test('the machine table continues on further pages when it is long', () => {
  const rows = Array.from({ length: 39 }, (_, i) => i);
  const pages = chunkRows(rows);
  expect(pages).toHaveLength(2); // 22 + 17
  expect(pages[0]).toHaveLength(ROWS_PER_PAGE);
  expect(pages.flat()).toEqual(rows);
  expect(chunkRows([])).toEqual([[]]); // a shift without machines still gets its (empty) table page
});

test('PDF header: occupancy stands out on its own, viacobsluha in the line, no foreman', () => {
  const r = {
    foremanName: 'Novák',
    stats: { total: 37, staffed: 6, staffedPct: 16.2, frezari: 2, operatori: 1, multiPeople: 2, multiMachines: 5, occupied: 3, ext: 2, int: 1, occupancyPct: 8.1, extPct: 66.7, intPct: 33.3, peopleWithoutType: 0 },
  } as ShiftRecord;
  const line = statsLine(r);
  expect(line).toContain('Viacobsluha 2 ľudia na 5 strojoch');
  expect(line).not.toContain('Novák');
  expect(line).not.toContain('Obsadenosť'); // shown big next to it
});
