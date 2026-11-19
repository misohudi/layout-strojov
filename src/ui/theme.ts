import { getMeta, setMeta, type AppDB } from '../db/db';

export type Theme = 'light' | 'dark' | 'system';

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Svetlý' },
  { value: 'dark', label: 'Tmavý' },
  { value: 'system', label: 'Podľa zariadenia' },
];

/** Header button cycles light → dark → by device → light. */
export function nextTheme(theme: Theme): Theme {
  return theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
}

export const themeLabel = (theme: Theme) => THEMES.find((t) => t.value === theme)!.label;

const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system';

/** Switches the colours: styles.css defines the dark palette for data-theme="dark" (and "system" when the device is dark). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#002f36' : '#007480');
}

export async function loadTheme(db: AppDB): Promise<Theme> {
  const v = await getMeta<string>(db, 'theme');
  return isTheme(v) ? v : 'light';
}

export async function saveTheme(db: AppDB, theme: Theme): Promise<void> {
  await setMeta(db, 'theme', theme);
  applyTheme(theme);
}
