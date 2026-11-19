import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Floor, fitZoom, tileSize } from './Floor';

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

test('cards have a finger-sized minimum even without a measured area', () => {
  const { grid } = setup();
  // jsdom has no layout (size 0) → the minimum 60 × 60 px
  expect(grid.style.gridTemplateColumns).toBe('60px 60px');
  expect(grid.style.gridTemplateRows).toBe('60px 60px');
});

test('the 13 × 6 plan stretches its cards over the whole area', () => {
  const frame = { cols: Array(13).fill(1), rows: Array(6).fill(1) };
  // 1212 × 575: (1212 - 20 - 120) / 13 = 82.5; (575 - 20 - 50) / 6 = 84.2
  expect(tileSize(1212, 575, frame)).toEqual({ w: 82, h: 84 });
  expect(fitZoom(1212, 575, { w: 82, h: 84 }, frame)).toBeCloseTo(1, 1); // the full plan needs no zoom
});

test('a zone with two machines uses the same cards and gaps, zoomed in on them', () => {
  const base = { w: 82, h: 84 };
  // two cards above each other: 82 + 2·10 wide, 2·84 + 3·10 high → limited by the height
  const z = fitZoom(1212, 575, base, { cols: [1], rows: [1, 1] });
  expect(z).toBeCloseTo(575 / 198, 3);
  // never zoomed out below the normal card size
  expect(fitZoom(1212, 575, base, { cols: Array(20).fill(1), rows: [1] })).toBe(1);
});

test('zooming scales tiles in both directions', () => {
  const { scroller, grid } = setup();
  pinch(scroller, 100, 200);
  expect(zoom(grid)).toBe(2);
  expect(grid.style.gridTemplateColumns).toBe('120px 120px');
  expect(grid.style.gridTemplateRows).toBe('120px 120px');
});

test('while the fingers move the plan is only stretched as a picture; it is laid out once they lift', () => {
  // laying the plan out again on every finger move made the cards jitter and show twice on the tablet
  const { scroller, grid } = setup();
  const t = (x: number) => ({ clientX: x, clientY: 100, identifier: x });
  fireEvent.touchStart(scroller, { touches: [t(100), t(200)] });
  fireEvent.touchMove(scroller, { touches: [t(100), t(300)] });
  expect(zoom(grid)).toBe(1);
  expect(grid.style.gridTemplateColumns).toBe('60px 60px');
  expect(grid.style.transform).toContain('scale(2)');
  fireEvent.touchEnd(scroller, { touches: [] });
  expect(zoom(grid)).toBe(2);
  expect(grid.style.transform).toBe('');
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
