import type ExcelJSType from 'exceljs';

/** Loads ExcelJS on demand so the large library is not part of the initial bundle. */
export async function loadExcel(): Promise<typeof ExcelJSType> {
  const mod = await import('exceljs');
  return (mod.default ?? mod) as typeof ExcelJSType;
}
