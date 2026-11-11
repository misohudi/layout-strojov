import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Floor } from './Floor';

const items = [{ x: 0, y: 0, w: 2, h: 2 }];

test('zoom buttons stay outside the scrolling area so they never move with the plan', () => {
  render(<Floor items={items}><div>tile</div></Floor>);
  const zoom = screen.getByRole('group', { name: 'Priblíženie' });
  const scroller = screen.getByTestId('floor-scroll');
  expect(scroller.contains(zoom)).toBe(false);
  expect(scroller).toContainElement(screen.getByText('tile'));
});

test('the plan scrolls in one area in both directions', () => {
  render(<Floor items={items}><div>tile</div></Floor>);
  const scroller = screen.getByTestId('floor-scroll');
  expect(scroller).toHaveClass('floor__scroll');
  expect(scroller.style.touchAction).toBe('pan-x pan-y');
});

test('zoom changes the plan width', async () => {
  render(<Floor items={items}><div>tile</div></Floor>);
  const grid = screen.getByTestId('floor-scroll').firstElementChild as HTMLElement;
  expect(grid.style.width).toBe('100%');
  await userEvent.click(screen.getByRole('button', { name: '200 %' }));
  expect(grid.style.width).toBe('200%');
});
