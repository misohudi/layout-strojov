import { shareOrDownload } from './share';

const blob = new Blob(['x'], { type: 'text/plain' });
const nav = navigator as unknown as Record<string, unknown>;

afterEach(() => {
  delete nav.canShare;
  delete nav.share;
  vi.restoreAllMocks();
});

test('downloads when Web Share with files is unavailable', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  const clicked: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
  expect(await shareOrDownload(blob, 'a.xlsx')).toBe('downloaded');
  expect(clicked).toHaveLength(1);
  expect(clicked[0].download).toBe('a.xlsx');
});

test('shares when supported', async () => {
  nav.canShare = () => true;
  const share = vi.fn(async () => {});
  nav.share = share;
  expect(await shareOrDownload(blob, 'a.xlsx')).toBe('shared');
  expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0].name).toBe('a.xlsx');
});

test('returns cancelled when the user aborts sharing', async () => {
  nav.canShare = () => true;
  nav.share = async () => {
    throw new DOMException('aborted', 'AbortError');
  };
  expect(await shareOrDownload(blob, 'a.xlsx')).toBe('cancelled');
});
