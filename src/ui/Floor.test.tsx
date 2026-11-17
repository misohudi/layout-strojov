import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Floor, tileHeight } from './Floor';

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

const zoom = (grid: HTMLElement) => Number(grid.dataset.zoom);

test('tiles are equally sized landscape rectangles, readable even without measured height', () => {
  const { grid } = setup();
  // jsdom has no layout (height 0) → the minimum readable tile 84 px high, 2.1× as wide
  expect(grid.style.gridTemplateColumns).toBe('repeat(2, 176px)');
  expect(grid.style.gridTemplateRows).toBe('repeat(2, 84px)');
});

test('tile height follows the available height so all rows are visible, within limits', () => {
  expect(tileHeight(600, 4)).toBe(104); // plenty of room → maximum
  expect(tileHeight(460, 4)).toBe(98); // (460 - 2·14 padding - 3·14 gaps) / 4 = 97.5
  expect(tileHeight(200, 4)).toBe(84); // not enough room → minimum, the plan scrolls
});

test('zooming scales tiles in both directions', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 200);
  expect(zoom(grid)).toBe(2);
  expect(grid.style.gridTemplateColumns).toBe('repeat(2, 353px)');
  expect(grid.style.gridTemplateRows).toBe('repeat(2, 168px)');
});

test('at 100 % there are no zoom controls covering the plan', () => {
  const { grid } = setup();
  expect(zoom(grid)).toBe(1);
  expect(screen.queryByRole('button')).toBeNull();
});

test('pinching out with two fingers zooms the plan and shows a reset button', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 200);
  expect(zoom(grid)).toBe(2);
  expect(screen.getByRole('button', { name: RESET })).toBeInTheDocument();
});

test('the reset button returns to 100 % and disappears', async () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 250);
  await userEvent.click(screen.getByRole('button', { name: RESET }));
  expect(zoom(grid)).toBe(1);
  expect(screen.queryByRole('button', { name: RESET })).toBeNull();
});

test('zoom is limited between 50 % and 300 %; zoomed out also offers the reset button', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 20);
  expect(zoom(grid)).toBe(0.5);
  expect(screen.getByRole('button', { name: RESET })).toBeInTheDocument();
  pinch(scroller, 100, 1000);
  expect(zoom(grid)).toBe(3);
});

test('pinching back to almost 100 % snaps to 100 % and hides the reset button', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 200);
  pinch(scroller, 100, 52); // 200 % × 0.52 = 104 %
  expect(zoom(grid)).toBe(1);
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
