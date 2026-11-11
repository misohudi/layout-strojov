/** Asks the browser not to evict our IndexedDB data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage as StorageManager | undefined;
    if (!storage || typeof storage.persist !== 'function') return false;
    return await storage.persist();
  } catch {
    return false;
  }
}
