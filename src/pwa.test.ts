import { requestPersistentStorage } from './pwa';

const nav = navigator as unknown as { storage?: unknown };
const original = Object.getOwnPropertyDescriptor(navigator, 'storage');

afterEach(() => {
  if (original) Object.defineProperty(navigator, 'storage', original);
  else delete nav.storage;
});

test('returns false when the Storage API is unavailable', async () => {
  Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
  expect(await requestPersistentStorage()).toBe(false);
});

test('returns the result of navigator.storage.persist()', async () => {
  const persist = vi.fn(async () => true);
  Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
  expect(await requestPersistentStorage()).toBe(true);
  expect(persist).toHaveBeenCalled();
});

test('swallows errors from persist()', async () => {
  Object.defineProperty(navigator, 'storage', {
    value: { persist: async () => { throw new Error('x'); } },
    configurable: true,
  });
  expect(await requestPersistentStorage()).toBe(false);
});
