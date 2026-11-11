import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Floor } from './Floor';

const items = [{ x: 0, y: 0, w: 2, h: 2 }];
const RESET = 'Späť na 100 %';

const setup = () => {
  render(<Floor items={items}><div>tile</div></Floor>);
  const scroller = screen.getByTestId('floor-scroll');
  const grid = scroller.firstElementChild as HTMLElement;
  return { scroller, grid };
};

/** Two fingers that start `d0` px apart and end `d1` px apart (horizontal pinch). */
function pinch(el: HTMLElement, d0: number, d1: number) {
  const t = (x: number) => ({ clientX: x, clientY: 100, identifier: x });
  fireEvent.touchStart(el, { touches: [t(100), t(100 + d0)] });
  fireEvent.touchMove(el, { touches: [t(100), t(100 + (d0 + d1) / 2)] });
  fireEvent.touchMove(el, { touches: [t(100), t(100 + d1)] });
  fireEvent.touchEnd(el, { touches: [] });
}

test('at 100 % there are no zoom controls covering the plan', () => {
  const { grid } = setup();
  expect(grid.style.width).toBe('100%');
  expect(screen.queryByRole('button')).toBeNull();
});

test('pinching out with two fingers zooms the plan and shows a reset button', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 200);
  expect(grid.style.width).toBe('200%');
  expect(screen.getByRole('button', { name: RESET })).toBeInTheDocument();
});

test('the reset button returns to 100 % and disappears', async () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 250);
  await userEvent.click(screen.getByRole('button', { name: RESET }));
  expect(grid.style.width).toBe('100%');
  expect(screen.queryByRole('button', { name: RESET })).toBeNull();
});

test('zoom is limited between 100 % and 400 %', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 50);
  expect(grid.style.width).toBe('100%');
  expect(screen.queryByRole('button', { name: RESET })).toBeNull();
  pinch(scroller, 100, 1000);
  expect(grid.style.width).toBe('400%');
});

test('pinching back to almost 100 % snaps to 100 % and hides the reset button', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 200);
  pinch(scroller, 100, 52); // 200 % × 0.52 = 104 %
  expect(grid.style.width).toBe('100%');
  expect(screen.queryByRole('button', { name: RESET })).toBeNull();
});

test('the reset button is outside the scrolling area so it never moves with the plan', () => {
  const { scroller } = setup();
  pinch(scroller, 100, 200);
  expect(scroller.contains(screen.getByRole('button', { name: RESET }))).toBe(false);
});

test('one finger keeps native panning in both directions', () => {
  const { scroller } = setup();
  expect(scroller.style.touchAction).toBe('pan-x pan-y');
});
