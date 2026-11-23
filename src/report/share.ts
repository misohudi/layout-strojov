export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/** Opens the system share sheet with the file; falls back to a download. */
export async function shareOrDownload(blob: Blob, fileName: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Share failed for another reason (e.g. permission) – fall back to download.
    }
  }
  downloadBlob(file, fileName);
  return 'downloaded';
}

/** Opens the share sheet with several files; falls back to downloading each. */
export async function shareOrDownloadFiles(files: { name: string; blob: Blob }[]): Promise<ShareResult> {
  if (files.length === 1) return shareOrDownload(files[0].blob, files[0].name);
  const list = files.map((f) => new File([f.blob], f.name, { type: f.blob.type }));
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: list })) {
    try {
      await navigator.share({ files: list, title: files.map((f) => f.name).join(', ') });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  for (const f of files) downloadBlob(f.blob, f.name);
  return 'downloaded';
}

/** Saves the file straight to the device (Downloads), without the share sheet. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
