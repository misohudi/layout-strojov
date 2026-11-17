import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Floor, tileSize } from './Floor';

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

test('tiles are equally sized, a finger-sized minimum even without a measured area', () => {
  const { grid } = setup();
  // jsdom has no layout (size 0) → the minimum 64 × 64 px
  expect(grid.style.gridTemplateColumns).toBe('64px 64px');
  expect(grid.style.gridTemplateRows).toBe('64px 64px');
});

test('the hall fills the screen: 13 columns and 5 rows + aisle fit a 1280 × 800 tablet', () => {
  const hall = { cols: Array(13).fill(1), rows: [1, 1, 1, 0.35, 1, 1] };
  // 1264 px wide: (1264 - 20 - 120) / 13 = 86.4; 470 px high: (470 - 20 - 50) / 5.35 = 74.7
  expect(tileSize(1264, 470, hall)).toEqual({ w: 86, h: 74 });
  // big screen: not taller than 120 px, not wider than 1.5 × the height
  expect(tileSize(4000, 2000, hall)).toEqual({ w: 180, h: 120 });
  // narrow screen: the tile is never much narrower than high, never below 64 px → the plan scrolls
  expect(tileSize(900, 800, hall)).toEqual({ w: 64, h: 80 });
  expect(tileSize(300, 200, hall)).toEqual({ w: 64, h: 64 });
});

test('zooming scales tiles in both directions', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 200);
  expect(zoom(grid)).toBe(2);
  expect(grid.style.gridTemplateColumns).toBe('128px 128px');
  expect(grid.style.gridTemplateRows).toBe('128px 128px');
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
