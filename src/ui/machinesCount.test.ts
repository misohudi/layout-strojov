import { machinesCount } from './LayoutView';

test('the word "stroj" is declined by the count', () => {
  expect(machinesCount(1)).toBe('1 stroj');
  expect(machinesCount(2)).toBe('2 stroje');
  expect(machinesCount(4)).toBe('4 stroje');
  expect(machinesCount(5)).toBe('5 strojov');
  expect(machinesCount(12)).toBe('12 strojov');
});
