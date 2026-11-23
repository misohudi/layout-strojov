import { getMeta, setMeta, type AppDB } from '../db/db';

/**
 * Saving reports straight into a folder the tablet can see (e.g. a network share that an app such as
 * CIFS Documents Provider makes available to the system folder picker). Uses the browser's File System Access API: the folder is picked once with the
 * system folder picker and its handle is remembered on the tablet. The browser never sees the share's
 * address or password – the tablet's file system provides access.
 */

/** The subset of FileSystemDirectoryHandle we use. */
export interface FolderHandle {
  name: string;
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  getFileHandle(name: string, o: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
  getDirectoryHandle?(name: string, o: { create: boolean }): Promise<FolderHandle>;
}

/** A file to save: in a subfolder of the report folder (e.g. the month "2026-11"), if given. */
export interface OutFile {
  name: string;
  blob: Blob;
  folder?: string;
}

export type FilesResult =
  | { ok: true; folder: string; saved: number; skipped: number }
  | Exclude<SaveResult, { ok: true }>;

export type SaveResult =
  | { ok: true; folder: string }
  | { ok: false; reason: 'no-folder' | 'denied' | 'unsupported' }
  | { ok: false; reason: 'error'; message: string };

const KEY = 'reportFolder';
const LABEL_KEY = 'reportFolderLabel';
/** Handles that could not be stored (or were just picked) – kept for this session. */
const memory = new WeakMap<AppDB, FolderHandle>();

type PickerWindow = { showDirectoryPicker?(o: { id?: string; mode: 'readwrite' }): Promise<FolderHandle> };

export function isFolderSupported(): boolean {
  return typeof (window as unknown as PickerWindow).showDirectoryPicker === 'function';
}

const isHandle = (v: unknown): v is FolderHandle =>
  !!v && typeof (v as FolderHandle).getFileHandle === 'function' && typeof (v as FolderHandle).name === 'string';

/** Opens the system folder picker; returns the folder name, or null if the user cancelled. */
export async function pickReportFolder(db: AppDB): Promise<string | null> {
  const picker = (window as unknown as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  let handle: FolderHandle;
  try {
    handle = await picker({ id: 'report-folder', mode: 'readwrite' });
  } catch {
    return null; // cancelled
  }
  memory.set(db, handle);
  try {
    await setMeta(db, KEY, handle); // browsers can store folder handles in IndexedDB
  } catch {
    // not storable here – it still works until the app is closed
  }
  return handle.name;
}

export async function getReportFolder(db: AppDB): Promise<FolderHandle | undefined> {
  const cached = memory.get(db);
  if (cached) return cached;
  const stored = await getMeta<unknown>(db, KEY);
  return isHandle(stored) ? stored : undefined;
}

export async function forgetReportFolder(db: AppDB): Promise<void> {
  memory.delete(db);
  await db.meta.delete(KEY);
}

/** Asks for write access if needed. Call it at the very start of a tap, before other awaits. */
export async function requestFolderAccess(dir: FolderHandle): Promise<boolean> {
  try {
    let perm = (await dir.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (perm !== 'granted') perm = (await dir.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
    return perm === 'granted';
  } catch {
    return false;
  }
}

/** Writes the file into the chosen folder. Call it from a tap, so the browser may ask for access. */
export async function saveToReportFolder(db: AppDB, blob: Blob, fileName: string): Promise<SaveResult> {
  const dir = await getReportFolder(db);
  if (!dir) return { ok: false, reason: 'no-folder' };
  try {
    let perm = (await dir.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (perm !== 'granted') perm = (await dir.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
    if (perm !== 'granted') return { ok: false, reason: 'denied' };
    const file = await dir.getFileHandle(fileName, { create: true });
    const out = await file.createWritable();
    await out.write(blob);
    await out.close();
    return { ok: true, folder: dir.name };
  } catch (e) {
    const message = (e as { message?: unknown })?.message;
    return { ok: false, reason: 'error', message: typeof message === 'string' && message ? message : String(e) };
  }
}

/**
 * Writes the files into the chosen folder, each into its subfolder (created when missing). Files that
 * are there already are listed to `overwrite` once: true = replace them, false = leave them and save
 * the rest. Call it from a tap, so the browser may ask for access.
 */
export async function saveFilesToReportFolder(
  db: AppDB, files: OutFile[], overwrite: (existing: string[]) => Promise<boolean>,
  progress: (done: number, total: number) => void = () => {}, timeoutMs = WRITE_TIMEOUT_MS,
): Promise<FilesResult> {
  const dir = await getReportFolder(db);
  if (!dir) return { ok: false, reason: 'no-folder' };
  try {
    let perm = (await dir.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (perm !== 'granted') perm = (await dir.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
    if (perm !== 'granted') return { ok: false, reason: 'denied' };
    const targets = await Promise.all(
      files.map(async (f) => (f.folder && dir.getDirectoryHandle ? dir.getDirectoryHandle(f.folder, { create: true }) : dir)),
    );
    const exists = await Promise.all(
      files.map((f, i) => targets[i].getFileHandle(f.name, { create: false }).then(() => true, () => false)),
    );
    const existing = files.filter((_, i) => exists[i]).map((f) => (f.folder ? `${f.folder}/${f.name}` : f.name));
    const replace = existing.length > 0 ? await overwrite(existing) : true;
    let saved = 0;
    for (let i = 0; i < files.length; i++) {
      progress(i, files.length);
      if (exists[i] && !replace) continue;
      // one file at a time, each with a time limit: a slow or stuck network share ends in an error
      await withTimeout(
        (async () => {
          const out = await (await targets[i].getFileHandle(files[i].name, { create: true })).createWritable();
          await out.write(files[i].blob);
          await out.close();
        })(),
        timeoutMs,
        `Zápis súboru ${files[i].name}`,
      );
      saved++;
    }
    progress(files.length, files.length);
    return { ok: true, folder: dir.name, saved, skipped: files.length - saved };
  } catch (e) {
    const message = (e as { message?: unknown })?.message;
    return { ok: false, reason: 'error', message: typeof message === 'string' && message ? message : String(e) };
  }
}

/** A write to the (network) folder that takes longer than this is given up with an error. */
export const WRITE_TIMEOUT_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} trvá príliš dlho`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const filesWord = (n: number) => (n === 1 ? '1 súbor' : n >= 2 && n <= 4 ? `${n} súbory` : `${n} súborov`);

export function filesResultMessage(r: FilesResult): string {
  if (!r.ok) return saveResultMessage(r);
  const skipped = r.skipped ? ` (${filesWord(r.skipped)} ponechaných bez zmeny)` : '';
  return `Uložené do priečinka ${r.folder}: ${filesWord(r.saved)}${skipped}.`;
}

/** Free-text description of where the folder is (e.g. its network path), shown to the foremen. */
export async function getFolderLabel(db: AppDB): Promise<string> {
  return (await getMeta<string>(db, LABEL_KEY)) ?? '';
}

export async function setFolderLabel(db: AppDB, label: string): Promise<void> {
  await setMeta(db, LABEL_KEY, label.trim());
}

export function saveResultMessage(r: SaveResult): string {
  if (r.ok) return `Report uložený do priečinka ${r.folder}.`;
  switch (r.reason) {
    case 'no-folder': return 'Priečinok pre reporty nie je nastavený (Nastavenia → Report).';
    case 'denied': return 'Tablet nepovolil prístup k priečinku. Skúste znova a prístup povoľte.';
    case 'unsupported': return 'Tento prehliadač nevie ukladať priamo do priečinka – použite Zdieľať.';
    default: return `Report sa nepodarilo uložiť do priečinka (${r.message}). Je sieťový disk dostupný?`;
  }
}
