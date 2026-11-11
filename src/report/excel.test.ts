import { loadExcel, APP_UPDATED_MESSAGE } from './excel';

test('a failed chunk load (app updated while open) gives a clear message', async () => {
  const failing = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
  await expect(loadExcel(failing)).rejects.toThrow(APP_UPDATED_MESSAGE);
});

test('loads ExcelJS normally', async () => {
  const E = await loadExcel();
  expect(typeof E.Workbook).toBe('function');
});
