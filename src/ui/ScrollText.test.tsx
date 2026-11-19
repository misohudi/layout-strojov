import { render } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { ScrollText } from './ScrollText';

afterEach(() => vi.restoreAllMocks());

function sizes(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth);
}

test('text that fits stays still', () => {
  sizes(40, 60);
  const { container } = render(<ScrollText text="Kováč" />);
  expect(container.querySelector('.scroll-text')).not.toHaveClass('scroll-text--on');
});

test('text that does not fit scrolls by exactly the hidden part (no "…")', () => {
  sizes(110, 50);
  const { container } = render(<ScrollText text="Maximilián Kováčik" />);
  const el = container.querySelector('.scroll-text') as HTMLElement;
  expect(el).toHaveClass('scroll-text--on');
  expect(el.style.getPropertyValue('--scroll-shift')).toBe('-60px');
  expect(el).toHaveTextContent('Maximilián Kováčik');
});
