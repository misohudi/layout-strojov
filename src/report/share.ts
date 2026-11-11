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
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
