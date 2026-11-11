import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEasterEgg, EasterEgg } from './EasterEgg';

function Harness() {
  const egg = useEasterEgg();
  return (
    <div>
      <div data-testid="empty" onClick={egg.onPlanClick}>
        <button className="tile">Stroj</button>
      </div>
      <EasterEgg visible={egg.visible} onHide={egg.hide} />
    </div>
  );
}

const tapEmpty = (n: number) => {
  for (let i = 0; i < n; i++) fireEvent.click(screen.getByTestId('empty'));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('five quick taps on empty space show the photo in the bottom-left corner', () => {
  render(<Harness />);
  tapEmpty(4);
  expect(screen.queryByRole('img', { name: 'Prekvapenie' })).toBeNull();
  tapEmpty(1);
  const img = screen.getByRole('img', { name: 'Prekvapenie' });
  expect(img.closest('.easter-egg')).not.toBeNull();
});

test('taps on a machine do not count and reset the series', () => {
  render(<Harness />);
  tapEmpty(3);
  fireEvent.click(screen.getByRole('button', { name: 'Stroj' }));
  tapEmpty(2);
  expect(screen.queryByRole('img', { name: 'Prekvapenie' })).toBeNull();
});

test('slow taps (more than 2 s apart in total) do not trigger it', () => {
  render(<Harness />);
  tapEmpty(3);
  act(() => { vi.advanceTimersByTime(2500); });
  tapEmpty(2);
  expect(screen.queryByRole('img', { name: 'Prekvapenie' })).toBeNull();
});

test('the photo hides when tapped, or by itself after one second', () => {
  render(<Harness />);
  tapEmpty(5);
  fireEvent.click(screen.getByRole('img', { name: 'Prekvapenie' }));
  expect(screen.queryByRole('img', { name: 'Prekvapenie' })).toBeNull();
  tapEmpty(5);
  expect(screen.getByRole('img', { name: 'Prekvapenie' })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(900); });
  expect(screen.getByRole('img', { name: 'Prekvapenie' })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(100); }); // gone after 1 second
  expect(screen.queryByRole('img', { name: 'Prekvapenie' })).toBeNull();
});
