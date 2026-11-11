import type ExcelJSType from 'exceljs';

export const APP_UPDATED_MESSAGE = 'Aplikácia sa medzitým aktualizovala. Obnovte stránku a skúste to znova.';

type Importer = () => Promise<unknown>;

/** Loads ExcelJS on demand so the large library is not part of the initial bundle. */
export async function loadExcel(importer: Importer = () => import('exceljs')): Promise<typeof ExcelJSType> {
  let mod: { default?: typeof ExcelJSType } & typeof ExcelJSType;
  try {
    mod = (await importer()) as typeof mod;
  } catch {
    // Typically an old chunk that no longer exists after a new version was deployed.
    throw new Error(APP_UPDATED_MESSAGE);
  }
  return mod.default ?? mod;
}
